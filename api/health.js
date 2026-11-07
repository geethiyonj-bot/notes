import { json } from "../lib/supabase.js";
export default function handler(_req, res) {
  json(res, 200, { status: "ok", service: "Campus Academic Hub API" });
}
