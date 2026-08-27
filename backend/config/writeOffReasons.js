/**
 * Single source of truth for stock write-off (إهلاك) reasons.
 *
 * These MUST stay identical to the `enum StockWriteOffReason` block in
 * `prisma/schema.prisma`. The test `tests/unit/writeOffReasonEnum.test.js`
 * parses the schema and fails CI if the two ever drift apart.
 *
 * Order matches schema.prisma exactly, and the drift test checks it. That is not
 * cosmetic: MySQL stores ENUM values by ORDINAL, so appending a value at the end
 * is free, but inserting or reordering one silently rewrites the meaning of
 * every existing `stock_writeoffs` row. Never reorder — only append.
 *
 * The Arabic labels live here too so the frontend reads them from
 * `GET /api/stock-writeoffs/reasons` instead of hardcoding a second copy that
 * can drift out of step with the enum.
 */

const WRITE_OFF_REASONS = [
  // Consumed internally and never sold — tissues, bags, cleaning supplies. This
  // is the case the feature was built for: without it the purchase cost of a
  // consumable is recognised NOWHERE (see routes/reports.js).
  "INTERNAL_USE",
  // Broken, spoiled, or otherwise destroyed sellable stock.
  "DAMAGED",
  "EXPIRED",
  // Physical count came in under the system quantity.
  "COUNT_VARIANCE",
  "OTHER",
];

const WRITE_OFF_REASON_SET = new Set(WRITE_OFF_REASONS);

const WRITE_OFF_REASON_LABELS = {
  INTERNAL_USE: "استهلاك داخلي",
  DAMAGED: "تالف",
  EXPIRED: "منتهي الصلاحية",
  COUNT_VARIANCE: "فرق جرد",
  OTHER: "أخرى",
};

/** True if `reason` is a known write-off reason. */
function isValidWriteOffReason(reason) {
  return WRITE_OFF_REASON_SET.has(reason);
}

/** `[{ code, label }]` — the payload `GET /stock-writeoffs/reasons` returns. */
function listWriteOffReasons() {
  return WRITE_OFF_REASONS.map((code) => ({
    code,
    label: WRITE_OFF_REASON_LABELS[code],
  }));
}

/**
 * Builds the SQL ENUM(...) type literal for `stock_writeoffs`.`reason`, used by
 * the idempotent, superset-only enum repair in scripts/fix-server-schema.js.
 * Never emits a DELETE — enlarging an ENUM to a superset preserves every row.
 */
function buildWriteOffReasonEnumSql() {
  return `ENUM(${WRITE_OFF_REASONS.map((r) => `'${r}'`).join(",")})`;
}

module.exports = {
  WRITE_OFF_REASONS,
  WRITE_OFF_REASON_SET,
  WRITE_OFF_REASON_LABELS,
  isValidWriteOffReason,
  listWriteOffReasons,
  buildWriteOffReasonEnumSql,
};
