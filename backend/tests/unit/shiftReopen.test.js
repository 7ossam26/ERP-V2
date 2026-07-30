/**
 * Returning a shift awaiting review to OPEN — PATCH /api/shifts/:id/reopen.
 *
 * This is the second of the two actions a shift approver has while a shift sits
 * in PENDING_REVIEW, the alternative to POST /approve:
 *
 *   OPEN → /end → PENDING_REVIEW ─┬─ /approve    → CLOSED  (terminal)
 *                                 └─ /reopen     → OPEN    (sell more, /end again)
 *
 * and the loop may repeat any number of times before approval. An approved
 * (CLOSED) shift is explicitly NOT reopenable by this workflow.
 *
 * Four things are under test:
 *
 * 1. ACCESS PARITY. Shift approval was never gated by a `Module` permission —
 *    the SHIFTS module only guards the shift LIST route. Authorization lived as
 *    a role-NAME allowlist inlined in routes/shifts.js. Both /approve and
 *    /:id/reopen call the same verifyShiftManager helper, backed by
 *    SHIFT_APPROVAL_ROLES in config/roles.js, so whoever may confirm a shift may
 *    reopen one and the two can never drift apart. These tests fail if someone
 *    re-introduces a hardcoded role name or gates reopen on a module permission
 *    that approve doesn't require.
 *
 * 2. ELIGIBILITY GUARDS. The shift must be PENDING_REVIEW, must be its branch's
 *    most recent shift, must have an active cashier, and must not collide with
 *    another live shift in the branch or another OPEN shift for the cashier.
 *    There is deliberately NO age cap — see the "no age cap" test.
 *
 * 3. THE LIFECYCLE ITSELF, driven through real requests against a stateful fake
 *    of the Prisma client rather than asserted on mock arguments, so the cycles
 *    PENDING_REVIEW → OPEN → PENDING_REVIEW → … are exercised end to end.
 *
 * 4. SALES INTEGRITY across every cycle: same shiftId, nothing duplicated or
 *    dropped, and the re-close recomputing over the WHOLE shift rather than only
 *    the latest cycle.
 */

const BRANCH_ID = 4;
const CASHIER_ID = 9;
const MANAGER_ID = 3;
const SHIFT_ID = 55;
const START_CASH = "100.00";

// ---------------------------------------------------------------------------
// A stateful in-memory stand-in for the Prisma client.
//
// The routes really mutate it, so a test can drive POST /end → PATCH /reopen →
// POST /approve and read the resulting row back. Every method is still a
// jest.fn(), so call-argument assertions keep working alongside state assertions.
//
// Everything the jest.mock factory closes over is `mock`-prefixed: jest hoists
// the factory above these declarations and refuses out-of-scope names otherwise.
// The factory only *runs* at require time, by which point they are initialized.
// ---------------------------------------------------------------------------

const mockStore = {
  shifts: new Map(),
  sales: [],
  expenses: [],
  employeeTransactions: [],
  users: new Map(),
  nextSaleId: 1,
};

const BRANCH = { id: BRANCH_ID, name: "Main", treasuryId: null };

/** Evaluate the subset of Prisma filter operators these routes actually use. */
const matchScalar = (value, cond) => {
  if (cond === undefined) return true;
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond) return cond.in.includes(value);
    if ("not" in cond) return value !== cond.not;
    if ("gte" in cond) return new Date(value) >= new Date(cond.gte);
    if ("lte" in cond) return new Date(value) <= new Date(cond.lte);
  }
  return value === cond;
};

const mockMatchWhere = (row, where = {}) =>
  Object.entries(where).every(([field, cond]) => matchScalar(row[field], cond));

const relationWhere = (include) =>
  include && typeof include === "object" && include.where ? include.where : {};

/** Never let a fake hand a password hash to a nested relation / HTTP response. */
const publicUser = (row, include) => {
  if (!row) return null;
  const select = include && typeof include === "object" ? include.select : null;
  if (select) {
    const out = {};
    for (const key of Object.keys(select)) out[key] = row[key];
    return out;
  }
  const { password, ...rest } = row;
  return rest;
};

const mockHydrateShift = (row, include = {}) => {
  if (!row) return null;
  const out = { ...row };
  if (include.user) out.user = publicUser(mockStore.users.get(row.userId), include.user);
  if (include.branch) out.branch = { ...BRANCH };
  if (include.reviewedBy) {
    out.reviewedBy = row.reviewedById
      ? publicUser(mockStore.users.get(row.reviewedById), include.reviewedBy)
      : null;
  }
  if (include.sales) {
    const where = relationWhere(include.sales);
    out.sales = mockStore.sales
      .filter((s) => s.shiftId === row.id && mockMatchWhere(s, where))
      .map((s) => ({ ...s }));
  }
  if (include.expenses) {
    out.expenses = mockStore.expenses
      .filter((e) => e.shiftId === row.id && mockMatchWhere(e, relationWhere(include.expenses)))
      .map((e) => ({ ...e }));
  }
  if (include.employeeTransactions) {
    out.employeeTransactions = mockStore.employeeTransactions
      .filter(
        (t) =>
          t.shiftId === row.id &&
          mockMatchWhere(t, relationWhere(include.employeeTransactions)),
      )
      .map((t) => ({ ...t }));
  }
  return out;
};

const mockSortRows = (rows, orderBy) => {
  if (!orderBy) return rows;
  const [field, dir] = Object.entries(orderBy)[0];
  return [...rows].sort((a, b) => {
    const av = new Date(a[field]).getTime();
    const bv = new Date(b[field]).getTime();
    return dir === "desc" ? bv - av : av - bv;
  });
};

jest.mock("../../config/database", () => {
  const client = {
    user: {
      findUnique: jest.fn(async ({ where }) => {
        const row =
          where.id !== undefined
            ? mockStore.users.get(where.id)
            : [...mockStore.users.values()].find((u) => u.username === where.username);
        return row ? { ...row } : null;
      }),
    },
    shift: {
      findUnique: jest.fn(async ({ where, include }) =>
        mockHydrateShift(mockStore.shifts.get(where.id), include),
      ),
      findFirst: jest.fn(async ({ where, include, orderBy }) => {
        const matches = [...mockStore.shifts.values()].filter((s) => mockMatchWhere(s, where));
        return mockHydrateShift(mockSortRows(matches, orderBy)[0], include);
      }),
      update: jest.fn(async ({ where, data, include }) => {
        const row = mockStore.shifts.get(where.id);
        if (!row) throw new Error(`fake: no shift #${where.id}`);
        Object.assign(row, data);
        return mockHydrateShift(row, include);
      }),
      // Reopen must never mint a replacement shift. Loud rather than silent.
      create: jest.fn(async () => {
        throw new Error("fake: shift.create must not be called by this workflow");
      }),
      count: jest.fn(async () => mockStore.shifts.size),
      findMany: jest.fn(async () => [...mockStore.shifts.values()]),
    },
    sale: {
      findMany: jest.fn(async ({ where }) =>
        mockStore.sales.filter((s) => mockMatchWhere(s, where)).map((s) => ({ ...s })),
      ),
    },
    deliveryManTransaction: {
      aggregate: jest.fn(async () => ({ _sum: { amount: null } })),
    },
    deposit: { findMany: jest.fn(async () => []) },
    systemConfiguration: { findUnique: jest.fn(async () => null) },
    // Run the callback against the same client, mirroring how the interactive
    // transaction sees the tx client.
    $transaction: jest.fn(async (cb) => cb(client)),
  };
  return client;
});

jest.mock("../../lib/orderService", () => ({
  drainPendingForBranch: jest.fn(),
}));

jest.mock("../../middleware/auth", () => {
  const actual = jest.requireActual("../../middleware/auth");
  return {
    ...actual,
    // Bypass JWT verification; the identity is injected per test.
    authenticateToken: (req, res, next) => {
      req.user = req.testUser;
      next();
    },
    requireAnyPermission: () => (req, res, next) => next(),
    getUserBranchFilter: jest.fn(),
  };
});

const bcrypt = require("bcryptjs");
const express = require("express");
const request = require("supertest");

const prisma = require("../../config/database");
const auth = require("../../middleware/auth");
const errorHandler = require("../../middleware/errorHandler");
const {
  SHIFT_APPROVAL_ROLES,
  SHIFT_BRANCH_BYPASS_ROLES,
  isShiftApprovalRole,
} = require("../../config/roles");
const { verifyShiftManager } = require("../../middleware/auth");

const PASSWORD = "correct-horse";
let PASSWORD_HASH;

const REASON = "أغلقت بالخطأ قبل تسجيل آخر الطلبات";

// ---------------------------------------------------------------------------
// Row factories
// ---------------------------------------------------------------------------

/** A live shift: no closing figures at all. */
const openShiftRow = (overrides = {}) => ({
  id: SHIFT_ID,
  userId: CASHIER_ID,
  branchId: BRANCH_ID,
  type: "MORNING",
  status: "OPEN",
  startTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
  startCash: START_CASH,
  endTime: null,
  endCash: null,
  actualCash: null,
  systemExpectedCash: null,
  shortage: null,
  expectedVisa: null,
  expectedInstapay: null,
  reviewedById: null,
  reviewedAt: null,
  ...overrides,
});

/**
 * A shift awaiting review — the state reopen operates on. Figures match the two
 * seeded cash sales (100 opening + 200 + 300 = 600 expected, counted exactly),
 * so the default fixture is internally consistent.
 */
const pendingReviewShiftRow = (overrides = {}) =>
  openShiftRow({
    status: "PENDING_REVIEW",
    endTime: new Date(Date.now() - 60 * 60 * 1000),
    endCash: 600,
    actualCash: 600,
    systemExpectedCash: 600,
    shortage: 0,
    expectedVisa: 0,
    expectedInstapay: 0,
    ...overrides,
  });

const managerRow = (overrides = {}) => ({
  id: MANAGER_ID,
  username: "manager",
  name: "Manager Mona",
  password: PASSWORD_HASH,
  isActive: true,
  branchId: BRANCH_ID,
  accessibleBranches: [],
  role: { name: "Manager" },
  ...overrides,
});

const cashierRow = (overrides = {}) => ({
  id: CASHIER_ID,
  username: "cashier",
  name: "Cashier Sameh",
  password: PASSWORD_HASH,
  isActive: true,
  branchId: BRANCH_ID,
  accessibleBranches: [{ id: BRANCH_ID }],
  role: { name: "Employee" },
  ...overrides,
});

/** A completed walk-in cash sale: money in the drawer at sale time. */
const addSale = (total, overrides = {}) => {
  const sale = {
    id: mockStore.nextSaleId++,
    saleNumber: `S-${mockStore.nextSaleId}`,
    shiftId: SHIFT_ID,
    status: "COMPLETED",
    isVoided: false,
    total,
    paymentMethod: "CASH",
    deliveryManId: null,
    deliveryStatus: null,
    deliveryDriverShare: null,
    ...overrides,
  };
  mockStore.sales.push(sale);
  return sale;
};

const seedStore = (shiftRow) => {
  mockStore.shifts.clear();
  mockStore.sales.length = 0;
  mockStore.expenses.length = 0;
  mockStore.employeeTransactions.length = 0;
  mockStore.users.clear();
  mockStore.nextSaleId = 1;
  mockStore.users.set(MANAGER_ID, managerRow());
  mockStore.users.set(CASHIER_ID, cashierRow());
  mockStore.shifts.set(SHIFT_ID, shiftRow);
};

const shiftRow = () => mockStore.shifts.get(SHIFT_ID);
const statusOf = () => shiftRow().status;
const patchManager = (overrides) =>
  mockStore.users.set(MANAGER_ID, managerRow(overrides));

// ---------------------------------------------------------------------------
// App + request helpers
// ---------------------------------------------------------------------------

let app;
let currentUser;

const asCashier = () => {
  currentUser = { id: CASHIER_ID, role: "Employee", branchId: BRANCH_ID };
};
const asManager = () => {
  currentUser = { id: MANAGER_ID, role: "Manager", branchId: BRANCH_ID };
};

const buildApp = () => {
  const server = express();
  server.use(express.json());
  server.use((req, res, next) => {
    req.testUser = currentUser;
    next();
  });
  server.use("/api/shifts", require("../../routes/shifts"));
  server.use(errorHandler);
  return server;
};

/** Cashier ends the shift (blind close) → PENDING_REVIEW. */
const endShift = (actualCash) => {
  asCashier();
  return request(app)
    .post("/api/shifts/end")
    .send({ shiftId: SHIFT_ID, actualCash });
};

/** Approver returns the shift to the cashier without approving → OPEN. */
const reopen = (body = {}) => {
  asManager();
  return request(app)
    .patch(`/api/shifts/${SHIFT_ID}/reopen`)
    .send({
      managerUsername: "manager",
      managerPassword: PASSWORD,
      reason: REASON,
      ...body,
    });
};

/** Approver signs the shift off → CLOSED (terminal). */
const approve = () => {
  asManager();
  return request(app).post("/api/shifts/approve").send({
    shiftId: SHIFT_ID,
    managerUsername: "manager",
    managerPassword: PASSWORD,
  });
};

beforeAll(async () => {
  PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4); // low cost: unit test
  app = buildApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  auth.getUserBranchFilter.mockResolvedValue(null); // global caller by default
  seedStore(pendingReviewShiftRow());
  addSale(200);
  addSale(300);
  asManager();
});

// ---------------------------------------------------------------------------
// 1. Access parity with shift approval
// ---------------------------------------------------------------------------

describe("access parity: reopen accepts exactly the shift-approval managers", () => {
  test("the approval role allowlist is centralized, not inlined in the route", () => {
    const routeSource = require("fs").readFileSync(
      require.resolve("../../routes/shifts.js"),
      "utf8",
    );
    // No `role.name === "Some Role"` comparisons may remain in the route.
    expect(routeSource).not.toMatch(/role\??\.name\s*===\s*["']/);
    expect(SHIFT_APPROVAL_ROLES.length).toBeGreaterThan(0);
  });

  test("reopen is NOT gated on a module permission approve doesn't require", () => {
    // verifyShiftManager takes (username, password, shift) — no module arg. If a
    // module requirement is ever added it must be added to approve too, or the
    // two access sets diverge and this signature check should be revisited.
    expect(verifyShiftManager.length).toBe(3);
  });

  test.each(SHIFT_APPROVAL_ROLES)(
    "%s may reopen (same list that may approve)",
    async (roleName) => {
      patchManager({ role: { name: roleName } });

      const res = await reopen();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("OPEN");
      expect(statusOf()).toBe("OPEN");
    },
  );

  test("a role outside the allowlist is refused with 403", async () => {
    expect(isShiftApprovalRole("Employee")).toBe(false);
    patchManager({ role: { name: "Employee" } });

    const res = await reopen();

    expect(res.status).toBe(403);
    expect(statusOf()).toBe("PENDING_REVIEW");
  });

  test("wrong password is refused with 401", async () => {
    const res = await reopen({ managerPassword: "not-the-password" });

    expect(res.status).toBe(401);
    expect(statusOf()).toBe("PENDING_REVIEW");
  });

  test("unknown manager is refused with 401 and the same message (no user oracle)", async () => {
    const unknown = await reopen({ managerUsername: "nobody" });
    const badPassword = await reopen({ managerPassword: "wrong" });

    expect(unknown.status).toBe(401);
    expect(badPassword.status).toBe(401);
    expect(unknown.body.message).toBe(badPassword.body.message);
  });

  test("deactivated manager account is refused with 401", async () => {
    patchManager({ isActive: false });

    const res = await reopen();

    expect(res.status).toBe(401);
  });

  test("manager from another branch is refused with 403", async () => {
    patchManager({ branchId: 99, accessibleBranches: [] });

    const res = await reopen();

    expect(res.status).toBe(403);
    expect(statusOf()).toBe("PENDING_REVIEW");
  });

  test("manager with the branch in accessibleBranches is allowed", async () => {
    patchManager({ branchId: 99, accessibleBranches: [{ id: BRANCH_ID }] });

    const res = await reopen();

    expect(res.status).toBe(200);
  });

  test.each(SHIFT_BRANCH_BYPASS_ROLES)(
    "%s bypasses branch scope",
    async (roleName) => {
      patchManager({
        branchId: 99,
        accessibleBranches: [],
        role: { name: roleName },
      });

      const res = await reopen();

      expect(res.status).toBe(200);
    },
  );

  test("caller whose branch ACL excludes the shift's branch is refused with 403", async () => {
    auth.getUserBranchFilter.mockResolvedValue({ id: { in: [1, 2] } });

    const res = await reopen();

    expect(res.status).toBe(403);
    // Refused before the credentials are even looked at.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("reopen and approve accept the same manager credentials", async () => {
    const reopened = await reopen();
    expect(reopened.status).toBe(200);

    // Same shift back to PENDING_REVIEW, then the *other* action with the very
    // same credentials.
    await endShift(600);
    const approved = await approve();

    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("CLOSED");
  });
});

// ---------------------------------------------------------------------------
// 2. Eligibility guards
// ---------------------------------------------------------------------------

describe("eligibility guards", () => {
  test("missing shift is 404", async () => {
    mockStore.shifts.clear();

    const res = await reopen();

    expect(res.status).toBe(404);
  });

  test("an OPEN shift cannot be reopened (400)", async () => {
    seedStore(openShiftRow());

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status: OPEN/);
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });

  test("an approved CLOSED shift cannot be reopened (400) — approval is terminal", async () => {
    seedStore(
      pendingReviewShiftRow({
        status: "CLOSED",
        reviewedById: MANAGER_ID,
        reviewedAt: new Date(),
      }),
    );

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status: CLOSED/);
    expect(statusOf()).toBe("CLOSED");
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });

  test("a reason is required (400)", async () => {
    const res = await reopen({ reason: "  " });

    expect(res.status).toBe(400);
    expect(prisma.shift.findUnique).not.toHaveBeenCalled();
  });

  test("a too-short reason is rejected (400)", async () => {
    const res = await reopen({ reason: "خطأ" });

    expect(res.status).toBe(400);
  });

  test("no age cap: a long-stale PENDING_REVIEW shift is still reopenable", async () => {
    // The old CLOSED → OPEN implementation refused anything older than the 48h
    // POST /start lookback, on the theory that a reopened shift would otherwise
    // be invisible to the one-shift-per-branch blocker. That blocker matches
    // OPEN *and* PENDING_REVIEW, so this shift already blocks /start exactly as
    // much as the OPEN shift it becomes — the cap protected nothing and is gone.
    // Overlap with LATER shifts is covered by the newer-shift guard below.
    seedStore(
      pendingReviewShiftRow({
        startTime: new Date(Date.now() - 50 * 60 * 60 * 1000),
      }),
    );

    const res = await reopen();

    expect(res.status).toBe(200);
    expect(statusOf()).toBe("OPEN");
  });

  test("shift whose cashier is deactivated is refused (400)", async () => {
    mockStore.users.set(CASHIER_ID, cashierRow({ isActive: false }));

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });

  test("refused when a newer shift exists in the branch (time-window overlap)", async () => {
    // A later shift means this shift's [startTime, endTime||now] window would
    // stretch across it, double-charging its dues payouts / deposits.
    mockStore.shifts.set(56, {
      ...openShiftRow({
        id: 56,
        status: "CLOSED",
        startTime: new Date(Date.now() - 30 * 60 * 1000),
      }),
    });

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/newer shift/i);
    expect(statusOf()).toBe("PENDING_REVIEW");
  });

  test("refused when the branch already has another unclosed shift", async () => {
    // Older, so it clears the newer-shift probe and lands on the live-shift one.
    mockStore.shifts.set(57, {
      ...openShiftRow({
        id: 57,
        status: "OPEN",
        startTime: new Date(Date.now() - 10 * 60 * 60 * 1000),
      }),
      userId: 42,
    });
    mockStore.users.set(42, cashierRow({ id: 42, username: "other" }));

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unclosed shift/i);
    expect(statusOf()).toBe("PENDING_REVIEW");
  });

  test("refused when the cashier already has another OPEN shift", async () => {
    // Same cashier, a different branch — so only the cashier guard can catch it.
    mockStore.shifts.set(58, {
      ...openShiftRow({
        id: 58,
        status: "OPEN",
        startTime: new Date(Date.now() - 10 * 60 * 60 * 1000),
      }),
      branchId: 77,
    });

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/another open shift/i);
    expect(statusOf()).toBe("PENDING_REVIEW");
  });

  test("status re-checked inside the transaction: concurrent change yields 409", async () => {
    // Passes the pre-transaction read, but the in-transaction re-read sees the
    // row already reopened by a competing request.
    prisma.$transaction.mockImplementationOnce(async (cb) => {
      shiftRow().status = "OPEN";
      return cb(prisma);
    });

    const res = await reopen();

    expect(res.status).toBe(409);
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. What the reopen write actually does
// ---------------------------------------------------------------------------

describe("the reopen write", () => {
  test("clears the whole closing snapshot and sets OPEN", async () => {
    const res = await reopen();

    expect(res.status).toBe(200);
    expect(prisma.shift.update).toHaveBeenCalledTimes(1);

    const { where, data } = prisma.shift.update.mock.calls[0][0];
    expect(where).toEqual({ id: SHIFT_ID }); // the SAME shift, not a new one

    // Every field POST /end writes, plus the reviewer fields, back to null.
    expect(data).toEqual({
      status: "OPEN",
      endTime: null,
      endCash: null,
      actualCash: null,
      systemExpectedCash: null,
      shortage: null,
      expectedVisa: null,
      expectedInstapay: null,
      reviewedById: null,
      reviewedAt: null,
    });
  });

  test("endTime is cleared — otherwise the re-close misses the reopened period", async () => {
    // calculateSystemExpectedCash bounds its DUES_PAYOUT window at
    // `endTime || now`, and GET /:id/report does the same for deposits. A stale
    // endTime would silently exclude everything that happened after the first
    // close, so this is the one cleared field that can distort money.
    expect(shiftRow().endTime).not.toBeNull();

    await reopen();

    expect(shiftRow().endTime).toBeNull();
  });

  test("every field POST /end writes is among the fields reopen clears", async () => {
    // Locks the two routes together: if /end starts writing a new closing field,
    // reopen must learn to clear it or the reopened shift carries it stale.
    seedStore(openShiftRow()); // start live so /end is the route that closes it
    addSale(200);
    addSale(300);

    expect((await endShift(600)).status).toBe(200);
    const endData = prisma.shift.update.mock.calls[0][0].data;

    prisma.shift.update.mockClear();
    await reopen();
    const reopenData = prisma.shift.update.mock.calls[0][0].data;

    for (const field of Object.keys(endData)) {
      if (field === "status") continue;
      expect(reopenData[field]).toBeNull();
    }
  });

  test("never touches startCash, startTime, type, userId or branchId", async () => {
    const before = { ...shiftRow() };

    await reopen();

    const { data } = prisma.shift.update.mock.calls[0][0];
    for (const preserved of [
      "startCash",
      "startTime",
      "type",
      "userId",
      "branchId",
      "id",
    ]) {
      expect(data).not.toHaveProperty(preserved);
      expect(shiftRow()[preserved]).toEqual(before[preserved]);
    }
  });

  test("does not create a replacement shift or touch sales", async () => {
    await reopen();

    expect(prisma.shift.create).not.toHaveBeenCalled();
    expect(mockStore.shifts.size).toBe(1);
    expect(mockStore.sales).toHaveLength(2);
  });

  test("runs the guards and the write inside one transaction", async () => {
    await reopen();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("echoes who reopened it and why, without leaking the password", async () => {
    const res = await reopen();

    expect(res.body.reopenedBy).toMatchObject({ username: "manager" });
    expect(res.body.reason).toBe(REASON);
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD_HASH);
  });
});

// ---------------------------------------------------------------------------
// 4. The lifecycle, driven end to end
// ---------------------------------------------------------------------------

describe("shift lifecycle cycles", () => {
  /** Identity that must survive every transition. */
  const identity = () => {
    const s = shiftRow();
    return {
      id: s.id,
      userId: s.userId,
      branchId: s.branchId,
      type: s.type,
      startCash: s.startCash,
      startTime: s.startTime,
    };
  };

  beforeEach(() => {
    // Every cycle test starts from a live shift with two cash sales already rung
    // up (100 opening + 200 + 300 → 600 expected).
    seedStore(openShiftRow());
    addSale(200);
    addSale(300);
  });

  test("OPEN → PENDING_REVIEW → OPEN", async () => {
    const before = identity();
    expect(statusOf()).toBe("OPEN");

    expect((await endShift(600)).status).toBe(200);
    expect(statusOf()).toBe("PENDING_REVIEW");

    expect((await reopen()).status).toBe(200);
    expect(statusOf()).toBe("OPEN");

    expect(identity()).toEqual(before);
    expect(prisma.shift.create).not.toHaveBeenCalled();
    expect(mockStore.shifts.size).toBe(1);
  });

  test("OPEN → PENDING_REVIEW → CLOSED", async () => {
    const before = identity();

    expect((await endShift(600)).status).toBe(200);
    expect(statusOf()).toBe("PENDING_REVIEW");

    const approved = await approve();
    expect(approved.status).toBe(200);
    expect(statusOf()).toBe("CLOSED");
    expect(shiftRow().reviewedById).toBe(MANAGER_ID);

    expect(identity()).toEqual(before);
  });

  test("OPEN → PENDING_REVIEW → OPEN → PENDING_REVIEW → CLOSED", async () => {
    const before = identity();

    await endShift(600);
    expect(statusOf()).toBe("PENDING_REVIEW");

    await reopen();
    expect(statusOf()).toBe("OPEN");

    // Cashier keeps selling on the SAME shift.
    addSale(150);

    await endShift(750);
    expect(statusOf()).toBe("PENDING_REVIEW");

    await approve();
    expect(statusOf()).toBe("CLOSED");

    expect(identity()).toEqual(before);
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });

  test("OPEN → PENDING_REVIEW → OPEN → PENDING_REVIEW → OPEN", async () => {
    const before = identity();

    await endShift(600);
    await reopen();
    addSale(150);
    await endShift(750);
    expect(statusOf()).toBe("PENDING_REVIEW");

    // The same two options are available again on the second review.
    const secondReopen = await reopen();
    expect(secondReopen.status).toBe(200);
    expect(statusOf()).toBe("OPEN");

    expect(identity()).toEqual(before);
    expect(mockStore.shifts.size).toBe(1);
  });

  test("the cycle survives many rounds and only approval ends it", async () => {
    for (let round = 0; round < 4; round++) {
      await endShift(600);
      expect(statusOf()).toBe("PENDING_REVIEW");
      expect((await reopen()).status).toBe(200);
      expect(statusOf()).toBe("OPEN");
    }

    await endShift(600);
    await approve();
    expect(statusOf()).toBe("CLOSED");

    // Terminal: the loop cannot be restarted from CLOSED.
    const afterApproval = await reopen();
    expect(afterApproval.status).toBe(400);
    expect(statusOf()).toBe("CLOSED");
  });

  test("a reopened shift is OPEN for POS, and the cashier can end it again", async () => {
    await endShift(600);
    await reopen();

    // GET /active/:userId is how POS resolves the cashier's shift.
    asCashier();
    const active = await request(app).get(`/api/shifts/active/${CASHIER_ID}`);

    expect(active.status).toBe(200);
    expect(active.body.id).toBe(SHIFT_ID); // the SAME shift, so new sales attach to it
    expect(active.body.status).toBe("OPEN");

    expect((await endShift(600)).status).toBe(200);
  });

  test("reviewer is cleared on reopen, so a re-approval records the real one", async () => {
    await endShift(600);
    await approve();
    expect(shiftRow().reviewedById).toBe(MANAGER_ID);

    // Reach PENDING_REVIEW again from a fresh cycle carrying a stale reviewer.
    seedStore(pendingReviewShiftRow({ reviewedById: 999, reviewedAt: new Date() }));
    addSale(200);
    addSale(300);

    await reopen();

    expect(shiftRow().reviewedById).toBeNull();
    expect(shiftRow().reviewedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Sales and recalculation integrity across cycles
// ---------------------------------------------------------------------------

describe("sales stay attached to the same shift across every reopen cycle", () => {
  beforeEach(() => {
    seedStore(openShiftRow());
    addSale(200);
    addSale(300);
  });

  test("every sale from every cycle keeps the original shiftId", async () => {
    const seen = () => mockStore.sales.map((s) => s.id);

    await endShift(600);
    await reopen();
    addSale(150);

    await endShift(750);
    await reopen();
    addSale(50);

    await endShift(800);
    await approve();

    expect(mockStore.sales).toHaveLength(4);
    expect(seen()).toEqual([1, 2, 3, 4]); // nothing dropped, nothing duplicated
    for (const sale of mockStore.sales) {
      expect(sale.shiftId).toBe(SHIFT_ID);
    }
    // And the shift they point at is still the one and only shift row.
    expect(mockStore.shifts.size).toBe(1);
    expect(shiftRow().id).toBe(SHIFT_ID);
  });

  test("the re-close recomputes over the WHOLE shift, not just the latest cycle", async () => {
    // 100 opening + 200 + 300
    const first = await endShift(600);
    expect(first.body.systemExpectedCash).toBe(600);

    await reopen();
    addSale(150);

    // Must be 100 + 200 + 300 + 150 = 750. If the recalculation were scoped to
    // "since reopen" it would read 250, and the cashier would be 500 over.
    const second = await endShift(750);
    expect(second.body.systemExpectedCash).toBe(750);
    expect(second.body.shortage).toBe(0);
    expect(second.body.calculationBreakdown).toMatchObject({
      startCash: 100,
      cashSales: 650,
    });

    await reopen();
    addSale(50);

    const third = await endShift(800);
    expect(third.body.systemExpectedCash).toBe(800);
    expect(third.body.shortage).toBe(0);
  });

  test("opening cash stays the original startCash across reopens", async () => {
    await endShift(600);
    await reopen();
    await endShift(600);
    await reopen();

    // Never re-anchored to the discarded endCash — that would compound the
    // opening float on every cycle.
    expect(shiftRow().startCash).toBe(START_CASH);
  });

  test("endTime advances on each re-close instead of sticking at the first", async () => {
    await endShift(600);
    const firstEnd = new Date(shiftRow().endTime).getTime();

    await reopen();
    expect(shiftRow().endTime).toBeNull();

    const beforeSecondClose = Date.now();
    await endShift(600);
    const secondEnd = new Date(shiftRow().endTime).getTime();

    expect(secondEnd).toBeGreaterThanOrEqual(beforeSecondClose);
    expect(secondEnd).toBeGreaterThanOrEqual(firstEnd);
  });
});

// ---------------------------------------------------------------------------
// 6. The bypass this feature closes
// ---------------------------------------------------------------------------

describe("POST /end no longer doubles as an un-audited reopen", () => {
  const end = (status) => {
    seedStore(pendingReviewShiftRow({ status }));
    return endShift(900);
  };

  test("a CLOSED shift cannot be pushed back to PENDING_REVIEW", async () => {
    const res = await end("CLOSED");

    expect(res.status).toBe(400);
    expect(statusOf()).toBe("CLOSED");
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });

  test("a PENDING_REVIEW shift cannot be re-closed (would overwrite its count)", async () => {
    const res = await end("PENDING_REVIEW");

    expect(res.status).toBe(400);
    expect(statusOf()).toBe("PENDING_REVIEW");
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Audit wiring
// ---------------------------------------------------------------------------

describe("audit wiring", () => {
  const {
    SUB_ACTION_MAP,
    ENTITY_MAP,
  } = require("../../middleware/auditCapture");

  test("reopen maps to a SHIFT_REOPEN audit action", () => {
    // auditCapture may not export its maps; fall back to reading the source so
    // this test documents the requirement either way.
    if (SUB_ACTION_MAP) {
      expect(SUB_ACTION_MAP.reopen).toBe("SHIFT_REOPEN");
    } else {
      const src = require("fs").readFileSync(
        require.resolve("../../middleware/auditCapture.js"),
        "utf8",
      );
      expect(src).toMatch(/"reopen":\s*"SHIFT_REOPEN"/);
    }
  });

  test("the audit action fits the audit_logs.action VarChar(20) column", () => {
    expect("SHIFT_REOPEN".length).toBeLessThanOrEqual(20);
  });

  test("shifts are mapped to the shift entity so old_values can be captured", () => {
    if (ENTITY_MAP) {
      expect(ENTITY_MAP.shifts).toBe("shift");
    } else {
      const src = require("fs").readFileSync(
        require.resolve("../../middleware/auditCapture.js"),
        "utf8",
      );
      expect(src).toMatch(/"shifts":\s*"shift"/);
    }
  });
});
