/**
 * ERP-V2 Desktop — Offline License Validation
 *
 * File-based license key storage and validation.
 * License key format: XXXX-XXXX-XXXX-XXXX
 * Validation uses HMAC-SHA256 checksum on first 3 segments.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LICENSE_SECRET = "kikotech-erp-license-v1-2026";
const LICENSE_FILE = () =>
  path.join(process.env.ERP_USER_DATA || "", "license.key");

/**
 * Validate a license key format and checksum.
 */
function validateLicense(key) {
  if (!key || typeof key !== "string") {
    return { valid: false, reason: "No license key provided" };
  }

  const trimmed = key.trim().toUpperCase();
  const parts = trimmed.split("-");

  if (parts.length !== 4 || parts.some((p) => p.length !== 4)) {
    return { valid: false, reason: "Invalid key format" };
  }

  // Checksum: HMAC-SHA256 of first 3 segments, take first 4 chars
  const payload = parts.slice(0, 3).join("-");
  const expectedChecksum = crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 4)
    .toUpperCase();

  if (parts[3] !== expectedChecksum) {
    return { valid: false, reason: "Invalid license key" };
  }

  return { valid: true, key: trimmed };
}

/**
 * Save a license key to file.
 */
function saveLicense(key) {
  const result = validateLicense(key);
  if (!result.valid) return result;

  fs.writeFileSync(LICENSE_FILE(), result.key, "utf-8");
  return { valid: true, saved: true };
}

/**
 * Read the stored license key.
 */
function getLicenseKey() {
  try {
    const filePath = LICENSE_FILE();
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return null;
  }
}

/**
 * Check if the current stored license is valid.
 */
function isLicenseValid() {
  const key = getLicenseKey();
  if (!key) return false;
  return validateLicense(key).valid;
}

/**
 * Remove the stored license.
 */
function removeLicense() {
  try {
    const filePath = LICENSE_FILE();
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  validateLicense,
  saveLicense,
  getLicenseKey,
  isLicenseValid,
  removeLicense,
};
