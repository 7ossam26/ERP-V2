// Returns are visible/reachable to any SALES/POS/PURCHASES user (an employee
// prepares a return: search the sale, pick items, review). The real gate is
// verifyManagerApproval() on the manager credentials collected at the final
// confirm step — it previously only asserted the fields were non-empty, so any
// string passed. It now requires ALL of: a real bcrypt-verified password, an
// active account, the approver's role NAME in the hard RETURN_APPROVAL_ROLES
// allowlist (Superadmin/Admin/General Manager/Manager), AND the role
// explicitly holding SALES_RETURNS/PURCHASE_RETURNS — no isAdminRole bypass,
// so even Admin must actually hold the permission row.
//
// requirePermission() itself is also covered below as generic middleware
// behavior (it still exists and still gates other routes), but note it is NOT
// what guards POST /sales/refund — that route only requires SALES or POS, by
// design, so an employee can reach the endpoint at all.

jest.mock("../../config/database", () => ({
  user: { findUnique: jest.fn() },
}));

const bcrypt = require("bcryptjs");
const prisma = require("../../config/database");
const {
  requirePermission,
  verifyManagerApproval,
} = require("../../middleware/auth");
const { MODULE_CODES } = require("../../config/modules");

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

// Mirrors the seed: Employee is the cashier-facing role and holds POS + SALES.
const cashierUser = {
  id: 7,
  role: {
    name: "Cashier",
    permissions: [
      { module: "POS", canAccess: true },
      { module: "SALES", canAccess: true },
      { module: "PURCHASES", canAccess: true },
    ],
  },
};

const managerUser = {
  id: 3,
  role: {
    name: "Manager",
    permissions: [
      { module: "SALES_RETURNS", canAccess: true },
      { module: "PURCHASE_RETURNS", canAccess: true },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("returns module codes are registered", () => {
  test("SALES_RETURNS and PURCHASE_RETURNS exist in the canonical registry", () => {
    expect(MODULE_CODES).toContain("SALES_RETURNS");
    expect(MODULE_CODES).toContain("PURCHASE_RETURNS");
  });
});

describe("requirePermission on the return endpoints", () => {
  test("cashier holding POS+SALES is denied SALES_RETURNS", async () => {
    prisma.user.findUnique.mockResolvedValue(cashierUser);
    const req = { user: { id: 7, role: "Cashier" } };
    const res = makeRes();
    const next = jest.fn();

    await requirePermission("SALES_RETURNS")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("cashier holding PURCHASES is denied PURCHASE_RETURNS", async () => {
    prisma.user.findUnique.mockResolvedValue(cashierUser);
    const req = { user: { id: 7, role: "Cashier" } };
    const res = makeRes();
    const next = jest.fn();

    await requirePermission("PURCHASE_RETURNS")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("manager holding SALES_RETURNS is allowed through", async () => {
    prisma.user.findUnique.mockResolvedValue(managerUser);
    const req = { user: { id: 3, role: "Manager" } };
    const res = makeRes();
    const next = jest.fn();

    await requirePermission("SALES_RETURNS")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("Superadmin short-circuits without a DB lookup", async () => {
    const req = { user: { id: 1, role: "Superadmin" } };
    const res = makeRes();
    const next = jest.fn();

    await requirePermission("SALES_RETURNS")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("verifyManagerApproval", () => {
  const PASSWORD = "correct-horse";
  let hash;

  beforeAll(async () => {
    hash = await bcrypt.hash(PASSWORD, 4); // low cost: this is a unit test
  });

  const expectStatus = async (promise, status) => {
    await expect(promise).rejects.toMatchObject({ status });
  };

  test("missing credentials are rejected with 400", async () => {
    await expectStatus(verifyManagerApproval("", "", "SALES_RETURNS"), 400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("wrong password is rejected with 401 (the old code accepted any string)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...managerUser,
      username: "manager",
      password: hash,
      isActive: true,
    });

    await expectStatus(
      verifyManagerApproval("manager", "not-the-password", "SALES_RETURNS"),
      401,
    );
  });

  test("unknown username is rejected with 401", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expectStatus(
      verifyManagerApproval("nobody", PASSWORD, "SALES_RETURNS"),
      401,
    );
  });

  test("unknown username and wrong password give the same message (no user oracle)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await verifyManagerApproval(
      "nobody",
      PASSWORD,
      "SALES_RETURNS",
    ).catch((e) => e);

    prisma.user.findUnique.mockResolvedValue({
      ...managerUser,
      username: "manager",
      password: hash,
      isActive: true,
    });
    const badPassword = await verifyManagerApproval(
      "manager",
      "wrong",
      "SALES_RETURNS",
    ).catch((e) => e);

    expect(unknown.message).toBe(badPassword.message);
    expect(unknown.status).toBe(badPassword.status);
  });

  test("deactivated manager is rejected with 401", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...managerUser,
      username: "manager",
      password: hash,
      isActive: false,
    });

    await expectStatus(
      verifyManagerApproval("manager", PASSWORD, "SALES_RETURNS"),
      401,
    );
  });

  test("correct password but approver lacks the module is rejected with 403 (in whitelist, no permission row)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      username: "manager",
      password: hash,
      isActive: true,
      role: { name: "Manager", permissions: [] }, // whitelisted role, permission not granted
    });

    await expectStatus(
      verifyManagerApproval("manager", PASSWORD, "SALES_RETURNS"),
      403,
    );
  });

  test("correct password and permission but role name is not in the whitelist is rejected with 403", async () => {
    // Models a Superadmin mistakenly granting SALES_RETURNS to a non-manager
    // custom role via PermissionConfig — the hard role-name allowlist must
    // still block it, independent of the permission grant.
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      username: "cashier",
      password: hash,
      isActive: true,
      role: {
        name: "Cashier",
        permissions: [{ module: "SALES_RETURNS", canAccess: true }],
      },
    });

    await expectStatus(
      verifyManagerApproval("cashier", PASSWORD, "SALES_RETURNS"),
      403,
    );
  });

  test("manager holding the module is approved", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...managerUser,
      username: "manager",
      password: hash,
      isActive: true,
    });

    await expect(
      verifyManagerApproval("manager", PASSWORD, "SALES_RETURNS"),
    ).resolves.toMatchObject({ id: 3, username: "manager", role: "Manager" });
  });

  test("Admin WITHOUT the permission row is rejected with 403 (no automatic bypass)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      username: "admin",
      password: hash,
      isActive: true,
      role: { name: "Admin", permissions: [] },
    });

    await expectStatus(
      verifyManagerApproval("admin", PASSWORD, "SALES_RETURNS"),
      403,
    );
  });

  test("Admin WITH the permission row explicitly granted is approved", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      username: "admin",
      password: hash,
      isActive: true,
      role: {
        name: "Admin",
        permissions: [{ module: "SALES_RETURNS", canAccess: true }],
      },
    });

    await expect(
      verifyManagerApproval("admin", PASSWORD, "SALES_RETURNS"),
    ).resolves.toMatchObject({ role: "Admin" });
  });

  test("General Manager with the permission row is approved (fourth whitelisted role)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 5,
      username: "gm",
      password: hash,
      isActive: true,
      role: {
        name: "General Manager",
        permissions: [{ module: "PURCHASE_RETURNS", canAccess: true }],
      },
    });

    await expect(
      verifyManagerApproval("gm", PASSWORD, "PURCHASE_RETURNS"),
    ).resolves.toMatchObject({ role: "General Manager" });
  });
});
