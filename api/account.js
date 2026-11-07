import { json } from "../lib/supabase.js";
import { requireUser } from "../lib/require-user.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { db, user } = auth;
    const [{ data: membership }, { data: usage }] = await Promise.all([
      db.from("memberships").select("expires_at").eq("user_id", user.id).maybeSingle(),
      db.from("search_usage").select("searches").eq("user_id", user.id).eq("usage_date", new Date().toISOString().slice(0, 10)).maybeSingle()
    ]);
    const active = Boolean(membership?.expires_at && new Date(membership.expires_at).getTime() > Date.now());
    const limit = Number(process.env.FREE_DAILY_SEARCH_LIMIT || 10);
    const used = usage?.searches || 0;
    return json(res, 200, {
      email: user.email,
      isPremium: active,
      expiresAt: active ? membership.expires_at : null,
      freeLimit: limit,
      used,
      remaining: active ? null : Math.max(0, limit - used)
    });
  } catch (error) {
    console.error("Account error:", error);
    return json(res, 500, { error: "Could not load account details." });
  }
}
