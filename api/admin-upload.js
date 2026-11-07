
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

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
  "CIE question papers",
  "Semester question papers",
  "Lab practical questions",
  "Lab manuals",
  "Study materials"
];

function parseForm(req) {
  const form = new IncomingForm({
    maxFileSize: MAX_FILE_SIZE,
    maxTotalFileSize: MAX_FILE_SIZE,
    multiples: false,
    keepExtensions: true
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
      } else {
        resolve({ fields, files });
      }
    });
  });
}

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value) {
  return String(one(value) ?? "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Method not allowed."
    });
  }

  // ADMIN AUTHENTICATION
  const configuredAdminKey =
    process.env.ADMIN_API_KEY?.trim();

  const suppliedAdminKey =
    typeof req.headers["x-admin-key"] === "string"
      ? req.headers["x-admin-key"].trim()
      : "";

  if (!configuredAdminKey) {
    return json(res, 500, {
      error: "ADMIN_API_KEY is missing from Vercel environment variables. Add it and redeploy."
    });
  }

  if (
    !suppliedAdminKey ||
    suppliedAdminKey !== configuredAdminKey
  ) {
    return json(res, 401, {
      error: "Admin authentication failed. The entered key does not match the deployed ADMIN_API_KEY."
    });
  }

  let tempPath = null;
  let uploadedPath = null;
  let db = null;
  let resourceId = null;

  const bucket =
    process.env.SUPABASE_BUCKET || "academic-pdfs";

  try {
    // CONNECT TO SUPABASE
    db = supabaseAdmin();

    // RECEIVE FORM AND PDF
    const { fields, files } = await parseForm(req);

    const file = one(files.pdf);

    if (!file) {
      return json(res, 400, {
        error: "Please choose a PDF file."
      });
    }

    tempPath = file.filepath || file.path;

    const originalName =
      file.originalFilename ||
      file.name ||
      "resource.pdf";

    if (
      path.extname(originalName).toLowerCase() !== ".pdf"
    ) {
      return json(res, 400, {
        error: "Only PDF files are accepted."
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return json(res, 413, {
        error: "PDF size must not exceed 4 MB."
      });
    }

    // READ RESOURCE DETAILS
    const title = clean(fields.title);
    const department = clean(fields.department);
    const year = Number(clean(fields.year));
    const semester = Number(clean(fields.semester));
    const unitText = clean(fields.unit);
    const unit = unitText ? Number(unitText) : null;
    const subject = clean(fields.subject);
    const subjectCode =
      clean(fields.subjectCode) || null;
    const resourceType = clean(fields.resourceType);

    // VALIDATE RESOURCE DETAILS
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
        error: "Please enter valid title, department, year, semester, subject and resource type."
      });
    }

    // EXTRACT PDF TEXT
    const buffer = await fs.readFile(tempPath);

    const parsed = await pdfParse(buffer);

    const pageTexts = String(parsed.text || "")
      .split(/\f/)
      .map(text => text.trim());

    const pages = pageTexts
      .map((pageText, index) => ({
        page_number: index + 1,
        page_text: pageText
      }))
      .filter(page => page.page_text.length > 0);

    if (pages.length === 0) {
      return json(res, 422, {
        error: "No selectable text found in this PDF. Scanned PDFs need OCR before indexing."
      });
    }

    // CREATE STORAGE PATH
    const safeDepartment = department.replace(
      /[^a-z0-9_-]/gi,
      "_"
    );

    const storagePath =
      `${safeDepartment}/${year}-${semester}/${crypto.randomUUID()}.pdf`;

    // UPLOAD PDF TO SUPABASE STORAGE
    const { error: storageError } = await db.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false
      });

    if (storageError) {
      throw storageError;
    }

    uploadedPath = storagePath;

    // SAVE RESOURCE DETAILS
    const { data: resource, error: insertError } = await db
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

    if (insertError) {
      throw insertError;
    }

    resourceId = resource.id;

    // INDEX PDF PAGE CONTENT
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

    // SUCCESS
    return json(res, 201, {
      success: true,
      message: "PDF uploaded and indexed successfully.",
      resourceId,
      indexedPages: pages.length
    });

  } catch (error) {
    console.error("ADMIN PDF UPLOAD ERROR:", error);

    // CLEAN UP DATABASE RESOURCE IF CREATED
    if (db && resourceId) {
      await db
        .from("resources")
        .delete()
        .eq("id", resourceId);
    }

    // REMOVE UPLOADED PDF IF SOMETHING FAILED
    if (db && uploadedPath) {
      await db.storage
        .from(bucket)
        .remove([uploadedPath]);
    }

    return json(res, 500, {
      error: error.message || "PDF upload failed."
    });

  } finally {
    // REMOVE TEMPORARY FILE
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}
