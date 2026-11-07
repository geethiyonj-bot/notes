create extension if not exists pgcrypto;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  academic_year smallint not null check (academic_year between 1 and 4),
  semester smallint not null check (semester between 1 and 8),
  unit smallint check (unit between 1 and 5),
  subject text not null,
  subject_code text,
  resource_type text not null check (resource_type in (
    'CIE question papers',
    'Semester question papers',
    'Lab practical questions',
    'Lab manuals',
    'Study materials'
  )),
  original_filename text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.resource_pages (
  id bigint generated always as identity primary key,
  resource_id uuid not null references public.resources(id) on delete cascade,
  page_number integer not null,
  page_text text not null,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(page_text, ''))
  ) stored,
  unique(resource_id, page_number)
);

create index if not exists resource_pages_search_idx
  on public.resource_pages using gin(search_vector);

create index if not exists resources_filters_idx
  on public.resources(department, academic_year, semester, resource_type, unit);

-- Server-side search function. API calls this with the Supabase service role.
create or replace function public.search_academic_pages(
  search_text text,
  filter_department text default null,
  filter_year integer default null,
  filter_semester integer default null,
  filter_type text default null
)
returns table (
  page_id bigint,
  resource_id uuid,
  title text,
  department text,
  academic_year smallint,
  semester smallint,
  unit smallint,
  subject text,
  subject_code text,
  resource_type text,
  original_filename text,
  storage_path text,
  page_number integer,
  page_text text,
  rank real
)
language sql
stable
as $$
  select
    rp.id, r.id, r.title, r.department, r.academic_year, r.semester,
    r.unit, r.subject, r.subject_code, r.resource_type,
    r.original_filename, r.storage_path, rp.page_number, rp.page_text,
    ts_rank(rp.search_vector, websearch_to_tsquery('english', search_text))::real
  from public.resource_pages rp
  join public.resources r on r.id = rp.resource_id
  where rp.search_vector @@ websearch_to_tsquery('english', search_text)
    and (filter_department is null or r.department = filter_department)
    and (filter_year is null or r.academic_year = filter_year)
    and (filter_semester is null or r.semester = filter_semester)
    and (filter_type is null or r.resource_type = filter_type)
  order by rank desc, r.created_at desc
  limit 50;
$$;

-- Keep tables inaccessible to anonymous users; API uses service role on server.
alter table public.resources enable row level security;
alter table public.resource_pages enable row level security;

-- Student identities, monthly passes and daily free-search counters.
create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.search_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  searches integer not null default 0 check (searches >= 0),
  primary key (user_id, usage_date)
);

create table if not exists public.membership_payments (
  payment_id text primary key,
  order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paise integer not null check (amount_paise = 1000),
  created_at timestamptz not null default now()
);

alter table public.memberships enable row level security;
alter table public.search_usage enable row level security;
alter table public.membership_payments enable row level security;

-- Atomic daily limit: premium members are unlimited until expires_at.
create or replace function public.consume_search_access(p_user_id uuid, p_daily_limit integer default 10)
returns table(allowed boolean, is_premium boolean, remaining integer, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expiry timestamptz;
  v_count integer;
  v_limit integer := greatest(1, least(coalesce(p_daily_limit, 10), 100));
begin
  select m.expires_at into v_expiry from public.memberships m where m.user_id = p_user_id;
  if v_expiry is not null and v_expiry > now() then
    return query select true, true, null::integer, v_expiry;
    return;
  end if;

  insert into public.search_usage(user_id, usage_date, searches)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set searches = public.search_usage.searches + 1
    where public.search_usage.searches < v_limit
  returning searches into v_count;

  if v_count is null then
    select u.searches into v_count from public.search_usage u
      where u.user_id = p_user_id and u.usage_date = current_date;
    return query select false, false, 0, null::timestamptz;
  else
    return query select true, false, greatest(0, v_limit - v_count), null::timestamptz;
  end if;
end;
$$;

-- One captured ₹10 payment activates one calendar month. Early renewal extends
-- from the current expiry, and duplicate payment callbacks cannot extend twice.
create or replace function public.activate_monthly_membership(p_user_id uuid, p_payment_id text, p_order_id text)
returns table(expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_expiry timestamptz;
begin
  insert into public.membership_payments(payment_id, order_id, user_id, amount_paise)
  values (p_payment_id, p_order_id, p_user_id, 1000)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select m.expires_at into v_expiry from public.memberships m where m.user_id = p_user_id;
    if v_expiry is null then raise exception 'Payment already processed or belongs to another account'; end if;
    return query select v_expiry;
    return;
  end if;

  insert into public.memberships(user_id, expires_at, updated_at)
  values (p_user_id, now() + interval '1 month', now())
  on conflict (user_id) do update
    set expires_at = greatest(now(), public.memberships.expires_at) + interval '1 month',
        updated_at = now()
  returning public.memberships.expires_at into v_expiry;
  return query select v_expiry;
end;
$$;

-- These functions are called only by the Vercel server using the service role.
revoke all on function public.consume_search_access(uuid, integer) from public, anon, authenticated;
revoke all on function public.activate_monthly_membership(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_search_access(uuid, integer) to service_role;
grant execute on function public.activate_monthly_membership(uuid, text, text) to service_role;
revoke all on function public.search_academic_pages(text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.search_academic_pages(text, text, integer, integer, text) to service_role;
