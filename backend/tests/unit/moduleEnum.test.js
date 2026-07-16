// Drift guard: the canonical MODULE_CODES registry (config/modules.js) MUST
// match the `enum Module` block in prisma/schema.prisma, value-for-value and in
// order. If they diverge, a module can be toggled in the UI but rejected by the
// DB enum (a truncation 500) — exactly the production bug this suite prevents
// from recurring.

const fs = require("fs");
const path = require("path");
const { MODULE_CODES } = require("../../config/modules");

function parseSchemaModuleEnum() {
  const schemaPath = path.join(__dirname, "../../prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");

  const match = schema.match(/enum\s+Module\s*\{([\s\S]*?)\}/);
  if (!match) throw new Error("Could not find `enum Module` in schema.prisma");

  return match[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim()) // strip comments
    .filter((line) => /^[A-Z0-9_]+$/.test(line));
}

describe("permissions module enum ↔ registry", () => {
  const schemaValues = parseSchemaModuleEnum();

  test("registry has no duplicate codes", () => {
    expect(new Set(MODULE_CODES).size).toBe(MODULE_CODES.length);
  });

  test("registry exactly matches schema.prisma enum Module (same values, same order)", () => {
    expect(MODULE_CODES).toEqual(schemaValues);
  });
});
