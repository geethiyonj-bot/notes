import { json } from "../lib/supabase.js";
import { requireUser } from "../lib/require-user.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const q = String(req.query.q || "").trim();
  if (q.length < 2 || q.length > 160) return json(res, 400, { error: "Enter a search between 2 and 160 characters." });

  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { db, user } = auth;
    const { data: accessRows, error: accessError } = await db.rpc("consume_search_access", {
      p_user_id: user.id,
      p_daily_limit: Number(process.env.FREE_DAILY_SEARCH_LIMIT || 10)
    });
    if (accessError) throw accessError;
    const access = accessRows?.[0];
    if (!access?.allowed) {
      return json(res, 402, {
        code: "SEARCH_LIMIT_REACHED",
        error: "Your free daily searches are used. Get the ₹10 monthly pass for unlimited searches.",
        remaining: 0,
        isPremium: false
      });
    }

    const { data, error } = await db.rpc("search_academic_pages", {
      search_text: q,
      filter_department: req.query.department || null,
      filter_year: req.query.year ? Number(req.query.year) : null,
      filter_semester: req.query.semester ? Number(req.query.semester) : null,
      filter_type: req.query.type && req.query.type !== "All resources" ? req.query.type : null
    });
    if (error) throw error;

    const results = await Promise.all((data || []).map(async row => {
      const pageText = row.page_text || "";
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      let at = -1;
      for (const term of terms) { at = pageText.toLowerCase().indexOf(term); if (at >= 0) break; }
      const start = Math.max(0, (at < 0 ? 0 : at) - 100);
      const excerpt = pageText.slice(start, start + 260).replace(/\s+/g, " ").trim();
      const { data: signed, error: signedError } = await db.storage
        .from(process.env.SUPABASE_BUCKET || "academic-pdfs")
        .createSignedUrl(row.storage_path, 600, { download: false });
      return {
        id: row.resource_id, title: row.title, department: row.department,
        year: row.academic_year, semester: row.semester, unit: row.unit,
        subject: row.subject, subjectCode: row.subject_code,
        resourceType: row.resource_type, filename: row.original_filename,
        page: row.page_number,
        excerpt: `${start > 0 ? "…" : ""}${excerpt}${start + 260 < pageText.length ? "…" : ""}`,
        pdfUrl: signedError ? null : signed?.signedUrl
      };
    }));
    return json(res, 200, {
      query: q, count: results.length, results,
      usage: { isPremium: access.is_premium, remaining: access.remaining, expiresAt: access.expires_at || null }
    });
  } catch (error) {
    console.error("Search error:", error);
    return json(res, 500, { error: "Search service temporarily unavailable." });
  }
}
