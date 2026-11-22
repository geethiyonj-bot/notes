
import crypto from "crypto";
import { supabaseAdmin, json } from "../lib/supabase.js";

const MAX_SIZE = 25 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_BUCKET || "academic-pdfs";

const MIME_TYPES = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";
import { supabaseAdmin, json } from "../lib/supabase.js";

export const config = {
  api: { bodyParser: false }
};

const MAX_SIZE = 25 * 1024 * 1024;

const ALLOWED = new Set([
  "pdf", "ppt", "pptx", "doc", "docx",
  "jpg", "jpeg", "png"
]);

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: MAX_SIZE,
      maxFiles: 1,
      multiples: false
    });

    form.parse(req, (error, fields, files) => {
      if (error) return reject(error);
      resolve({ fields, files });
    });
  });
}

function value(item) {
  return Array.isArray(item) ? item[0] : item;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  let tempFile;

  try {
    if (
      !process.env.ADMIN_API_KEY ||
      req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY
    ) {
      return json(res, 401, { error: "Admin authentication failed." });
    }

    const { fields, files } = await parseForm(req);
    const file = value(files.file || files.pdf);

    if (!file) {
      return json(res, 400, { error: "Please select a file." });
    }

    tempFile = file.filepath;

    const filename = file.originalFilename || "upload";
    const extension = path.extname(filename).slice(1).toLowerCase();

    if (!ALLOWED.has(extension)) {
      return json(res, 400, { error: "Unsupported file format." });
    }

    const buffer = fs.readFileSync(tempFile);

    const db = supabaseAdmin();
    const bucket = process.env.SUPABASE_BUCKET || "academic-pdfs";

    const storagePath =
      `uploads/${Date.now()}-${path.basename(filename)}`;

    const contentTypes = {
      pdf: "application/pdf",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png"
    };

    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: contentTypes[extension],
        upsert: false
      });

    if (uploadError) throw uploadError;

    return json(res, 200, {
      success: true,
      message: "File uploaded.",
      storagePath,
      filename,
      metadata: {
        title: value(fields.title),
        department: value(fields.department),
        year: value(fields.year),
        semester: value(fields.semester),
        unit: value(fields.unit),
        subject: value(fields.subject),
        subjectCode: value(fields.subjectCode),
        resourceType: value(fields.resourceType)
      }
    });

  } catch (error) {
    console.error("Upload error:", error);
    return json(res, 500, {
      error: error.message || "Upload failed."
    });
  } finally {
    if (tempFile) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }
}

  png: "image/png"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const adminKey = req.headers["x-admin-key"];

    if (
      !process.env.ADMIN_API_KEY ||
      adminKey !== process.env.ADMIN_API_KEY
    ) {
      return json(res, 401, {
        error: "Admin authentication failed."
      });
    }

    const {
      filename,
      size,
      title,
      department,
      year,
      semester,
      unit,
      subject,
      subjectCode,
      resourceType
    } = req.body || {};

    if (!filename || !title || !department || !year || !semester || !size) {
      return json(res, 400, {
        error: "Please provide all required file and academic details."
      });
    }

    if (!Number.isFinite(Number(size)) || Number(size) <= 0 || Number(size) > MAX_SIZE) {
      return json(res, 413, {
        error: "File size must be between 1 byte and 25 MB."
      });
    }

    const extension = filename.split(".").pop().toLowerCase();
    const contentType = MIME_TYPES[extension];

    if (!contentType) {
      return json(res, 400, {
        error: "Unsupported file format. Use PDF, PPT, PPTX, DOC, DOCX, JPG, JPEG or PNG."
      });
    }

    const safeExtension = extension;
    const storagePath = `uploads/${crypto.randomUUID()}.${safeExtension}`;

    const db = supabaseAdmin();

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) throw error;

    return json(res, 200, {
      success: true,
      storagePath: data.path || storagePath,
      token: data.token,
      contentType,
      metadata: {
        filename,
        title,
        department,
        year,
        semester,
        unit: unit || "",
        subject: subject || "",
        subjectCode: subjectCode || "",
        resourceType: resourceType || "Study materials"
      }
    });

  } catch (error) {
    console.error("Upload URL error:", error);

    return json(res, 500, {
      error: "Could not create secure upload link."
    });
  }
}
