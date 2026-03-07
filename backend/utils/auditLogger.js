/**
 * Audit Logger — HMAC-protected append-only writes
 *
 * Each audit record is signed with HMAC-SHA256 using AUDIT_HMAC_SECRET.
 * Tampering with any field in a row invalidates its hash, making
 * modifications detectable via the integrity-check endpoint.
 *
 * The application DB user should have INSERT + SELECT only on audit_logs.
 * No route exposes DELETE or UPDATE on this table.
 */
const crypto = require("crypto");
const prisma  = require("../config/database");

// Fields that should never appear in audit details (redacted)
const REDACTED_KEYS = new Set(["password", "token", "secret", "pin", "hash"]);

const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "erp_audit_default_secret_change_me";

/**
 * Remove sensitive keys from an object (shallow).
 */
function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

/**
 * Compute HMAC for a row. The signed payload is deterministic:
 *   action|targetEntity|targetId|userId|branchId|createdAt|JSON(details)
 *
 * If anyone modifies these fields in the DB, the stored hash will no longer
 * match what we recompute, and verifyIntegrity() will flag it.
 */
function computeHash({ action, targetEntity, targetId, userId, branchId, createdAt, details }) {
  const payload = [
    action,
    targetEntity,
    targetId    ?? "",
    userId      ?? "",
    branchId    ?? "",
    createdAt   instanceof Date ? createdAt.toISOString() : (createdAt ?? ""),
    JSON.stringify(details ?? null),
  ].join("|");

  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Write a single audit record. Fire-and-forget safe — errors are logged
 * but never thrown to the caller.
 *
 * @param {object} opts
 * @param {string}  opts.action       - CREATE | UPDATE | DELETE | LOGIN | LOGOUT
 * @param {string}  opts.targetEntity - e.g. "sale", "shift", "treasury"
 * @param {string|number|null} opts.targetId
 * @param {number|null}  opts.userId
 * @param {number|null}  opts.branchId
 * @param {object|null}  opts.details  - request body / diff (will be redacted)
 * @param {string|null}  opts.ipAddress
 */
async function writeAudit({ action, targetEntity, targetId, userId, branchId, details, ipAddress }) {
  try {
    const now     = new Date();
    const cleaned = redact(details);
    const rowHash = computeHash({
      action,
      targetEntity,
      targetId:  String(targetId  ?? ""),
      userId:    userId   ?? null,
      branchId:  branchId ?? null,
      createdAt: now,
      details:   cleaned,
    });

    await prisma.auditLog.create({
      data: {
        action:       action.substring(0, 20),
        targetEntity: targetEntity.substring(0, 60),
        targetId:     targetId != null ? String(targetId).substring(0, 40) : null,
        userId:       userId   ?? null,
        branchId:     branchId ?? null,
        details:      cleaned  ?? undefined,
        ipAddress:    ipAddress ?? null,
        rowHash,
        createdAt:    now,
      },
    });
  } catch (err) {
    // Never crash the main request — just log
    console.error("[AUDIT] Failed to write audit log:", err.message);
  }
}

/**
 * Verify integrity of all audit records (or a date range).
 * Returns { total, tampered: [ { id, reason } ] }
 */
async function verifyIntegrity({ from, to } = {}) {
  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(to);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true, action: true, targetEntity: true, targetId: true,
      userId: true, branchId: true, details: true, createdAt: true, rowHash: true,
    },
  });

  const tampered = [];
  for (const log of logs) {
    if (!log.rowHash) {
      // Row predates hash column — skip
      continue;
    }
    const expected = computeHash({
      action:       log.action,
      targetEntity: log.targetEntity,
      targetId:     String(log.targetId ?? ""),
      userId:       log.userId   ?? null,
      branchId:     log.branchId ?? null,
      createdAt:    log.createdAt,
      details:      log.details,
    });
    if (expected !== log.rowHash) {
      tampered.push({ id: log.id, reason: "hash_mismatch" });
    }
  }

  return { total: logs.length, tampered };
}

module.exports = { writeAudit, verifyIntegrity };
