// Drift guard: the canonical TRANSACTION_TYPES registry
// (config/employeeTransactionTypes.js) MUST match the `enum TransactionType`
// block in prisma/schema.prisma, value-for-value and in order. If they diverge,
// a type can be offered in the HR menu but rejected by the DB enum (a truncation
// 500) — the same class of production bug moduleEnum.test.js guards against.

const fs = require("fs");
const path = require("path");
const {
  TRANSACTION_TYPES,
} = require("../../config/employeeTransactionTypes");

function parseSchemaTransactionTypeEnum() {
  const schemaPath = path.join(__dirname, "../../prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");

  const match = schema.match(/enum\s+TransactionType\s*\{([\s\S]*?)\}/);
  if (!match) {
    throw new Error("Could not find `enum TransactionType` in schema.prisma");
  }

  return match[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim()) // strip comments
    .filter((line) => /^[A-Z0-9_]+$/.test(line));
}

describe("employee transaction type enum ↔ registry", () => {
  const schemaValues = parseSchemaTransactionTypeEnum();

  test("registry has no duplicate types", () => {
    expect(new Set(TRANSACTION_TYPES).size).toBe(TRANSACTION_TYPES.length);
  });

  test("registry exactly matches schema.prisma enum TransactionType (same values, same order)", () => {
    expect(TRANSACTION_TYPES).toEqual(schemaValues);
  });

  // MySQL stores ENUM values by ordinal. ADVANCE and DEDUCTION were positions 1
  // and 2 in the original DDL and every historical row is stored as that
  // ordinal — reordering them would silently reinterpret existing data.
  test("ADVANCE and DEDUCTION keep their original leading positions", () => {
    expect(TRANSACTION_TYPES.slice(0, 2)).toEqual(["ADVANCE", "DEDUCTION"]);
  });
});
