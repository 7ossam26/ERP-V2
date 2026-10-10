// prisma/seed.js — superadmin bootstrap rules.
//
// Regression focus: the seed used to fall back to a hardcoded default
// password and upserted the superadmin on EVERY run — resetting its password,
// re-activating it and re-assigning its role. Combined with the (now removed)
// unauthenticated GET /api/setup-seed, anyone could reset the superadmin to a
// publicly known password. Now:
//   - there is no default password;
//   - ADMIN_PASSWORD is validated BEFORE anything is written;
//   - an existing superadmin is never modified unless --reset-admin-password
//     is passed explicitly, and then only its password changes.

const mockDb = {};
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockDb),
}));

const bcrypt = require("bcryptjs");
const seedMain = require("../../prisma/seed");
const { MIN_ADMIN_PASSWORD_LENGTH } = seedMain;

const STRONG = "x".repeat(MIN_ADMIN_PASSWORD_LENGTH) + "-Strong1";

function resetDb({ existingSuperadmin = null } = {}) {
  let nextId = 100;
  const create = () => jest.fn(async ({ data }) => ({ id: nextId++, ...data }));
  Object.assign(mockDb, {
    role: { upsert: jest.fn(async ({ create: c }) => ({ id: nextId++, ...c })) },
    permission: { upsert: jest.fn(async () => ({})) },
    branch: { findFirst: jest.fn(async () => null), create: create() },
    warehouse: { findFirst: jest.fn(async () => null), create: create() },
    treasury: { findFirst: jest.fn(async () => null), create: create() },
    systemConfiguration: { findFirst: jest.fn(async () => null), create: create(), update: jest.fn() },
    client: { findUnique: jest.fn(async () => null), create: create(), update: jest.fn() },
    supplier: { findFirst: jest.fn(async () => null), create: create() },
    user: {
      findUnique: jest.fn(async () => existingSuperadmin),
      create: create(),
      update: jest.fn(async ({ where, data }) => ({ ...where, ...data })),
      upsert: jest.fn(),
    },
    $disconnect: jest.fn(),
  });
}

const anyWrites = () =>
  [
    mockDb.role.upsert,
    mockDb.permission.upsert,
    mockDb.branch.create,
    mockDb.warehouse.create,
    mockDb.treasury.create,
    mockDb.systemConfiguration.create,
    mockDb.client.create,
    mockDb.supplier.create,
    mockDb.user.create,
    mockDb.user.update,
    mockDb.user.upsert,
  ].some((fn) => fn.mock.calls.length > 0);

const savedEnv = { ...process.env };
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_USERNAME;
});
afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...savedEnv };
});

describe("fresh database (no superadmin yet)", () => {
  test("refuses to run without ADMIN_PASSWORD and writes nothing", async () => {
    resetDb();
    await expect(seedMain()).rejects.toThrow(/ADMIN_PASSWORD is not set/);
    expect(anyWrites()).toBe(false);
  });

  test("refuses a short ADMIN_PASSWORD and writes nothing", async () => {
    resetDb();
    process.env.ADMIN_PASSWORD = "Short1!pw"; // 9 chars, like the old default
    await expect(seedMain()).rejects.toThrow(/at least 12 characters/);
    expect(anyWrites()).toBe(false);
  });

  test("creates the superadmin with a bcrypt hash of ADMIN_PASSWORD", async () => {
    resetDb();
    process.env.ADMIN_PASSWORD = STRONG;
    await seedMain();

    expect(mockDb.user.create).toHaveBeenCalledTimes(1);
    const { data } = mockDb.user.create.mock.calls[0][0];
    expect(data.username).toBe("superadmin");
    expect(data.password).not.toBe(STRONG);
    expect(await bcrypt.compare(STRONG, data.password)).toBe(true);
    expect(data).toMatchObject({ isActive: true, hasSensitiveAccess: true });
    expect(mockDb.user.upsert).not.toHaveBeenCalled();
  });

  test("honours ADMIN_USERNAME", async () => {
    resetDb();
    process.env.ADMIN_PASSWORD = STRONG;
    process.env.ADMIN_USERNAME = "owner";
    await seedMain();
    expect(mockDb.user.create.mock.calls[0][0].data.username).toBe("owner");
  });
});

describe("existing superadmin", () => {
  const existing = { id: 1 };

  test("is left completely untouched on a normal run, even with ADMIN_PASSWORD set", async () => {
    resetDb({ existingSuperadmin: existing });
    process.env.ADMIN_PASSWORD = STRONG;
    await seedMain();
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockDb.user.create).not.toHaveBeenCalled();
    expect(mockDb.user.upsert).not.toHaveBeenCalled();
  });

  test("does not need ADMIN_PASSWORD on a normal run (idempotent re-seed)", async () => {
    resetDb({ existingSuperadmin: existing });
    await expect(seedMain()).resolves.toBeUndefined();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  test("explicit reset without ADMIN_PASSWORD fails before writing anything", async () => {
    resetDb({ existingSuperadmin: existing });
    await expect(seedMain({ resetAdminPassword: true })).rejects.toThrow(/required to reset/);
    expect(anyWrites()).toBe(false);
  });

  test("explicit reset changes ONLY the password", async () => {
    resetDb({ existingSuperadmin: existing });
    process.env.ADMIN_PASSWORD = STRONG;
    await seedMain({ resetAdminPassword: true });

    expect(mockDb.user.update).toHaveBeenCalledTimes(1);
    const { where, data } = mockDb.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: 1 });
    expect(Object.keys(data)).toEqual(["password"]);
    expect(await bcrypt.compare(STRONG, data.password)).toBe(true);
  });
});

test("seed.js contains no hardcoded fallback password", () => {
  const src = require("fs").readFileSync(require.resolve("../../prisma/seed"), "utf8");
  expect(src).not.toMatch(/ADMIN_PASSWORD\s*(\|\||\?\?)/);
});
