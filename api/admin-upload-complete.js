
import { json, supabaseAdmin } from "../lib/supabase.js";
import pdfParse from "pdf-parse";
import JSZip from "jszip";
import mammoth from "mammoth";

const MAX_SIZE = 25 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_BUCKET || "academic-pdfs";

const ALLOWED = new Set([
  "pdf", "ppt", "pptx", "doc", "docx",
  "jpg", "jpeg", "png"
]);

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function decodeXml(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const x = Number(a.match(/slide(\d+)\.xml$/)[1]);
      const y = Number(b.match(/slide(\d+)\.xml$/)[1]);
      return x - y;
    });

  const pages = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("text");
    const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];

    const text = cleanText(
      matches.map(match => decodeXml(match[1])).join(" ")
    );

    if (text) {
      pages.push({
        page_number: i + 1,
        page_text: text
      });
    }
  }

  return pages;
}

async function extractText(buffer, extension) {
  if (extension === "pdf") {
    const result = await pdfParse(buffer);

    return (result.text || "")
      .split(/\f/)
      .map((text, index) => ({
        page_number: index + 1,
        page_text: cleanText(text)
      }))
      .filter(page => page.page_text);
  }

  if (extension === "pptx") {
    return extractPptx(buffer);
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    const paragraphs = (result.value || "")
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);

    const pages = [];
    let chunk = "";

    for (const paragraph of paragraphs) {
      if (chunk && chunk.length + paragraph.length > 3000) {
        pages.push({
          page_number: pages.length + 1,
          page_text: chunk
        });
        chunk = "";
      }

      chunk += (chunk ? " " : "") + paragraph;
    }

    if (chunk) {
      pages.push({
        page_number: pages.length + 1,
        page_text: chunk
      });
    }

    return pages;
  }

  return [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  let db;
  let storagePath;
  let resourceId;

  try {
    if (
      !process.env.ADMIN_API_KEY ||
      req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY
    ) {
      return json(res, 401, { error: "Admin authentication failed." });
    }

    const {
      filename,
      storagePath: submittedPath,
      title,
      department,
      year,
      semester,
      unit,
      subject,
      subjectCode,
      resourceType
    } = req.body || {};

    if (!filename || !submittedPath || !title || !department || !year || !semester) {
      return json(res, 400, { error: "Missing required details." });
    }

    storagePath = submittedPath;

    if (
      typeof storagePath !== "string" ||
      !storagePath.startsWith("uploads/") ||
      storagePath.includes("..") ||
      storagePath.includes("\\")
    ) {
      return json(res, 400, { error: "Invalid storage path." });
    }

    const extension = filename.split(".").pop().toLowerCase();

    if (!ALLOWED.has(extension)) {
      return json(res, 400, { error: "Unsupported file format." });
    }

    db = supabaseAdmin();

    const { data: file, error: downloadError } = await db.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !file) {
      return json(res, 400, { error: "Uploaded file not found." });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!buffer.length || buffer.length > MAX_SIZE) {
      await db.storage.from(BUCKET).remove([storagePath]);
      return json(res, 413, { error: "Maximum file size is 25 MB." });
    }

    const pages = await extractText(buffer, extension);

    const { data: resource, error: resourceError } = await db
      .from("resources")
      .insert({
        title,
        department,
        academic_year: Number(year),
        semester: Number(semester),
        unit: unit || null,
        subject: subject || null,
        subject_code: subjectCode || null,
        resource_type: resourceType || "Study materials",
        original_filename: filename,
        storage_path: storagePath
      })
      .select("id")
      .single();

    if (resourceError) throw resourceError;

    resourceId = resource.id;

    if (pages.length) {
      const rows = pages.map(page => ({
        resource_id: resourceId,
        page_number: page.page_number,
        page_text: page.page_text
      }));

      const { error: pageError } = await db
        .from("resource_pages")
        .insert(rows);

      if (pageError) throw pageError;
    }

    return json(res, 200, {
      success: true,
      message: pages.length
        ? "File uploaded and indexed successfully."
        : "File uploaded. Text indexing is unavailable for this format.",
      resourceId,
      indexedItems: pages.length,
      indexedType:
        extension === "pdf" ? "PDF pages" :
        extension === "pptx" ? "PowerPoint slides" :
        extension === "docx" ? "Word sections" :
        "none"
    });

  } catch (error) {
    console.error("Upload completion error:", error);

    if (db && resourceId) {
      await db.from("resource_pages")
        .delete()
        .eq("resource_id", resourceId);

      await db.from("resources")
        .delete()
        .eq("id", resourceId);
    }

    if (db && storagePath) {
      await db.storage.from(BUCKET).remove([storagePath]);
    }

    return json(res, 500, {
      error: "File processing failed."
    });
  }
}
