/**
 * Single source of truth for permission "module" codes.
 *
 * These MUST stay identical to the `enum Module` block in
 * `prisma/schema.prisma`. The test `tests/unit/moduleEnum.test.js` parses the
 * schema and fails CI if the two ever drift apart.
 *
 * Anything that needs the canonical list — the boot-time enum repair
 * (`scripts/fix-server-schema.js`), the permission-update validation
 * (`routes/superadmin.js`), etc. — imports it from here instead of
 * re-hardcoding it. This is what prevents the multi-place drift that caused the
 * production 500 on `PUT /superadmin/roles/:id/permissions`.
 *
 * Order matches schema.prisma exactly (the drift test checks order too).
 */

const MODULE_CODES = [
  // --- Module Access Permissions ---
  "HR",
  "INVENTORY",
  "INVENTORY_COUNT",
  "STOCK_TRANSFER",
  "POS",
  "PURCHASES",
  "SALES",
  "REPORTS",
  "TREASURIES",
  "CASH_TRANSFER",
  "TRANSFER_MANAGEMENT",
  "WAREHOUSE_TRANSFER_MANAGEMENT",
  "BRANCHES",
  "EMPLOYEES",
  "CLIENTS",
  "SUPPLIERS",
  "SUPPLIER_ACCOUNTS",
  "CATEGORIES",
  "ITEMS",
  "WAREHOUSES",
  "SETTINGS",
  "EXPENSES",
  "SHIFTS",
  "DELIVERY_SETTLEMENT",

  // --- Creation Permissions (CREATES) ---
  "CREATES_WAREHOUSES",
  "CREATES_EMPLOYEES",
  "CREATES_SUPPLIERS",
  "CREATES_CLIENTS",
  "CREATES_CATEGORIES",
  "CREATES_ITEMS",
  "CREATES_TREASURIES",
  "CREATES_BRANCHES",

  "DEPOSITS",
  "CREATES_DEPOSITS",
  "WITHDRAWALS",
  "CREATES_WITHDRAWALS",
  "DELIVERY_MEN",
  "CREATES_DELIVERY_MEN",
  "DELIVERY_ZONES",
  "CREATES_DELIVERY_ZONES",
  "CREATES_PRODUCTION",
  "PRODUCTION",

  "INITIAL_INVENTORY",
  "CALL_CENTER",

  // --- Bulk POS (B2B wholesale) module permissions ---
  "BULK_POS",
  "BULK_CUSTOMERS",
  "BULK_PRICING",
  "BULK_CREDIT",
  "BULK_REPORTS",
];

const MODULE_CODE_SET = new Set(MODULE_CODES);

/** True if `code` is a known permission module. */
function isValidModule(code) {
  return MODULE_CODE_SET.has(code);
}

/**
 * Builds the SQL ENUM(...) type literal for `permissions.module`, e.g.
 * "ENUM('HR','INVENTORY',...)". Used by the idempotent, superset-only enum
 * repair in scripts/fix-server-schema.js. Never emits a DELETE — enlarging an
 * ENUM to a superset preserves every existing row.
 */
function buildModuleEnumSql() {
  return `ENUM(${MODULE_CODES.map((c) => `'${c}'`).join(",")})`;
}

module.exports = {
  MODULE_CODES,
  MODULE_CODE_SET,
  isValidModule,
  buildModuleEnumSql,
};
