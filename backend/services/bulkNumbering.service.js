// services/bulkNumbering.service.js
// Atomic counter allocation for Bulk POS document numbers (orders, receipts,
// tax invoices). Uses MySQL row-level locking via SELECT ... FOR UPDATE so
// concurrent confirm transactions cannot collide on the same number.
//
// CREDIT_NOTE was a key here until إشعار دائن was removed. It never issued a
// number in production — the counter row sat at 1 — so it is dropped rather
// than kept as a sequence nothing can ask for.
const VALID_KEYS = new Set(["ORDER", "SALES_RECEIPT", "TAX_INVOICE", "PROFORMA"]);

/**
 * Allocate the next number in a sequence inside an existing Prisma transaction.
 * Returns a formatted string like "BULK-0007".
 *
 * @param {object} tx Prisma transaction client
 * @param {'ORDER'|'SALES_RECEIPT'|'TAX_INVOICE'|'PROFORMA'} key
 * @param {{ pad?: number }} [opts] zero-pad width (default 4)
 * @returns {Promise<string>}
 */
async function allocateNumber(tx, key, opts = {}) {
  if (!VALID_KEYS.has(key)) {
    throw new Error(`bulkNumbering: unknown sequence key "${key}"`);
  }
  const pad = opts.pad ?? 4;

  const rows = await tx.$queryRawUnsafe(
    "SELECT `next_value`, `prefix` FROM `bulk_number_sequences` WHERE `key` = ? FOR UPDATE",
    key,
  );
  if (!rows || rows.length === 0) {
    throw new Error(`bulkNumbering: sequence "${key}" not seeded`);
  }
  const current = Number(rows[0].next_value);
  const prefix = rows[0].prefix;

  await tx.$executeRawUnsafe(
    "UPDATE `bulk_number_sequences` SET `next_value` = `next_value` + 1, `updated_at` = NOW(3) WHERE `key` = ?",
    key,
  );

  return `${prefix}${String(current).padStart(pad, "0")}`;
}

module.exports = { allocateNumber };
