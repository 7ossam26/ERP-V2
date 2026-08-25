/**
 * Wholesale collections on GET /api/branches/balances.
 *
 * This page is the CASH view: money that actually reached the till. Wholesale
 * used to be summed as BulkOrder.paidAmount filtered by the ORDER's createdAt —
 * a running total dated by when the order was raised, so a September payment on
 * an August order landed in August and re-running a closed month gave a
 * different answer. These tests pin the payment-date basis and its exclusions.
 */

jest.mock("../../config/database", () => ({
  user: { findUnique: jest.fn() },
  branch: { findMany: jest.fn() },
  sale: { groupBy: jest.fn() },
  systemConfiguration: { findFirst: jest.fn() },
  treasury: { findUnique: jest.fn() },
  bulkPayment: { findMany: jest.fn() },
  bulkRefund: { findMany: jest.fn() },
  expense: { groupBy: jest.fn() },
  shift: { findMany: jest.fn() },
}));

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireCreatePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  requireSensitiveAccess: () => (req, res, next) => next(),
  getUserBranchFilter: jest.fn(async () => null),
}));

jest.mock("../../routes/shifts", () => ({
  calculateSystemExpectedCash: jest.fn(async () => ({ expected: 0 })),
}));

const prisma = require("../../config/database");
const router = require("../../routes/branches");

const handlerFor = (path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
};

const balances = handlerFor("/balances");

const BRANCH = {
  id: 1,
  name: "فرع أ",
  address: null,
  warehouseId: 100,
  treasuryId: 200,
  treasury: { balance: 0, name: "خزينة الفرع" },
};

const runBalances = async (query = {}) => {
  let payload;
  const res = {
    json: (p) => {
      payload = p;
    },
    status: () => res,
  };
  const next = (err) => {
    throw err;
  };
  await balances({ query, user: { id: 1 } }, res, next);
  if (!payload) throw new Error("handler did not respond");
  return payload;
};

const setData = ({
  payments = [],
  prevPayments = [],
  refunds = [],
  prevRefunds = [],
} = {}) => {
  prisma.user.findUnique.mockResolvedValue({ role: { name: "Superadmin" } });
  prisma.branch.findMany.mockResolvedValue([BRANCH]);
  // No retail activity — this suite is about the wholesale figure.
  prisma.sale.groupBy.mockResolvedValue([]);
  prisma.systemConfiguration.findFirst.mockResolvedValue(null);
  prisma.treasury.findUnique.mockResolvedValue(null);
  prisma.expense.groupBy.mockResolvedValue([]);
  prisma.shift.findMany.mockResolvedValue([]);

  // Promise.all evaluates in array order: payments, refunds, prevPayments,
  // prevRefunds.
  prisma.bulkPayment.findMany
    .mockResolvedValueOnce(payments)
    .mockResolvedValueOnce(prevPayments);
  prisma.bulkRefund.findMany
    .mockResolvedValueOnce(refunds)
    .mockResolvedValueOnce(prevRefunds);
};

const AUG = { from: "2026-08-01", to: "2026-08-31" };

beforeEach(() => jest.clearAllMocks());

describe("wholesale is dated by when the money arrived", () => {
  test("the query windows on receivedAt, not on the order's createdAt", async () => {
    setData({});
    await runBalances(AUG);

    const where = prisma.bulkPayment.findMany.mock.calls[0][0].where;
    expect(where).toHaveProperty("receivedAt");
    expect(where).not.toHaveProperty("createdAt");
    // Cairo midnight for 2026-08-01 is 22:00Z the previous day.
    expect(where.receivedAt.gte.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(where.receivedAt.lte.toISOString()).toBe("2026-08-31T21:59:59.999Z");
  });

  test("voided payments are excluded", async () => {
    setData({});
    await runBalances(AUG);

    const where = prisma.bulkPayment.findMany.mock.calls[0][0].where;
    expect(where.voidedAt).toBeNull();
  });

  test("legacy opening debt (orderId NULL + negative amount) is excluded", async () => {
    setData({});
    await runBalances(AUG);

    const where = prisma.bulkPayment.findMany.mock.calls[0][0].where;
    // Positive complement of (orderId IS NULL AND amount < 0).
    expect(where.OR).toEqual([{ orderId: { not: null } }, { amount: { gte: 0 } }]);
  });

  test("the exclusion admits real payments and rejects only opening debt", async () => {
    // De Morgan check on the clause above, evaluated directly so a future edit
    // that flips a comparison fails here rather than in production.
    const admits = ({ orderId, amount }) =>
      orderId !== null || amount >= 0;

    expect(admits({ orderId: 5, amount: 3000 })).toBe(true); // normal payment
    expect(admits({ orderId: 5, amount: -100 })).toBe(true); // correction on an order
    expect(admits({ orderId: null, amount: 500 })).toBe(true); // unlinked settlement
    expect(admits({ orderId: null, amount: -5000 })).toBe(false); // opening debt
  });

  test("only CASH_REFUND reduces collections — a credit note moves no cash", async () => {
    setData({});
    await runBalances(AUG);

    const where = prisma.bulkRefund.findMany.mock.calls[0][0].where;
    expect(where.method).toBe("CASH_REFUND");
  });
});

describe("attribution and arithmetic", () => {
  test("a payment is attributed to the branch that owns the order's warehouse", async () => {
    setData({
      payments: [{ amount: "3000.00", treasuryId: 999, order: { warehouseId: 100 } }],
    });
    const [row] = await runBalances(AUG);

    expect(row.bulkSales).toBe(3000);
  });

  test("a payment with no order falls back to the treasury it landed in", async () => {
    setData({
      payments: [{ amount: "1500.00", treasuryId: 200, order: null }],
    });
    const [row] = await runBalances(AUG);

    expect(row.bulkSales).toBe(1500);
  });

  test("a payment into a non-branch treasury with no order is not attributed", async () => {
    setData({
      payments: [{ amount: "800.00", treasuryId: 999, order: null }],
    });
    const [row] = await runBalances(AUG);

    expect(row.bulkSales).toBe(0);
  });

  test("cash refunds are subtracted from collections", async () => {
    setData({
      payments: [{ amount: "5000.00", treasuryId: 200, order: { warehouseId: 100 } }],
      refunds: [{ amount: "2000.00", treasuryId: 200, order: { warehouseId: 100 } }],
    });
    const [row] = await runBalances(AUG);

    expect(row.bulkSales).toBe(3000);
  });

  test("a refund with no matching payment in the window goes negative, not to zero", async () => {
    // Money genuinely left the till this month; hiding it would overstate takings.
    setData({
      refunds: [{ amount: "2000.00", treasuryId: 200, order: { warehouseId: 100 } }],
    });
    const [row] = await runBalances(AUG);

    expect(row.bulkSales).toBe(-2000);
  });

  test("wholesale lands in the branch total", async () => {
    setData({
      payments: [{ amount: "4000.00", treasuryId: 200, order: { warehouseId: 100 } }],
    });
    const [row] = await runBalances(AUG);

    expect(row.total).toBe(4000);
  });

  test("the previous window is computed from its own payments", async () => {
    setData({
      payments: [{ amount: "1000.00", treasuryId: 200, order: { warehouseId: 100 } }],
      prevPayments: [{ amount: "600.00", treasuryId: 200, order: { warehouseId: 100 } }],
    });
    const [row] = await runBalances(AUG);

    expect(row.total).toBe(1000);
    expect(row.prevTotal).toBe(600);
  });
});

describe("retail invoice count", () => {
  test("refund rows are excluded from the count but not from the sums", async () => {
    setData({});
    await runBalances(AUG);

    // The count query is the one asking for _count.
    const countCall = prisma.sale.groupBy.mock.calls.find(
      ([args]) => args._count,
    );
    expect(countCall[0].where.NOT).toEqual({
      saleNumber: { startsWith: "REFUND-" },
    });

    // The money queries must NOT carry that exclusion.
    const sumCalls = prisma.sale.groupBy.mock.calls.filter(([args]) => args._sum);
    expect(sumCalls.length).toBeGreaterThan(0);
    for (const [args] of sumCalls) {
      expect(args.where.NOT).toBeUndefined();
    }
  });

  test("voided sales are excluded everywhere", async () => {
    setData({});
    await runBalances(AUG);

    for (const [args] of prisma.sale.groupBy.mock.calls) {
      expect(args.where.isVoided).toBe(false);
    }
  });
});
