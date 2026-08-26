/**
 * Single source of truth for employee transaction types (HR).
 *
 * These MUST stay identical to the `enum TransactionType` block in
 * `prisma/schema.prisma`. The test `tests/unit/employeeTransactionTypeEnum.test.js`
 * parses the schema and fails CI if the two ever drift apart.
 *
 * Order matches schema.prisma exactly, and the drift test checks it. That is not
 * cosmetic: MySQL stores ENUM values by ORDINAL, so appending a value at the end
 * is free, but inserting or reordering one silently rewrites the meaning of every
 * existing `employee_transactions` row. Never reorder — only append.
 *
 * The three sets below are what the routes actually branch on. Historically
 * `routes/employees.js` compared against the literal "ADVANCE" in seven places
 * and treated *anything else* as a deduction, which meant an unrecognised type
 * was silently written as a خصم. Import from here instead of re-hardcoding.
 */

const TRANSACTION_TYPES = ["ADVANCE", "DEDUCTION", "OVERTIME", "BONUS"];

const TRANSACTION_TYPE_SET = new Set(TRANSACTION_TYPES);

// Types that physically move cash out of a branch treasury the moment they are
// recorded. These are the only ones the shift drawer knows about.
const CASH_OUT_TYPES = new Set(["ADVANCE"]);

// Types that REDUCE the month's net salary.
const SUBTRACTIVE_TYPES = new Set(["ADVANCE", "DEDUCTION"]);

// Types that INCREASE it. These are accruals only: no cash moves when they are
// recorded, they are settled together with the salary at payout.
const ADDITIVE_TYPES = new Set(["OVERTIME", "BONUS"]);

function isValidTransactionType(type) {
  return TRANSACTION_TYPE_SET.has(type);
}

function isCashOutType(type) {
  return CASH_OUT_TYPES.has(type);
}

function isAdditiveType(type) {
  return ADDITIVE_TYPES.has(type);
}

// Builds the MySQL ENUM(...) definition for `employee_transactions`.`type`,
// used by the idempotent schema repair in scripts/fix-server-schema.js.
function buildTransactionTypeEnumSql() {
  return `ENUM(${TRANSACTION_TYPES.map((t) => `'${t}'`).join(",")})`;
}

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_SET,
  CASH_OUT_TYPES,
  SUBTRACTIVE_TYPES,
  ADDITIVE_TYPES,
  isValidTransactionType,
  isCashOutType,
  isAdditiveType,
  buildTransactionTypeEnumSql,
};
