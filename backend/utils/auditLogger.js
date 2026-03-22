/**
 * Audit Logger — append-only writes with HMAC integrity signing.
 *
 * Each record is signed with HMAC-SHA256 over its core identity fields
 * (action, entity, targetId, userId, branchId, timestamp).
 * The oldValues / newValues are stored separately and are NOT part of the
 * hash payload — they are large and subject to JSON key reordering by MySQL,
 * which would cause spurious hash mismatches on verification.
 *
 * The application DB user should have INSERT + SELECT only on audit_logs.
 * No route exposes DELETE or UPDATE on this table.
 */
const crypto = require("crypto");
const prisma  = require("../config/database");

const REDACTED_EXACT  = new Set(["pin", "hash", "rowhash", "row_hash"]);
const REDACTED_SUBSTR = ["password", "token", "secret"];

const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "erp_audit_default_secret_change_me";

/**
 * Remove sensitive keys from an object — recursively handles nested objects and arrays.
 * Catches exact matches (pin, hash) AND any key that contains "password", "token", "secret".
 */
function isSensitiveKey(k) {
  const lower = k.toLowerCase();
  return REDACTED_EXACT.has(lower) || REDACTED_SUBSTR.some((s) => lower.includes(s));
}

function redact(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => redact(item));
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitiveKey(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object") {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Compute HMAC over core identity fields only (not JSON blobs).
 * Payload: action|targetEntity|targetId|userId|branchId|createdAt(ISO)
 */
function computeHash({ action, targetEntity, targetId, userId, branchId, createdAt }) {
  const payload = [
    action        ?? "",
    targetEntity  ?? "",
    targetId      ?? "",
    userId        ?? "",
    branchId      ?? "",
    createdAt instanceof Date ? createdAt.toISOString() : (createdAt ?? ""),
  ].join("|");

  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Write a single audit record.
 *
 * @param {object} opts
 * @param {string}       opts.action       - CREATE | UPDATE | DELETE | LOGIN | LOGOUT | APPROVE | ...
 * @param {string}       opts.targetEntity - e.g. "sale", "shift", "treasury"
 * @param {string|null}  opts.targetId
 * @param {number|null}  opts.userId
 * @param {number|null}  opts.branchId
 * @param {object|null}  opts.newValues    - request body / new state (will be redacted)
 * @param {object|null}  opts.oldValues    - DB state before mutation
 * @param {string|null}  opts.ipAddress
 */
async function writeAudit({ action, targetEntity, targetId, userId, branchId, newValues, oldValues, ipAddress }) {
  try {
    const now          = new Date();
    const cleanedNew   = redact(newValues);
    const cleanedOld   = redact(oldValues);

    const rowHash = computeHash({
      action,
      targetEntity,
      targetId:  String(targetId  ?? ""),
      userId:    userId   ?? null,
      branchId:  branchId ?? null,
      createdAt: now,
    });

    await prisma.auditLog.create({
      data: {
        action:       action.substring(0, 20),
        targetEntity: targetEntity.substring(0, 60),
        targetId:     targetId != null ? String(targetId).substring(0, 40) : null,
        userId:       userId    ?? null,
        branchId:     branchId  ?? null,
        details:      cleanedNew ? JSON.stringify(cleanedNew) : undefined,   // "new values" / request body
        oldValues:    cleanedOld ? JSON.stringify(cleanedOld) : undefined,   // "old values" / before state
        ipAddress:    ipAddress  ?? null,
        rowHash,
        createdAt:    now,
      },
    });
  } catch (err) {
    console.error("[AUDIT] Failed to write audit log:", err.message);
  }
}

module.exports = { writeAudit };
