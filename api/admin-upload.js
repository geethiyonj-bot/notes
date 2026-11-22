
import crypto from "crypto";
import path from "path";
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
  png: "image/png"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Method not allowed."
    });
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

    if (
      !filename ||
      !title ||
      !department ||
      !year ||
      !semester ||
      size === undefined
    ) {
      return json(res, 400, {
        error: "Please provide all required file and academic details."
      });
    }

    if (
      !Number.isFinite(Number(size)) ||
      Number(size) <= 0 ||
      Number(size) > MAX_SIZE
    ) {
      return json(res, 413, {
        error: "File size must be between 1 byte and 25 MB."
      });
    }

    const extension = path.extname(filename).slice(1).toLowerCase();
    const contentType = MIME_TYPES[extension];

    if (!contentType) {
      return json(res, 400, {
        error: "Unsupported format. Use PDF, PPT, PPTX, DOC, DOCX, JPG, JPEG or PNG."
      });
    }

    const storagePath =
      `uploads/${crypto.randomUUID()}.${extension}`;

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
      error: error.message || "Could not create secure upload link."
    });
  }
}
