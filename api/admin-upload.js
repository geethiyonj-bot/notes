import { IncomingForm } from "formidable";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pdfParse from "pdf-parse";
import { supabaseAdmin, json } from "../lib/supabase.js";

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  const form = new IncomingForm({ maxFileSize: 4 * 1024 * 1024, multiples: false, keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}
const one = value => Array.isArray(value) ? value[0] : value;
const clean = value => String(one(value) ?? "").trim();

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  if (!process.env.ADMIN_API_KEY || req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY) {
    return json(res, 401, { error: "Admin authentication failed." });
  }

  let tempPath;
  let uploadedPath;
  const db = supabaseAdmin();
  const bucket = process.env.SUPABASE_BUCKET || "academic-pdfs";

  try {
    const { fields, files } = await parseForm(req);
    const file = one(files.pdf);
    if (!file) return json(res, 400, { error: "Choose a PDF file." });
    tempPath = file.filepath || file.path;
    const originalName = file.originalFilename || file.name || "resource.pdf";
    if (path.extname(originalName).toLowerCase() !== ".pdf") {
      return json(res, 400, { error: "Only PDF files are accepted." });
    }

    const title = clean(fields.title);
    const department = clean(fields.department);
    const year = Number(clean(fields.year));
    const semester = Number(clean(fields.semester));
    const unitText = clean(fields.unit);
    const unit = unitText ? Number(unitText) : null;
    const subject = clean(fields.subject);
    const subjectCode = clean(fields.subjectCode) || null;
    const resourceType = clean(fields.resourceType);
    const allowedTypes = ["CIE question papers","Semester question papers","Lab practical questions","Lab manuals","Study materials"];

    if (!title || !department || ![1,2,3,4].includes(year) || ![1,2,3,4,5,6,7,8].includes(semester) ||
        (unit !== null && ![1,2,3,4,5].includes(unit)) || !subject || !allowedTypes.includes(resourceType)) {
      return json(res, 400, { error: "Please complete all resource details with valid year, semester, unit and type." });
    }

    const buffer = await fs.readFile(tempPath);
    const parsed = await pdfParse(buffer);
    const pageTexts = String(parsed.text || "").split(/\f/).map(t => t.trim());
    const pages = pageTexts.map((text, index) => ({ page_number: index + 1, page_text: text }))
      .filter(p => p.page_text.length > 0);
    if (!pages.length) return json(res, 422, { error: "No selectable text found. This appears to be a scanned PDF; OCR is required before it can be searched." });

    const storagePath = `${department.replace(/[^a-z0-9_-]/gi,"_")}/${year}-${semester}/${crypto.randomUUID()}.pdf`;
    const { error: storageError } = await db.storage.from(bucket).upload(storagePath, buffer, {
      contentType: "application/pdf", upsert: false
    });
    if (storageError) throw storageError;
    uploadedPath = storagePath;

    const { data: resource, error: insertError } = await db.from("resources").insert({
      title, department, academic_year: year, semester, unit, subject,
      subject_code: subjectCode, resource_type: resourceType,
      original_filename: originalName, storage_path: storagePath
    }).select("id").single();
    if (insertError) throw insertError;

    const pageRows = pages.map(p => ({ resource_id: resource.id, ...p }));
    for (let i = 0; i < pageRows.length; i += 100) {
      const { error } = await db.from("resource_pages").insert(pageRows.slice(i, i + 100));
      if (error) {
        await db.from("resources").delete().eq("id", resource.id);
        throw error;
      }
    }
    return json(res, 201, { message: "PDF uploaded and indexed.", resourceId: resource.id, indexedPages: pages.length });
  } catch (error) {
    if (uploadedPath) {
      await db.storage.from(bucket).remove([uploadedPath]).catch(() => {});
    }
    console.error("Upload error:", error);
    return json(res, 500, { error: error.message || "PDF upload failed." });
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => {});
  }
}
