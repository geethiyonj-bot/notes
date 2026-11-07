
import { IncomingForm } from "formidable";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pdfParse from "pdf-parse";
import { supabaseAdmin, json } from "../lib/supabase.js";

export const config = {
  api: {
    bodyParser: false
  }
};

const MAX_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
  "CIE question papers",
  "Semester question papers",
  "Lab practical questions",
  "Lab manuals",
  "Study materials"
];

const one = value =>
  Array.isArray(value) ? value[0] : value;

const clean = value =>
  String(one(value) ?? "").trim();

function parseForm(req) {
  const form = new IncomingForm({
    maxFileSize: MAX_SIZE,
    multiples: false,
    keepExtensions: true
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Only POST requests are allowed."
    });
  }

  // 1. CHECK ADMIN KEY
  const savedKey = process.env.ADMIN_API_KEY?.trim();

  const enteredKey =
    typeof req.headers["x-admin-key"] === "string"
      ? req.headers["x-admin-key"].trim()
      : "";

  if (!savedKey) {
    return json(res, 500, {
      error: "ADMIN_API_KEY is missing in Vercel. Add the variable and redeploy."
    });
  }

  if (!enteredKey || enteredKey !== savedKey) {
    return json(res, 401, {
      error: "Incorrect admin key. Enter the same value configured as ADMIN_API_KEY in Vercel."
    });
  }

  let db;
  let tempPath = null;
  let uploadedPath = null;
  let resourceId = null;

  const bucket =
    process.env.SUPABASE_BUCKET || "academic-pdfs";

  try {
    // 2. CONNECT TO SUPABASE
    db = supabaseAdmin();

    // 3. RECEIVE PDF AND FORM DATA
    const { fields, files } = await parseForm(req);

    const file = one(files.pdf);

    if (!file) {
      return json(res, 400, {
        error: "Please select a PDF file."
      });
    }

    tempPath = file.filepath;

    const originalName =
      file.originalFilename || "resource.pdf";

    if (
      path.extname(originalName).toLowerCase() !== ".pdf"
    ) {
      return json(res, 400, {
        error: "Only PDF files are accepted."
      });
    }

    if (file.size > MAX_SIZE) {
      return json(res, 413, {
        error: "PDF must be smaller than 4 MB."
      });
    }

    // 4. READ ACADEMIC DETAILS
    const title = clean(fields.title);
    const department = clean(fields.department);
    const year = Number(clean(fields.year));
    const semester = Number(clean(fields.semester));

    const unitText = clean(fields.unit);
    const unit = unitText ? Number(unitText) : null;

    const subject = clean(fields.subject);
    const subjectCode = clean(fields.subjectCode) || null;
    const resourceType = clean(fields.resourceType);

    if (
      !title ||
      !department ||
      ![1, 2, 3, 4].includes(year) ||
      ![1, 2, 3, 4, 5, 6, 7, 8].includes(semester) ||
      (unit !== null && ![1, 2, 3, 4, 5].includes(unit)) ||
      !subject ||
      !ALLOWED_TYPES.includes(resourceType)
    ) {
      return json(res, 400, {
        error: "Please complete all academic details correctly."
      });
    }

    // 5. EXTRACT PDF TEXT
    const buffer = await fs.readFile(tempPath);
    const parsed = await pdfParse(buffer);

    const pages = String(parsed.text || "")
      .split(/\f/)
      .map((text, index) => ({
        page_number: index + 1,
        page_text: text.trim()
      }))
      .filter(page => page.page_text.length > 0);

    if (pages.length === 0) {
      return json(res, 422, {
        error: "No readable text found. This PDF may be scanned and require OCR."
      });
    }

    // 6. UPLOAD PDF TO SUPABASE STORAGE
    const safeDepartment = department.replace(
      /[^a-z0-9_-]/gi,
      "_"
    );

    const storagePath =
      `${safeDepartment}/${year}-${semester}/${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) {
      throw new Error("Supabase storage upload failed: " + uploadError.message);
    }

    uploadedPath = storagePath;

    // 7. SAVE RESOURCE INFORMATION
    const { data: resource, error: resourceError } = await db
      .from("resources")
      .insert({
        title,
        department,
        academic_year: year,
        semester,
        unit,
        subject,
        subject_code: subjectCode,
        resource_type: resourceType,
        original_filename: originalName,
        storage_path: storagePath
      })
      .select("id")
      .single();

    if (resourceError) {
      throw resourceError;
    }

    resourceId = resource.id;

    // 8. INDEX EACH PDF PAGE
    const pageRows = pages.map(page => ({
      resource_id: resourceId,
      page_number: page.page_number,
      page_text: page.page_text
    }));

    for (let i = 0; i < pageRows.length; i += 100) {
      const batch = pageRows.slice(i, i + 100);

      const { error: pageError } = await db
        .from("resource_pages")
        .insert(batch);

      if (pageError) {
        throw pageError;
      }
    }

    // 9. SUCCESS
    return json(res, 201, {
      success: true,
      message: "PDF uploaded and indexed successfully.",
      resourceId,
      indexedPages: pages.length
    });

  } catch (error) {
    console.error("ADMIN UPLOAD ERROR:", error);

    if (db && resourceId) {
      await db
        .from("resources")
        .delete()
        .eq("id", resourceId);
    }

    if (db && uploadedPath) {
      await db.storage
        .from(bucket)
        .remove([uploadedPath]);
    }

    return json(res, 500, {
      error: error.message || "PDF upload failed."
    });

  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}
