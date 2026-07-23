// resolveOperatingBranch decides which branch (and therefore which warehouse and
// treasury) a WRITE lands on. It exists because bulk order creation previously
// trusted `body.warehouseId` verbatim, letting any BULK_POS user post an order
// against any warehouse in the system.
//
// Core rule: employees are assigned to exactly one branch, so a non-global role
// always resolves to their own branch. A header naming someone else's branch is
// a hard 403 — never a silent fallback, because quietly re-pointing a write at a
// different branch would misattribute stock and cash with no signal.

jest.mock("../../config/database", () => ({
  user: { findUnique: jest.fn() },
  branch: { findUnique: jest.fn() },
}));

const prisma = require("../../config/database");
const { resolveOperatingBranch } = require("../../middleware/auth");

const BRANCH_A = { id: 10, name: "Branch A", warehouseId: 100, treasuryId: 200, isActive: true };
const BRANCH_B = { id: 20, name: "Branch B", warehouseId: 300, treasuryId: 400, isActive: true };

const employeeAtBranchA = {
  id: 7,
  branchId: BRANCH_A.id,
  role: { name: "Employee" },
  accessibleBranches: [],
};

const reqWithBranch = (id) => ({ headers: { "x-active-branch-id": String(id) } });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.branch.findUnique.mockImplementation(({ where }) =>
    Promise.resolve([BRANCH_A, BRANCH_B].find((b) => b.id === where.id) || null),
  );
});

describe("resolveOperatingBranch — single-branch employee", () => {
  test("resolves to the employee's own branch when no header is sent", async () => {
    prisma.user.findUnique.mockResolvedValue(employeeAtBranchA);

    await expect(resolveOperatingBranch(7, { headers: {} })).resolves.toEqual({
      id: 10,
      name: "Branch A",
      warehouseId: 100,
      treasuryId: 200,
    });
  });

  test("resolves to their own branch when the header agrees", async () => {
    prisma.user.findUnique.mockResolvedValue(employeeAtBranchA);

    const resolved = await resolveOperatingBranch(7, reqWithBranch(BRANCH_A.id));
    expect(resolved.warehouseId).toBe(100);
  });

  test("a header naming another branch is rejected with 403, not silently ignored", async () => {
    prisma.user.findUnique.mockResolvedValue(employeeAtBranchA);

    await expect(
      resolveOperatingBranch(7, reqWithBranch(BRANCH_B.id)),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("never returns another branch's warehouse even when one is requested", async () => {
    prisma.user.findUnique.mockResolvedValue(employeeAtBranchA);

    const err = await resolveOperatingBranch(7, reqWithBranch(BRANCH_B.id)).catch((e) => e);
    // The forged warehouse (300) must never surface anywhere in the outcome.
    expect(err.warehouseId).toBeUndefined();
    expect(err.status).toBe(403);
  });

  test("a user assigned to no branch at all is rejected with 400", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 8,
      branchId: null,
      role: { name: "Employee" },
      accessibleBranches: [],
    });

    await expect(
      resolveOperatingBranch(8, { headers: {} }),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("an inactive branch is rejected with 404", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...employeeAtBranchA,
      branchId: 99,
    });
    prisma.branch.findUnique.mockResolvedValue({ ...BRANCH_A, id: 99, isActive: false });

    await expect(
      resolveOperatingBranch(7, { headers: {} }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("resolveOperatingBranch — global roles", () => {
  const superadmin = { id: 1, branchId: null, role: { name: "Superadmin" }, accessibleBranches: [] };

  test("honours the selected branch header", async () => {
    prisma.user.findUnique.mockResolvedValue(superadmin);

    const resolved = await resolveOperatingBranch(1, reqWithBranch(BRANCH_B.id));
    expect(resolved).toMatchObject({ id: 20, warehouseId: 300 });
  });

  test("returns null in 'All Branches' mode so callers can reject the ambiguity", async () => {
    prisma.user.findUnique.mockResolvedValue(superadmin);

    await expect(resolveOperatingBranch(1, { headers: {} })).resolves.toBeNull();
  });
});

describe("resolveOperatingBranch — multi-branch assignment", () => {
  // Not a workflow the UI offers, but the data model allows accessibleBranches,
  // so the resolver must not lock such a user out of a branch they legitimately hold.
  const multiBranchUser = {
    id: 9,
    branchId: BRANCH_A.id,
    role: { name: "Manager" },
    accessibleBranches: [{ id: BRANCH_B.id }],
  };

  test("defaults to the primary branch with no header", async () => {
    prisma.user.findUnique.mockResolvedValue(multiBranchUser);
    const resolved = await resolveOperatingBranch(9, { headers: {} });
    expect(resolved.id).toBe(BRANCH_A.id);
  });

  test("allows an explicitly accessible branch", async () => {
    prisma.user.findUnique.mockResolvedValue(multiBranchUser);
    const resolved = await resolveOperatingBranch(9, reqWithBranch(BRANCH_B.id));
    expect(resolved).toMatchObject({ id: 20, warehouseId: 300 });
  });

  test("still rejects a branch outside the assignment", async () => {
    prisma.user.findUnique.mockResolvedValue(multiBranchUser);
    await expect(
      resolveOperatingBranch(9, reqWithBranch(777)),
    ).rejects.toMatchObject({ status: 403 });
  });
});
