import { supabaseAdmin, json } from "../lib/supabase.js";

export async function requireUser(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    json(res, 401, { error: "Sign in with your email to continue." });
    return null;
  }
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { error: "Your session has expired. Please sign in again." });
    return null;
  }
  return { db, user: data.user };
}
