const fs = require("fs");
const path = require("path");

const LOGO_DIR = path.resolve(__dirname, "../uploads/logos");
const MAX_FILE_SIZE_BYTES = 500 * 1024;
const ALLOWED_MIME_TYPES = ["image/png", "image/svg+xml"];

function ensureLogoDirectory() {
  if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
  }
}

function fileNameForUpload(originalName, mimeType) {
  const extension = mimeType === "image/svg+xml" ? "svg" : "png";
  const safeBase = path
    .basename(originalName || "logo", path.extname(originalName || ""))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "logo";

  return `${safeBase}-${Date.now()}.${extension}`;
}

function parsePngDimensions(buffer) {
  if (!buffer || buffer.length < 24) {
    return null;
  }

  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseSvgDimensions(buffer) {
  const source = buffer.toString("utf8");
  const widthMatch = source.match(/\bwidth=["']([\d.]+)(px)?["']/i);
  const heightMatch = source.match(/\bheight=["']([\d.]+)(px)?["']/i);
  const viewBoxMatch = source.match(/\bviewBox=["'][^"']*?([\d.]+)[ ,]+([\d.]+)["']/i);

  const width = widthMatch ? parseFloat(widthMatch[1]) : null;
  const height = heightMatch ? parseFloat(heightMatch[1]) : null;

  if (width && height) {
    return { width, height };
  }

  if (viewBoxMatch) {
    return {
      width: parseFloat(viewBoxMatch[1]),
      height: parseFloat(viewBoxMatch[2]),
    };
  }

  return null;
}

function isSquareish(dimensions) {
  if (!dimensions || !dimensions.width || !dimensions.height) {
    return false;
  }

  const ratio =
    dimensions.width > dimensions.height
      ? dimensions.width / dimensions.height
      : dimensions.height / dimensions.width;

  return ratio <= 1.25;
}

function validateLogoFile(file) {
  if (!file) {
    return "ملف الشعار مطلوب";
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return "نوع الشعار غير مدعوم. المسموح فقط PNG أو SVG";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "حجم الشعار يجب ألا يتجاوز 500 كيلوبايت";
  }

  const dimensions =
    file.mimetype === "image/svg+xml"
      ? parseSvgDimensions(file.buffer)
      : parsePngDimensions(file.buffer);

  if (!dimensions) {
    return "تعذر قراءة أبعاد الشعار. استخدم ملف PNG أو SVG صالح";
  }

  if (!isSquareish(dimensions)) {
    return "الشعار يجب أن يكون قريبًا من الشكل المربع";
  }

  return null;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  LOGO_DIR,
  MAX_FILE_SIZE_BYTES,
  ensureLogoDirectory,
  fileNameForUpload,
  validateLogoFile,
};
