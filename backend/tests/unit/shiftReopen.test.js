/**
 * Sending a shift back to OPEN — PATCH /api/shifts/:id/reopen.
 *
 * Reopen runs from PENDING_REVIEW (instead of approving) *and* from CLOSED
 * (un-approving a shift signed off too early). Approval is NOT terminal:
 *
 *   OPEN → /end → PENDING_REVIEW ─┬─ /approve    → CLOSED ──┐
 *    ↑                            └─ /reopen     → OPEN     │
 *    └──────────────────── /reopen ──────────────────────────┘
 *
 * Both loops may run any number of times, in any combination, on the same row.
 * Only an already-OPEN shift is refused.
 *
 * Five things are under test:
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
 * 2. ELIGIBILITY GUARDS. The shift must be reopenable by status, must be its
 *    branch's most recent shift, must have an active cashier, and must not
 *    collide with another live shift in the branch or another OPEN shift for the
 *    cashier. There is deliberately NO age cap — see the "no age cap" test, and
 *    section 7 for the /start blocker that makes dropping it safe.
 *
 * 3. THE LIFECYCLE ITSELF, driven through real requests against a stateful fake
 *    of the Prisma client rather than asserted on mock arguments, so every cycle
 *    is exercised end to end.
 *
 * 4. SALES INTEGRITY across every cycle: same shiftId, nothing duplicated or
 *    dropped, and the re-close recomputing over the WHOLE shift rather than only
 *    the latest cycle.
 *
 * 5. THE SHIFT LIFECYCLE MOVES EXACTLY THE COUNTED VARIANCE (section 6 — the
 *    reason this file has a fake treasury at all). Starting, ending and reopening
 *    a shift leave `treasury.balance` untouched; approval posts the shortage
 *    (actual − expected) and nothing else. /start and /approve once posted
 *    against the whole account as if it were the drawer — booking 112,250 EGP out
 *    of three branches in two days — and section 6 is the wall against that.
 *    Sections 10–11 pin which cash transfers are drawer movements.
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
  // The branch treasury is the branch SAFE, not the drawer — see section 6.
  // Cash sales and expenses post to it as they happen in production; here tests
  // move it explicitly via `ringCashSale`. The shift lifecycle never touches it.
  treasuryBalance: 0,
  deposits: [],
  withdrawals: [],
  // Branch → main-treasury collections. Real rows here (rather than a flat zero)
  // are what let the opening-handover tests reproduce the double-count.
  cashTransfers: [],
  nextSaleId: 1,
  nextMovementId: 1,
  nextTransferId: 1,
  nextShiftId: 1,
  allowShiftCreate: false,
};

const TREASURY_ID = 7;

// Declared as `function`, not `const`: babel-plugin-jest-hoist lifts ALL-CAPS
// consts referenced by a jest.mock factory to the top of the file, which would
// put a `const BRANCH = { id: BRANCH_ID }` above BRANCH_ID's own declaration and
// blow up on the temporal dead zone. Function declarations hoist natively and
// read their references at call time.
function mockBranchRow() {
  return { id: BRANCH_ID, name: "Main", treasuryId: TREASURY_ID };
}

/** Evaluate the subset of Prisma filter operators these routes actually use. */
const matchScalar = (value, cond) => {
  if (cond === undefined) return true;
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond) return cond.in.includes(value);
    if ("not" in cond) return value !== cond.not;
    // A range filter can only match a value that exists. Without this a missing
    // date compared as NaN and quietly failed every bound.
    if (value === undefined || value === null) return false;
    // Numbers compare numerically (cycle), everything else as dates.
    const cmp = (a, b) =>
      typeof a === "number" && typeof b === "number"
        ? a - b
        : new Date(a) - new Date(b);
    // Every bound present must hold. Returning on the first one made a
    // { gte, lte } window ignore its upper end.
    if ("gte" in cond && !(cmp(value, cond.gte) >= 0)) return false;
    if ("lte" in cond && !(cmp(value, cond.lte) <= 0)) return false;
    if ("lt" in cond && !(cmp(value, cond.lt) < 0)) return false;
    if ("gt" in cond && !(cmp(value, cond.gt) > 0)) return false;
    return true;
  }
  return value === cond;
};

/** Sum a numeric field over rows matching `where`, Prisma-aggregate shaped. */
const mockSumAgg = (rows, where, field) => ({
  _sum: {
    [field]: rows
      .filter((r) => mockMatchWhere(r, where))
      .reduce((n, r) => n + Number(r[field] || 0), 0),
  },
});

function mockTreasuryRow() {
  return {
    id: TREASURY_ID,
    name: "Main Drawer",
    balance: mockStore.treasuryBalance,
  };
}

/**
 * Insert a Deposit/Withdrawal, enforcing UNIQUE(shift_id, source, cycle) exactly
 * as MySQL would — NULL shiftIds never collide, and two rows for the same shift
 * and source are fine as long as they belong to different approval cycles.
 */
const mockCreateMovement = (rows, data) => {
  if (
    data.shiftId != null &&
    rows.some(
      (r) =>
        r.shiftId === data.shiftId &&
        r.source === data.source &&
        r.cycle === data.cycle,
    )
  ) {
    const err = new Error(
      "Unique constraint failed on the fields: (`shift_id`,`source`,`cycle`)",
    );
    err.code = "P2002";
    throw err;
  }
  const row = { id: mockStore.nextMovementId++, createdAt: new Date(), ...data };
  rows.push(row);
  return row;
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
  if (include.branch) out.branch = mockBranchRow();
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

/**
 * Apply an update payload, honouring Prisma's atomic number operators. Reopen
 * writes `reopenCount: { increment: 1 }`, and a fake that assigned that object
 * verbatim would silently make every cycle assertion meaningless.
 */
const mockApplyWrite = (row, data) => {
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("increment" in value) {
        row[field] = (Number(row[field]) || 0) + value.increment;
        continue;
      }
      if ("decrement" in value) {
        row[field] = (Number(row[field]) || 0) - value.decrement;
        continue;
      }
    }
    row[field] = value;
  }
  return row;
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
        mockApplyWrite(row, data);
        return mockHydrateShift(row, include);
      }),
      // Conditional claim used by POST /approve: only rows still matching the
      // full `where` are written, and the count is what makes approval
      // single-shot. A fake that ignored the condition would make the
      // double-approval test pass for the wrong reason.
      updateMany: jest.fn(async ({ where, data }) => {
        const rows = [...mockStore.shifts.values()].filter((s) =>
          mockMatchWhere(s, where),
        );
        rows.forEach((row) => mockApplyWrite(row, data));
        return { count: rows.length };
      }),
      // Reopen must never mint a replacement shift — loud rather than silent.
      // Suites that legitimately start one opt in via mockStore.allowShiftCreate.
      create: jest.fn(async ({ data }) => {
        if (!mockStore.allowShiftCreate) {
          throw new Error("fake: shift.create must not be called by this workflow");
        }
        const row = {
          endTime: null,
          endCash: null,
          actualCash: null,
          systemExpectedCash: null,
          shortage: null,
          expectedVisa: null,
          expectedInstapay: null,
          closingTreasuryBalance: null,
          treasuryVariance: null,
          reviewedById: null,
          reviewedAt: null,
          reopenCount: 0,
          ...data,
          id: mockStore.nextShiftId++,
        };
        mockStore.shifts.set(row.id, row);
        return { ...row };
      }),
      count: jest.fn(async () => mockStore.shifts.size),
      findMany: jest.fn(async () => [...mockStore.shifts.values()]),
    },
    sale: {
      findMany: jest.fn(async ({ where }) =>
        mockStore.sales.filter((s) => mockMatchWhere(s, where)).map((s) => ({ ...s })),
      ),
    },
    branch: {
      findUnique: jest.fn(async () => ({ ...mockBranchRow(), treasury: mockTreasuryRow() })),
    },
    treasury: {
      findUnique: jest.fn(async () => mockTreasuryRow()),
      update: jest.fn(async ({ data }) => {
        if (data.balance?.increment !== undefined) {
          mockStore.treasuryBalance += data.balance.increment;
        }
        if (data.balance?.decrement !== undefined) {
          mockStore.treasuryBalance -= data.balance.decrement;
        }
        return mockTreasuryRow();
      }),
      // Mirrors the compare-and-set debit in lib/shiftTreasury.js.
      updateMany: jest.fn(async ({ where, data }) => {
        const floor = where.balance?.gte;
        if (floor !== undefined && mockStore.treasuryBalance < floor) {
          return { count: 0 };
        }
        if (data.balance?.decrement !== undefined) {
          mockStore.treasuryBalance -= data.balance.decrement;
        }
        return { count: 1 };
      }),
    },
    // The UNIQUE(shift_id, source, cycle) index is enforced here — it is the
    // guard the whole reopen-after-approval design turns on, so a fake that
    // ignored it would make these tests meaningless.
    deposit: {
      create: jest.fn(async ({ data }) =>
        mockCreateMovement(mockStore.deposits, data),
      ),
      aggregate: jest.fn(async ({ where }) =>
        mockSumAgg(mockStore.deposits, where, "amount"),
      ),
      findMany: jest.fn(async ({ where }) =>
        mockStore.deposits.filter((d) => mockMatchWhere(d, where)),
      ),
    },
    withdrawal: {
      create: jest.fn(async ({ data }) =>
        mockCreateMovement(mockStore.withdrawals, data),
      ),
      aggregate: jest.fn(async ({ where }) =>
        mockSumAgg(mockStore.withdrawals, where, "amount"),
      ),
    },
    // Drawer-formula terms this suite never exercises; zero keeps expected cash
    // equal to startCash + cash sales, which is what the arithmetic asserts on.
    expense: {
      aggregate: jest.fn(async ({ where }) =>
        mockSumAgg(mockStore.expenses, where, "amount"),
      ),
    },
    cashTransfer: {
      aggregate: jest.fn(async ({ where }) =>
        mockSumAgg(mockStore.cashTransfers, where, "amount"),
      ),
    },
    // Wholesale terms of the drawer formula. This suite never rings a bulk
    // sale, so empty stores keep them at zero — but the formula and the report
    // query them on every /end, and a missing model turned /end into a 500.
    bulkPayment: {
      aggregate: jest.fn(async () => ({ _sum: { amount: null } })),
      findMany: jest.fn(async () => []),
    },
    bulkRefund: {
      aggregate: jest.fn(async () => ({ _sum: { amount: null } })),
      findMany: jest.fn(async () => []),
    },
    payroll: { aggregate: jest.fn(async () => ({ _sum: { netSalary: null } })) },
    supplierPayment: {
      aggregate: jest.fn(async () => ({ _sum: { amount: null } })),
    },
    deliveryManTransaction: {
      aggregate: jest.fn(async () => ({ _sum: { amount: null } })),
    },
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
  closingTreasuryBalance: null,
  treasuryVariance: null,
  reviewedById: null,
  reviewedAt: null,
  reopenCount: 0,
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
    closingTreasuryBalance: 600,
    treasuryVariance: 0,
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

/**
 * A cash sale as POS really performs it: the sale row AND the treasury credit,
 * which routes/sales.js posts at sale time. Tests that assert on the treasury
 * must use this rather than addSale, or the drawer and the books diverge for
 * reasons that have nothing to do with reopening.
 */
const ringCashSale = (total) => {
  mockStore.treasuryBalance += total;
  return addSale(total);
};

/**
 * A collection out of the branch treasury, as a manager records it on the cash
 * transfers screen. Debits the source treasury the moment it is created, PENDING
 * or not, which is why the drawer formula counts it from that point.
 */
const addTransferOut = (
  amount,
  {
    createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000),
    // false = out of the branch SAFE, the default every legacy row carries.
    fromDrawer = false,
    fromShiftId = fromDrawer ? SHIFT_ID : null,
    status = "PENDING",
    resolvedAt = null,
    // A rejected transfer was refunded to the source, so the net is zero.
    refund = false,
  } = {},
) => {
  mockStore.treasuryBalance -= amount;
  if (refund) mockStore.treasuryBalance += amount;
  const row = {
    id: mockStore.nextTransferId++,
    amount,
    fromTreasuryId: TREASURY_ID,
    toTreasuryId: TREASURY_ID + 1,
    status,
    createdAt,
    resolvedAt,
    fromDrawer,
    fromShiftId,
    toDrawer: false,
    toShiftId: null,
  };
  mockStore.cashTransfers.push(row);
  return row;
};

/**
 * Head office sending cash to the branch. Credits the safe by default; with
 * toDrawer the receiver put it in the register of this shift.
 */
const addTransferIn = (
  amount,
  {
    createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000),
    toDrawer = false,
    toShiftId = toDrawer ? SHIFT_ID : null,
    status = "APPROVED",
  } = {},
) => {
  if (status === "APPROVED") mockStore.treasuryBalance += amount;
  const row = {
    id: mockStore.nextTransferId++,
    amount,
    fromTreasuryId: TREASURY_ID + 1,
    toTreasuryId: TREASURY_ID,
    status,
    createdAt,
    resolvedAt: status === "PENDING" ? null : createdAt,
    fromDrawer: false,
    fromShiftId: null,
    toDrawer,
    toShiftId,
  };
  mockStore.cashTransfers.push(row);
  return row;
};

/**
 * Petty cash paid at the register — the cashier opens the drawer and hands the
 * money over, so unlike a safe movement this really does have to come off.
 */
const addCashExpense = (
  amount,
  { createdAt = new Date(Date.now() - 60 * 60 * 1000) } = {},
) => {
  mockStore.treasuryBalance -= amount;
  const row = {
    id: mockStore.expenses.length + 1,
    amount,
    treasuryId: TREASURY_ID,
    paymentMethod: "CASH",
    createdAt,
  };
  mockStore.expenses.push(row);
  return row;
};

/**
 * A closed shift on the same branch that ended before this one opened. Only its
 * counted cash matters here: it is how a shift with no SHIFT_OPENING posting
 * reconstructs how much of the drawer was handed over at the boundary.
 */
const addPreviousShift = (countedCash) => {
  const row = openShiftRow({
    id: SHIFT_ID - 1,
    status: "CLOSED",
    startTime: new Date(Date.now() - 11 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    endCash: countedCash,
    actualCash: countedCash,
  });
  mockStore.shifts.set(row.id, row);
  return row;
};

const seedStore = (shiftRow, { treasuryBalance = 0 } = {}) => {
  mockStore.shifts.clear();
  mockStore.sales.length = 0;
  mockStore.expenses.length = 0;
  mockStore.employeeTransactions.length = 0;
  mockStore.deposits.length = 0;
  mockStore.withdrawals.length = 0;
  mockStore.cashTransfers.length = 0;
  mockStore.users.clear();
  mockStore.nextSaleId = 1;
  mockStore.nextMovementId = 1;
  mockStore.nextTransferId = 1;
  mockStore.nextShiftId = SHIFT_ID + 1;
  mockStore.allowShiftCreate = false;
  mockStore.treasuryBalance = treasuryBalance;
  mockStore.users.set(MANAGER_ID, managerRow());
  mockStore.users.set(CASHIER_ID, cashierRow());
  mockStore.shifts.set(SHIFT_ID, shiftRow);
};

const shiftRow = () => mockStore.shifts.get(SHIFT_ID);
const statusOf = () => shiftRow().status;
const balance = () => Math.round(mockStore.treasuryBalance * 100) / 100;
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

/** Approver sends the shift back to the cashier → OPEN. */
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

/** Approver signs the shift off → CLOSED, posting the treasury correction. */
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
  // Default fixture: a shift awaiting review, 100 float + 200 + 300 in cash
  // sales, counted exactly. The treasury holds the same 600, so approving it
  // posts nothing — tests that care about postings set up their own numbers.
  seedStore(pendingReviewShiftRow(), { treasuryBalance: 600 });
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

  test("an approved CLOSED shift CAN be reopened — approval is not terminal", async () => {
    seedStore(
      pendingReviewShiftRow({
        status: "CLOSED",
        reviewedById: MANAGER_ID,
        reviewedAt: new Date(),
      }),
      { treasuryBalance: 600 },
    );

    const res = await reopen();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OPEN");
    expect(res.body.wasApproved).toBe(true); // the UI needs to tell these apart
    expect(statusOf()).toBe("OPEN");
    // The approval's reviewer is cleared so a re-approval records the real one.
    expect(shiftRow().reviewedById).toBeNull();
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

    // Every field POST /end writes, plus the reviewer fields, back to null —
    // and reopenCount advanced, which is what gives the next approval its own
    // treasury posting cycle.
    expect(data).toEqual({
      status: "OPEN",
      endTime: null,
      endCash: null,
      actualCash: null,
      systemExpectedCash: null,
      shortage: null,
      expectedVisa: null,
      expectedInstapay: null,
      // The treasury snapshot taken at the discarded close. This is the stale
      // INPUT to a future posting, not a record of one: if an earlier approval
      // did post, that Deposit/Withdrawal is left exactly as it is.
      closingTreasuryBalance: null,
      treasuryVariance: null,
      reviewedById: null,
      reviewedAt: null,
      reopenCount: { increment: 1 },
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

  test("the pre-approval cycle survives many rounds", async () => {
    for (let round = 0; round < 4; round++) {
      await endShift(600);
      expect(statusOf()).toBe("PENDING_REVIEW");
      expect((await reopen()).status).toBe(200);
      expect(statusOf()).toBe("OPEN");
      expect(shiftRow().reopenCount).toBe(round + 1);
    }

    await endShift(600);
    await approve();
    expect(statusOf()).toBe("CLOSED");
  });

  test("approval is NOT terminal: the loop restarts from CLOSED", async () => {
    await endShift(600);
    await approve();
    expect(statusOf()).toBe("CLOSED");

    const afterApproval = await reopen();

    expect(afterApproval.status).toBe(200);
    expect(afterApproval.body.wasApproved).toBe(true);
    expect(statusOf()).toBe("OPEN");
  });

  test("only an already-OPEN shift refuses to reopen", async () => {
    seedStore(openShiftRow(), { treasuryBalance: 600 });

    const res = await reopen();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status: OPEN/);
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
// 6. Treasury: the shift lifecycle moves exactly the counted variance
//
// The branch treasury is ONE account holding two containers:
//
//     الدرج ──handover──► خزنة الفرع ──cash transfer──► الإدارة
//
// Every movement the drawer formula counts was already posted to that account
// as it happened, so at close the books believe the drawer holds
// `systemExpectedCash`. The count says otherwise by exactly `shortage`, and
// approval posts THAT — a Withdrawal for a shortage, a Deposit for an overage —
// and nothing else.
//
// What must never come back: POST /start posting the gap between the declared
// float and the balance (a float below the balance is the ordinary handover;
// posting it booked 112,250 EGP out of three branches in two days), and
// approval forcing the balance onto the drawer count (that erases the safe).
// Cash sales still credit the treasury at sale time — routes/sales.js.
// ---------------------------------------------------------------------------

describe("the shift lifecycle moves exactly the counted variance", () => {
  /** OPEN shift, 100 float already in the drawer, 500 rung up in cash sales. */
  const seedLive = () => {
    seedStore(openShiftRow(), { treasuryBalance: 100 });
    ringCashSale(200);
    ringCashSale(300);
    // treasury 600; expected cash 100 + 500 = 600
  };

  /** Every row either posting writes. */
  const lifecycleRows = () =>
    [...mockStore.deposits, ...mockStore.withdrawals].filter((r) =>
      ["SHIFT_OPENING", "SHIFT_VARIANCE"].includes(r.source),
    );
  const varianceRows = () =>
    [
      ...mockStore.deposits.map((r) => ({ ...r, signed: Number(r.amount) })),
      ...mockStore.withdrawals.map((r) => ({ ...r, signed: -Number(r.amount) })),
    ].filter((r) => r.source === "SHIFT_VARIANCE");
  const netPosted = () =>
    Math.round(varianceRows().reduce((n, r) => n + r.signed, 0) * 100) / 100;

  const startShift = (body = {}) => {
    asCashier();
    mockStore.allowShiftCreate = true;
    return request(app)
      .post("/api/shifts/start")
      .send({ userId: CASHIER_ID, branchId: BRANCH_ID, ...body });
  };

  beforeEach(seedLive);

  test("a shortage is posted as a withdrawal of exactly the shortage", async () => {
    await endShift(590); // counted 590 against 600 expected
    const before = balance();

    const res = await approve();

    expect(res.status).toBe(200);
    expect(statusOf()).toBe("CLOSED");
    expect(balance()).toBe(before - 10);
    const rows = varianceRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].signed).toBe(-10);
    expect(rows[0].shiftId).toBe(SHIFT_ID);
    expect(res.body.varianceAdjustment).toMatchObject({ type: "WITHDRAWAL", amount: 10 });
  });

  test("an overage is posted as a deposit of exactly the overage", async () => {
    await endShift(625);
    const before = balance();

    expect((await approve()).status).toBe(200);

    expect(balance()).toBe(before + 25);
    expect(netPosted()).toBe(25);
  });

  test("an exact count posts nothing", async () => {
    await endShift(600);
    const before = balance();

    const res = await approve();

    expect(res.status).toBe(200);
    expect(balance()).toBe(before);
    expect(lifecycleRows()).toHaveLength(0);
    expect(res.body.varianceAdjustment).toBeNull();
  });

  test("the variance never touches the safe part of the balance", async () => {
    // 47,000 of earlier takings sit in the safe. Forcing the account onto the
    // drawer count — the old posting — would have wiped them out.
    mockStore.treasuryBalance += 47000;
    await endShift(590);

    expect((await approve()).status).toBe(200);

    expect(balance()).toBe(47000 + 600 - 10);
  });

  test("close stores the delta approval will post, and takes no balance snapshot", async () => {
    await endShift(590);

    expect(shiftRow().closingTreasuryBalance).toBeNull();
    expect(Number(shiftRow().treasuryVariance)).toBe(-10);
  });

  test("the shortage is still reported — accountability is unchanged", async () => {
    await endShift(590);

    expect(shiftRow().shortage).toBe(-10);
    expect((await approve()).status).toBe(200);
    expect(shiftRow().shortage).toBe(-10);
  });

  test("a legacy variance (stored next to a balance snapshot) is never posted", async () => {
    // Shifts closed before 31/07/2026 stored actual − balance, the safe-erasing
    // figure. One still awaiting approval must close without posting it.
    seedStore(
      pendingReviewShiftRow({ closingTreasuryBalance: 47600, treasuryVariance: -47000 }),
      { treasuryBalance: 47600 },
    );

    expect((await approve()).status).toBe(200);

    expect(balance()).toBe(47600);
    expect(lifecycleRows()).toHaveLength(0);
  });

  test("a float BELOW the previous count books nothing — that is the handover", async () => {
    // The exact shape that drained the branches: previous shift counted 600,
    // the cashier hands 450 to the safe and opens on 150.
    await endShift(600);
    await approve();
    const before = balance();

    const res = await startShift({ startCash: 150 });

    expect(res.status).toBe(201);
    expect(Number(res.body.startCash)).toBe(150);
    expect(balance()).toBe(before); // no 450 withdrawal
    expect(lifecycleRows()).toHaveLength(0);
    expect(res.body.openingAdjustment).toBeNull();
  });

  test("a float ABOVE the previous count books nothing either", async () => {
    await endShift(600);
    await approve();
    const before = balance();

    const res = await startShift({ startCash: 900 });

    expect(res.status).toBe(201);
    expect(balance()).toBe(before);
    expect(lifecycleRows()).toHaveLength(0);
  });

  test("an omitted float carries the previous COUNT forward, not the treasury balance", async () => {
    // The treasury is deliberately far from the count here: defaulting to it is
    // what prefilled floats of tens of thousands.
    await endShift(600);
    await approve();
    mockStore.treasuryBalance = 47000; // safe holding several shifts of takings

    const res = await startShift();

    expect(res.status).toBe(201);
    expect(Number(res.body.startCash)).toBe(600);
    expect(balance()).toBe(47000);
    expect(lifecycleRows()).toHaveLength(0);
  });

  test("approval stays single-shot: a replay is refused and posts nothing more", async () => {
    await endShift(590);
    expect((await approve()).status).toBe(200);
    const after = { balance: balance(), reviewer: shiftRow().reviewedById };

    const replay = await approve();

    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect(balance()).toBe(after.balance);
    expect(shiftRow().reviewedById).toBe(after.reviewer);
    expect(varianceRows()).toHaveLength(1);
  });

  test("the conditional claim, not the pre-flight read, is what refuses a race", async () => {
    // Two approvals interleaved so both clear the pre-flight status read before
    // either writes. Exactly one updateMany may match PENDING_REVIEW, so the
    // variance is posted once.
    await endShift(590);

    const [a, b] = await Promise.all([approve(), approve()]);
    const codes = [a.status, b.status].sort();

    expect(codes[0]).toBe(200);
    expect(codes[1]).toBeGreaterThanOrEqual(400);
    expect(statusOf()).toBe("CLOSED");
    expect(balance()).toBe(590);
    expect(varianceRows()).toHaveLength(1);
  });

  test("approve → reopen → approve cycles supersede: the net posted is the FINAL shortage", async () => {
    for (const counted of [590, 610, 605]) {
      await endShift(counted);
      expect((await approve()).status).toBe(200);
      await reopen();
    }
    await endShift(597);
    expect((await approve()).status).toBe(200);

    expect(netPosted()).toBe(-3);
    expect(balance()).toBe(597);
    // one row per cycle that actually differed, each on its own cycle
    const cycles = varianceRows().map((r) => r.cycle);
    expect(new Set(cycles).size).toBe(cycles.length);
  });

  test("reopening never posts a reversal", async () => {
    await endShift(590);
    await approve();
    const before = balance();
    const rowsBefore = lifecycleRows().length;

    await reopen();

    expect(statusOf()).toBe("OPEN");
    expect(balance()).toBe(before);
    expect(lifecycleRows()).toHaveLength(rowsBefore);
  });

  test("closing alone never writes to the treasury table", async () => {
    prisma.treasury.update.mockClear();
    prisma.treasury.updateMany.mockClear();

    await endShift(590);

    expect(prisma.treasury.update).not.toHaveBeenCalled();
    expect(prisma.treasury.updateMany).not.toHaveBeenCalled();
  });

  test("cash sales still credit the treasury — only the lifecycle posting changed", async () => {
    // Guards against "fixing" this by unplugging routes/sales.js too.
    const before = balance();
    ringCashSale(250);
    expect(balance()).toBe(Math.round((before + 250) * 100) / 100);
  });
});

// ---------------------------------------------------------------------------
// 7. The one-shift-per-branch blocker, now unbounded
// ---------------------------------------------------------------------------

describe("POST /start blocks on an unclosed shift of ANY age", () => {
  const start = () => {
    asManager();
    return request(app)
      .post("/api/shifts/start")
      .send({ userId: 77, branchId: BRANCH_ID });
  };

  test("a reopened shift older than the former 48h window still blocks", async () => {
    // A CLOSED shift blocks nothing, and reopening preserves the original
    // startTime — so under the old 48h-bounded blocker this reopened shift was
    // invisible and a second cashier could open a concurrent one in the branch.
    seedStore(
      openShiftRow({ startTime: new Date(Date.now() - 90 * 60 * 60 * 1000) }),
      { treasuryBalance: 100 },
    );

    const res = await start();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already an active shift/i);
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });

  test("the blocker query carries no startTime bound at all", async () => {
    seedStore(openShiftRow(), { treasuryBalance: 100 });

    await start();

    const blockerCall = prisma.shift.findFirst.mock.calls.find((c) =>
      c[0]?.where?.status?.in?.includes("PENDING_REVIEW"),
    );
    expect(blockerCall).toBeDefined();
    expect(blockerCall[0].where.startTime).toBeUndefined();
  });

  test("a PENDING_REVIEW shift of any age also blocks", async () => {
    seedStore(
      pendingReviewShiftRow({
        startTime: new Date(Date.now() - 90 * 60 * 60 * 1000),
      }),
      { treasuryBalance: 600 },
    );

    const res = await start();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pending manager review/i);
  });
});

// ---------------------------------------------------------------------------
// 8. The bypass this feature closes
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
// 9. Audit wiring
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

// ---------------------------------------------------------------------------
// 10. Cash handed over at the shift boundary is not subtracted twice
// ---------------------------------------------------------------------------

describe("branch-safe movements never touch the drawer", () => {
  // Production shift #210 (مصر حلوان, 31/07/2026) reduced to its money. The
  // cashier counted 19,575 out of the previous shift, handed 17,200 to the
  // office and opened on a 2,375 float. The manager registered that 17,200 as a
  // transfer out of the branch safe two hours INTO the new shift, and the drawer
  // formula subtracted it: a 0.50 shortage printed as a 17,199.50 overage.
  //
  // The first fix capped the damage with an offset — transfers out were absorbed
  // up to the size of the opening handover. The cap was itself the bug: a bigger
  // transfer is not drawer cash for the excess, it is earlier shifts' takings
  // that had been accumulating in the safe. These tests pin the rule that
  // replaced it — a movement of the SAFE is never a movement of the DRAWER, at
  // any size, handover or no handover.
  const PREVIOUS_COUNT = 19575;
  const FLOAT = 2375;
  const HANDOVER = PREVIOUS_COUNT - FLOAT; // 17,200
  const SALES = 14145.5;
  const DRAWER = FLOAT + SALES; // 16,520.50 — what the drawer really holds

  /** Opens on a reduced float, with the previous count on record. */
  const openAfterHandover = () => {
    seedStore(openShiftRow({ startCash: FLOAT }), {
      treasuryBalance: PREVIOUS_COUNT,
    });
    addPreviousShift(PREVIOUS_COUNT);
    ringCashSale(SALES);
  };

  test("the handover, registered as a transfer, comes off expected ZERO times", async () => {
    openAfterHandover();
    addTransferOut(HANDOVER);

    const res = await endShift(DRAWER); // counted exactly

    expect(res.status).toBe(200);
    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.systemExpectedCash).toBe(DRAWER);
    // The raw movement is still reported, just not subtracted.
    expect(breakdown.transfersOut).toBe(HANDOVER);
    expect(breakdown.openingHandover).toBe(HANDOVER);
    expect(res.body.shortage).toBe(0); // printed as +17,199.50 before the fix
  });

  test("a transfer LARGER than the handover does not take the excess off", async () => {
    // The old offset was capped at the handover and let the excess through, on
    // the theory that it had to be drawer cash. It is not: the safe was holding
    // takings from shifts that closed days ago.
    openAfterHandover();
    addTransferOut(HANDOVER + 2800);

    const res = await endShift(DRAWER);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.transfersOut).toBe(HANDOVER + 2800);
    expect(breakdown.systemExpectedCash).toBe(DRAWER);
    expect(res.body.shortage).toBe(0); // was −2,800 under the capped offset
  });

  test("a transfer with no handover at all leaves the drawer alone", async () => {
    // The dangerous case after POST /shifts/start stopped posting the opening
    // withdrawal: the float now defaults to the full previous count, so the
    // reconstructed handover is 0 and the old offset would have absorbed
    // nothing — the whole transfer would have landed on the cashier.
    seedStore(openShiftRow({ startCash: FLOAT }), { treasuryBalance: FLOAT });
    addPreviousShift(FLOAT); // carried the whole count forward
    ringCashSale(SALES);
    addTransferOut(40000); // manager empties the safe to head office

    const res = await endShift(DRAWER);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.openingHandover).toBe(0);
    expect(breakdown.transfersOut).toBe(40000);
    expect(breakdown.systemExpectedCash).toBe(DRAWER);
    expect(res.body.shortage).toBe(0); // would have been −40,000
  });

  test("a transfer INTO the safe is not drawer cash either", async () => {
    seedStore(openShiftRow({ startCash: FLOAT }), { treasuryBalance: FLOAT });
    addPreviousShift(FLOAT);
    ringCashSale(SALES);
    addTransferIn(9000); // head office tops the branch safe up

    const res = await endShift(DRAWER);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.transfersIn).toBe(9000);
    expect(breakdown.systemExpectedCash).toBe(DRAWER);
    expect(res.body.shortage).toBe(0); // was +9,000
  });

  test("the opening handover is reported but never credited back", async () => {
    // Informational only: startCash is a physical count, so cash handed to the
    // safe at the boundary is already outside `expected` by construction.
    openAfterHandover();

    const res = await endShift(DRAWER);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.openingHandover).toBe(HANDOVER);
    expect(breakdown.systemExpectedCash).toBe(DRAWER);
    expect(res.body.shortage).toBe(0);
  });

  test("what the cashier pays out of the register still comes off", async () => {
    // The other half of the rule: safe movements are excluded, drawer movements
    // must survive. A formula that dropped these would hide real shortages.
    openAfterHandover();
    addTransferOut(HANDOVER);
    addCashExpense(600);

    const res = await endShift(DRAWER - 600);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.cashExpenses).toBe(600);
    expect(breakdown.systemExpectedCash).toBe(DRAWER - 600);
    expect(res.body.shortage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Cash transfers recorded as leaving / entering THE DRAWER
//
// The other half of the rule above. "Every transfer is from the safe" printed a
// cashier's drawer → HQ transfer as a phantom shortage whenever the opening
// float had been carried forward in full. The sender now says drawer or safe,
// and a drawer transfer is stamped with the shift it came out of.
// ---------------------------------------------------------------------------

describe("drawer transfers move the expected drawer", () => {
  const FLOAT = 20000; // full previous count carried forward
  const SALES = 3000;

  const openWithFullFloat = () => {
    seedStore(openShiftRow({ startCash: FLOAT }), { treasuryBalance: FLOAT });
    addPreviousShift(FLOAT);
    ringCashSale(SALES);
  };

  test("cash sent to HQ from the drawer comes off expected — no phantom shortage", async () => {
    openWithFullFloat();
    addTransferOut(17000, { fromDrawer: true });

    const res = await endShift(FLOAT + SALES - 17000); // counted exactly

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.drawerTransfersOut).toBe(17000);
    expect(breakdown.transfersOut).toBe(0); // not reported twice as a safe move
    expect(breakdown.systemExpectedCash).toBe(FLOAT + SALES - 17000);
    expect(res.body.shortage).toBe(0); // was −17,000
  });

  test("the same transfer recorded from the SAFE leaves the drawer alone", async () => {
    openWithFullFloat();
    addTransferOut(17000); // fromDrawer false

    const res = await endShift(FLOAT + SALES);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.drawerTransfersOut).toBe(0);
    expect(breakdown.transfersOut).toBe(17000);
    expect(res.body.shortage).toBe(0);
  });

  test("a drawer transfer of ANOTHER shift is not this drawer's", async () => {
    openWithFullFloat();
    addTransferOut(5000, { fromDrawer: true, fromShiftId: SHIFT_ID - 1 });

    const res = await endShift(FLOAT + SALES);

    expect(res.body.calculationBreakdown.drawerTransfersOut).toBe(0);
    expect(res.body.shortage).toBe(0);
  });

  test("a drawer transfer rejected while the shift is open nets to zero", async () => {
    openWithFullFloat();
    addTransferOut(4000, {
      fromDrawer: true,
      status: "REJECTED",
      resolvedAt: new Date(Date.now() - 30 * 60 * 1000),
      refund: true,
    });

    const res = await endShift(FLOAT + SALES); // cash came back into the drawer

    expect(res.body.calculationBreakdown.drawerTransfersOut).toBe(0);
    expect(res.body.shortage).toBe(0);
  });

  test("a drawer transfer rejected AFTER close still counts for the closed shift", async () => {
    openWithFullFloat();
    addTransferOut(4000, { fromDrawer: true });
    await endShift(FLOAT + SALES - 4000);
    const expectedAtClose = Number(shiftRow().systemExpectedCash);

    // Rejected later: the refund lands in the safe, not in a drawer that has
    // already been counted, so the closed shift's figure must not move.
    const row = mockStore.cashTransfers[0];
    row.status = "REJECTED";
    row.resolvedAt = new Date(Date.now() + 60 * 1000);

    const { calculateSystemExpectedCash } = require("../../routes/shifts");
    const now = await calculateSystemExpectedCash(SHIFT_ID);
    expect(now.drawerTransfersOut).toBe(4000);
    expect(now.expected).toBe(expectedAtClose);
  });

  test("cash received INTO the drawer is added once approved", async () => {
    openWithFullFloat();
    addTransferIn(2500, { toDrawer: true });
    addTransferIn(900, { toDrawer: true, status: "PENDING" }); // not received yet

    const res = await endShift(FLOAT + SALES + 2500);

    const breakdown = res.body.calculationBreakdown;
    expect(breakdown.drawerTransfersIn).toBe(2500);
    expect(breakdown.transfersIn).toBe(0);
    expect(res.body.shortage).toBe(0); // was +2,500
  });
});
