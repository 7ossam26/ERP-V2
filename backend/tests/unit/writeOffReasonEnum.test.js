// Drift guard: the canonical WRITE_OFF_REASONS registry (config/writeOffReasons.js)
// MUST match the `enum StockWriteOffReason` block in prisma/schema.prisma,
// value-for-value and in order.
//
// Order matters for the same reason it does in moduleEnum.test.js: MySQL stores
// ENUM values by ORDINAL, so appending is free but inserting or reordering
// silently rewrites the meaning of every existing `stock_writeoffs` row. A
// registry that has drifted from the schema also means the boot-time widen in
// scripts/fix-server-schema.js would emit an enum the DB then rejects on insert.

const fs = require("fs");
const path = require("path");
const {
  WRITE_OFF_REASONS,
  WRITE_OFF_REASON_LABELS,
  isValidWriteOffReason,
  buildWriteOffReasonEnumSql,
} = require("../../config/writeOffReasons");

function parseSchemaWriteOffReasonEnum() {
  const schemaPath = path.join(__dirname, "../../prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");

  const match = schema.match(/enum\s+StockWriteOffReason\s*\{([\s\S]*?)\}/);
  if (!match) {
    throw new Error("Could not find `enum StockWriteOffReason` in schema.prisma");
  }

  return match[1]
    .split("\n")
    // No `$` anchor: the file is CRLF, and `.` does not match the trailing `\r`,
    // so an anchored pattern silently fails to strip the Arabic label off
    // `INTERNAL_USE // استهلاك داخلي` and the value is dropped entirely.
    .map((line) => line.replace(/\/\/.*/, "").trim())
    .filter((line) => /^[A-Z0-9_]+$/.test(line));
}

describe("stock write-off reason enum ↔ registry", () => {
  const schemaValues = parseSchemaWriteOffReasonEnum();

  test("registry has no duplicate reasons", () => {
    expect(new Set(WRITE_OFF_REASONS).size).toBe(WRITE_OFF_REASONS.length);
  });

  test("registry exactly matches schema.prisma (same values, same order)", () => {
    expect(WRITE_OFF_REASONS).toEqual(schemaValues);
  });

  test("every reason has an Arabic label for the UI", () => {
    for (const code of WRITE_OFF_REASONS) {
      expect(typeof WRITE_OFF_REASON_LABELS[code]).toBe("string");
      expect(WRITE_OFF_REASON_LABELS[code].length).toBeGreaterThan(0);
    }
  });

  test("isValidWriteOffReason accepts known codes and rejects everything else", () => {
    expect(isValidWriteOffReason("INTERNAL_USE")).toBe(true);
    expect(isValidWriteOffReason("DAMAGED")).toBe(true);
    expect(isValidWriteOffReason("NOT_A_REASON")).toBe(false);
    expect(isValidWriteOffReason("")).toBe(false);
    expect(isValidWriteOffReason(undefined)).toBe(false);
  });

  test("buildWriteOffReasonEnumSql emits the full superset used by fix-server-schema", () => {
    const sql = buildWriteOffReasonEnumSql();
    expect(sql.startsWith("ENUM(")).toBe(true);
    for (const code of WRITE_OFF_REASONS) {
      expect(sql).toContain(`'${code}'`);
    }
  });
});
