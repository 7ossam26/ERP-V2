// start.js boot chain on a FRESH database:
//   fix-server-schema.js → baseline-migrations.js → prisma migrate deploy
//
// Regression focus: on an empty database both pre-migration scripts used to
// abort startup before `migrate deploy` could create the schema, so a new
// deployment crash-looped forever:
//   - fix-server-schema.js created two stray tables, then ran an unguarded
//     ALTER TABLE `purchases` → MySQL 1146 → exit(1);
//   - baseline-migrations.js issued DELETE FROM `_prisma_migrations` for every
//     failed probe while that table did not exist yet → exit(1).
// (Verified end-to-end against a throwaway local MySQL 8 database; these unit
// tests pin the behaviour without needing a database.)

const mockDb = {
  $queryRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $disconnect: jest.fn(),
};
jest.mock("@prisma/client", () => ({ PrismaClient: jest.fn(() => mockDb) }));
jest.mock("child_process", () => ({ execSync: jest.fn() }));

const { execSync } = require("child_process");
const { run: fixServerSchema } = require("../../scripts/fix-server-schema");
const { main: baseline, probes } = require("../../scripts/baseline-migrations");

// Simulated INFORMATION_SCHEMA: `tables` lists what exists; every column of an
// existing table "exists", is nullable and already DECIMAL(18,…).
function schema(tables) {
  const has = (t) => tables.includes(t);
  mockDb.$queryRawUnsafe.mockImplementation(async (sql, ...params) => {
    const table = params[0];
    if (/INFORMATION_SCHEMA\.TABLES/i.test(sql)) {
      const n = has(table) ? 1 : 0;
      return [{ count: n, c: n }];
    }
    if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sql)) {
      const n = has(table) ? 1 : 0;
      if (/IS_NULLABLE/.test(sql)) return n ? [{ IS_NULLABLE: "YES" }] : [];
      if (/NUMERIC_PRECISION/.test(sql)) return n ? [{ NUMERIC_PRECISION: 18 }] : [];
      if (/COLUMN_TYPE/.test(sql)) return n ? [{ COLUMN_TYPE: "enum('X')" }] : [];
      return [{ count: n, c: n }];
    }
    return [{ c: 0, count: 0 }];
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockDb.$executeRawUnsafe.mockResolvedValue(0);
});
afterEach(() => jest.restoreAllMocks());

describe("fix-server-schema.js", () => {
  test("on an empty database it skips repair and executes NO statements", async () => {
    schema([]);
    await expect(fixServerSchema()).resolves.toEqual({ skipped: true });
    expect(mockDb.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  test("on a partially migrated database without `purchases` it also defers to migrations", async () => {
    schema(["employees", "warehouses", "treasuries", "branches", "items"]);
    await expect(fixServerSchema()).resolves.toEqual({ skipped: true });
    expect(mockDb.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  test("on a migrated database it still runs the repairs (behaviour unchanged)", async () => {
    schema([
      "purchases", "purchase_returns", "purchase_return_items", "notifications",
      "orders", "sales", "bulk_payments", "initial_inventory", "sale_items",
      "inventory", "production_order_items", "employee_transactions", "stock_writeoffs",
      "treasuries", "system_configuration", "shifts", "payrolls",
    ]);
    await expect(fixServerSchema()).resolves.toEqual({ skipped: false });
    const sql = mockDb.$executeRawUnsafe.mock.calls.map((c) => c[0]).join("\n");
    expect(sql).toMatch(/ALTER TABLE `purchases`/);
  });
});

describe("baseline-migrations.js", () => {
  test("on an empty database it issues no DELETE and resolves nothing as applied", async () => {
    schema([]);
    mockDb.$queryRaw.mockRejectedValue(new Error("Table '_prisma_migrations' doesn't exist"));
    await expect(baseline()).resolves.toBeUndefined();
    expect(mockDb.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(execSync).not.toHaveBeenCalled();
  });

  test("with `_prisma_migrations` present, a failing probe still deletes its row (behaviour unchanged)", async () => {
    schema(["_prisma_migrations"]);
    mockDb.$queryRaw.mockResolvedValue([]);
    await baseline();
    const deletes = mockDb.$executeRawUnsafe.mock.calls.filter((c) =>
      /DELETE FROM _prisma_migrations/.test(c[0])
    );
    expect(deletes.length).toBeGreaterThan(0);
    expect(deletes.every((c) => Object.keys(probes).includes(c[1]))).toBe(true);
  });
});
