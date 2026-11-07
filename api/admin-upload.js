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

// Keep the file below Vercel's overall request-body limit.
const MAX_SIZE = 3.5 * 1024 * 1024;

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
    maxTotalFileSize: MAX_SIZE + 512 * 1024,
    maxFiles: 1,
    multiples: false,
    keepExtensions: true,
    allowEmptyFiles: false,
    minFileSize: 1
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ fields, files });
    });
  });
}

function isPdfFile(buffer) {
  // A PDF file must contain the PDF signature near its beginning.
  const header = buffer.subarray(0, 1024);
  return header.includes(Buffer.from("%PDF-"));
}

function getUploadError(error) {
  if (
    error?.code === "ETOOBIG" ||
    error?.httpCode === 413 ||
    error?.status === 413
  ) {
    return {
      status: 413,
      message: "PDF is too large. Please upload a PDF smaller than 3.5 MB."
    };
  }

  return {
    status: 400,
    message: error?.message || "Unable to process the uploaded PDF."
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "Only POST requests are allowed."
    });
  }

  // 1. ADMIN AUTHENTICATION

  const savedKey = process.env.ADMIN_API_KEY?.trim();

  const enteredKey =
    typeof req.headers["x-admin-key"] === "string"
      ? req.headers["x-admin-key"].trim()
      : "";

  if (!savedKey) {
    return json(res, 500, {
      success: false,
      error: "ADMIN_API_KEY is missing in Vercel Environment Variables."
    });
  }

  if (!enteredKey || enteredKey !== savedKey) {
    return json(res, 401, {
      success: false,
      error: "Incorrect admin key."
    });
  }

  // 2. INITIALIZE VARIABLES

  let db = null;
  let tempPath = null;
  let uploadedPath = null;
  let resourceId = null;

  const bucket =
    process.env.SUPABASE_BUCKET || "academic-pdfs";

  try {
    // 3. CONNECT TO SUPABASE

    db = supabaseAdmin();

    // 4. RECEIVE FORM DATA

    const { fields, files } = await parseForm(req);

    const file = one(files.pdf);

    if (!file) {
      return json(res, 400, {
        success: false,
        error: "Please select a PDF file."
      });
    }

    tempPath = file.filepath || file.path || null;

    if (!tempPath) {
      return json(res, 400, {
        success: false,
        error: "Uploaded file could not be located."
      });
    }

    if (file.size > MAX_SIZE) {
      return json(res, 413, {
        success: false,
        error: "PDF must be smaller than 3.5 MB."
      });
    }

    // 5. READ PDF FILE

    const buffer = await fs.readFile(tempPath);

    if (!isPdfFile(buffer)) {
      return json(res, 400, {
        success: false,
        error: "The selected file is not a valid PDF. Please select an actual PDF document."
      });
    }

    const originalName =
      file.originalFilename ||
      file.newFilename ||
      "resource.pdf";

    // 6. READ ACADEMIC DETAILS

    const title = clean(fields.title);
    const department = clean(fields.department);

    const year = Number(clean(fields.year));
    const semester = Number(clean(fields.semester));

    const unitText = clean(fields.unit);
    const unit = unitText ? Number(unitText) : null;

    const subject = clean(fields.subject);
    const subjectCode = clean(fields.subjectCode) || null;
    const resourceType = clean(fields.resourceType);

    if (!title || !department || !subject) {
      return json(res, 400, {
        success: false,
        error: "Title, department and subject are required."
      });
    }

    if (![1, 2, 3, 4].includes(year)) {
      return json(res, 400, {
        success: false,
        error: "Select a valid academic year."
      });
    }

    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(semester)) {
      return json(res, 400, {
        success: false,
        error: "Select a valid semester."
      });
    }

    if (
      unit !== null &&
      ![1, 2, 3, 4, 5].includes(unit)
    ) {
      return json(res, 400, {
        success: false,
        error: "Select a valid unit."
      });
    }

    if (!ALLOWED_TYPES.includes(resourceType)) {
      return json(res, 400, {
        success: false,
        error: "Select a valid resource type."
      });
    }

    // 7. EXTRACT PDF TEXT

    let parsed;

    try {
      parsed = await pdfParse(buffer);
    } catch (error) {
      console.error("PDF PARSING ERROR:", error);

      return json(res, 422, {
        success: false,
        error: "Unable to read this PDF. Please try another PDF file."
      });
    }

    const pages = String(parsed.text || "")
      .split(/\f/)
      .map((pageText, index) => ({
        page_number: index + 1,
        page_text: pageText.trim()
      }))
      .filter(page => page.page_text.length > 0);

    if (pages.length === 0) {
      return json(res, 422, {
        success: false,
        error: "No selectable text found. This PDF may be scanned and require OCR."
      });
    }

    // 8. UPLOAD PDF TO SUPABASE STORAGE

    const safeDepartment = department.replace(
      /[^a-z0-9_-]/gi,
      "_"
    );

    const storagePath =
      `${safeDepartment}/${year}-${semester}/${crypto.randomUUID()}.pdf`;

    const { error: storageError } = await db.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false
      });

    if (storageError) {
      throw new Error(
        "Supabase storage error: " + storageError.message
      );
    }

    uploadedPath = storagePath;

    // 9. SAVE RESOURCE DETAILS IN DATABASE

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
      throw new Error(
        "Database resource error: " + resourceError.message
      );
    }

    resourceId = resource.id;

    // 10. INDEX PDF PAGE TEXT

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
        throw new Error(
          "PDF indexing error: " + pageError.message
        );
      }
    }

    // 11. SUCCESS RESPONSE

    return json(res, 201, {
      success: true,
      message: "PDF uploaded and indexed successfully.",
      resourceId,
      indexedPages: pages.length
    });

  } catch (error) {
    console.error("ADMIN UPLOAD ERROR:", error);

    // Remove incomplete database record.
    if (db && resourceId) {
      const { error: deleteError } = await db
        .from("resources")
        .delete()
        .eq("id", resourceId);

      if (deleteError) {
        console.error("DATABASE CLEANUP ERROR:", deleteError);
      }
    }

    // Remove incomplete storage upload.
    if (db && uploadedPath) {
      const { error: removeError } = await db.storage
        .from(bucket)
        .remove([uploadedPath]);

      if (removeError) {
        console.error("STORAGE CLEANUP ERROR:", removeError);
      }
    }

    const result = getUploadError(error);

    return json(res, result.status, {
      success: false,
      error: result.message
    });

  } finally {
    // Remove temporary uploaded file.
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}
