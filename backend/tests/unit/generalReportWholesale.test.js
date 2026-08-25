/**
 * Money math for GET /api/reports/general.
 *
 * The report used to sum retail `sales` only, which is why it never agreed with
 * مبيعات الفروع. These tests pin the arithmetic now that wholesale is folded in:
 * revenue AND its cost, returns reversed in the window they happened, and the
 * chart still adding up to the headline card.
 */

jest.mock("../../config/database", () => ({
  sale: { findMany: jest.fn() },
  bulkOrder: { findMany: jest.fn() },
  bulkRefund: { findMany: jest.fn() },
  expense: { findMany: jest.fn() },
  branch: { findMany: jest.fn() },
  inventory: { findMany: jest.fn() },
  item: { findMany: jest.fn() },
}));

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  // null = global role, sees every branch (no branch filter applied)
  getUserBranchFilter: jest.fn(async () => null),
}));

const prisma = require("../../config/database");
const router = require("../../routes/reports");

const handlerFor = (path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
};

const generalReport = handlerFor("/general");

const runReport = async (query = {}) => {
  let payload;
  const res = {
    json: (p) => {
      payload = p;
    },
    status: () => res,
  };
  await generalReport({ query, user: { id: 1 } }, res);
  if (!payload) throw new Error("handler did not respond");
  return payload;
};

// ── fixtures ────────────────────────────────────────────────────────────────

const AUG = { startDate: "2026-08-01", endDate: "2026-08-31" };
const IN_WINDOW = new Date("2026-08-10T09:00:00.000Z");
const LATER_IN_WINDOW = new Date("2026-08-20T09:00:00.000Z");

const retailSale = {
  saleNumber: "SALE-202608-00001",
  total: "1000.00",
  createdAt: IN_WINDOW,
  branch: { name: "فرع أ" },
  items: [
    { item: { name: "لاتيه" }, total: "1000.00", quantity: 2, costPrice: 300 },
  ],
};

// Refunds are negative COMPLETED sales, not a separate table.
const retailRefund = {
  saleNumber: "REFUND-202608-00001",
  total: "-200.00",
  createdAt: IN_WINDOW,
  branch: { name: "فرع أ" },
  items: [
    { item: { name: "لاتيه" }, total: "-200.00", quantity: -1, costPrice: 300 },
  ],
};

const bulkOrder = {
  id: 10,
  total: "5000.00",
  createdAt: IN_WINDOW,
  warehouse: { branch: { name: "فرع أ" } },
  items: [
    { item: { name: "بن" }, lineTotal: "5000.00", quantity: 10, costPrice: 200 },
  ],
};

const setData = ({ sales = [], bulk = [], refunds = [], expenses = [] }) => {
  prisma.sale.findMany.mockResolvedValue(sales);
  prisma.bulkOrder.findMany.mockResolvedValue(bulk);
  prisma.bulkRefund.findMany.mockResolvedValue(refunds);
  prisma.expense.findMany.mockResolvedValue(expenses);
  prisma.inventory.findMany.mockResolvedValue([]);
  prisma.item.findMany.mockResolvedValue([]);
  prisma.branch.findMany.mockResolvedValue([]);
};

beforeEach(() => jest.clearAllMocks());

// ── tests ───────────────────────────────────────────────────────────────────

describe("wholesale is included in the general report", () => {
  test("totalSales = retail + wholesale, and the split is reported", async () => {
    setData({ sales: [retailSale], bulk: [bulkOrder] });
    const { summary } = await runReport(AUG);

    expect(summary.retailSales).toBe(1000);
    expect(summary.wholesaleSales).toBe(5000);
    expect(summary.totalSales).toBe(6000);
  });

  test("wholesale carries its own COGS, so margin stays real", async () => {
    setData({ sales: [retailSale], bulk: [bulkOrder] });
    const { summary } = await runReport(AUG);

    // retail 2 × 300 = 600, wholesale 10 × 200 = 2000
    expect(summary.cogs).toBe(2600);
    expect(summary.grossProfit).toBe(6000 - 2600);
  });

  test("REGRESSION: adding wholesale revenue without its cost would show ~100% margin", async () => {
    setData({ sales: [], bulk: [bulkOrder] });
    const { summary } = await runReport(AUG);

    expect(summary.totalSales).toBe(5000);
    expect(summary.cogs).toBe(2000);
    expect(summary.grossProfit).not.toBe(summary.totalSales);
  });

  test("net profit subtracts operating expenses but not PURCHASE rows", async () => {
    setData({
      sales: [retailSale],
      bulk: [bulkOrder],
      expenses: [
        { type: "MANUAL", amount: "500.00" },
        { type: "PURCHASE", amount: "9999.00" }, // recognised via COGS instead
      ],
    });
    const { summary } = await runReport(AUG);

    expect(summary.operatingExpenses).toBe(500);
    expect(summary.netProfit).toBe(6000 - 2600 - 500);
  });
});

describe("returns", () => {
  test("a retail refund nets the money down but is not a second invoice", async () => {
    setData({ sales: [retailSale, retailRefund] });
    const { summary } = await runReport(AUG);

    expect(summary.retailSales).toBe(800);
    expect(summary.cogs).toBe(600 - 300);
    expect(summary.invoiceCount).toBe(1);
  });

  test("a wholesale return reverses the full order — revenue and cost", async () => {
    setData({
      sales: [],
      bulk: [bulkOrder],
      refunds: [{ orderId: 10, createdAt: LATER_IN_WINDOW, order: bulkOrder }],
    });
    const { summary } = await runReport(AUG);

    expect(summary.wholesaleSales).toBe(0);
    expect(summary.cogs).toBe(0);
  });

  test("a return of an order invoiced in an EARLIER window books the reversal here", async () => {
    // The order itself is outside the window, so bulk is empty — only the
    // reversal lands. This is what keeps a closed month from being rewritten.
    setData({
      sales: [],
      bulk: [],
      refunds: [{ orderId: 10, createdAt: LATER_IN_WINDOW, order: bulkOrder }],
    });
    const { summary } = await runReport(AUG);

    expect(summary.wholesaleSales).toBe(-5000);
    expect(summary.cogs).toBe(-2000);
  });

  test("several refund rows on one order reverse it only once", async () => {
    setData({
      sales: [],
      bulk: [bulkOrder],
      refunds: [
        { orderId: 10, createdAt: LATER_IN_WINDOW, order: bulkOrder },
        { orderId: 10, createdAt: LATER_IN_WINDOW, order: bulkOrder },
      ],
    });
    const { summary } = await runReport(AUG);

    expect(summary.wholesaleSales).toBe(0);
  });

  test("a returned order still counts as an invoice issued in its window", async () => {
    setData({
      sales: [],
      bulk: [bulkOrder],
      refunds: [{ orderId: 10, createdAt: LATER_IN_WINDOW, order: bulkOrder }],
    });
    const { summary } = await runReport(AUG);

    expect(summary.invoiceCount).toBe(1);
  });
});

describe("the chart and the table agree with the headline card", () => {
  test("salesOverTime totals to totalSales", async () => {
    setData({
      sales: [retailSale, retailRefund],
      bulk: [bulkOrder],
      refunds: [{ orderId: 10, createdAt: LATER_IN_WINDOW, order: bulkOrder }],
    });
    const { summary, charts } = await runReport(AUG);

    const charted = charts.salesOverTime.data.reduce((a, b) => a + b, 0);
    expect(charted).toBeCloseTo(summary.totalSales, 2);
  });

  test("salesByBranch totals to totalSales", async () => {
    setData({ sales: [retailSale, retailRefund], bulk: [bulkOrder] });
    const { summary, tables } = await runReport(AUG);

    const tabled = tables.salesByBranch.reduce((a, r) => a + r.totalSales, 0);
    expect(tabled).toBeCloseTo(summary.totalSales, 2);
  });

  test("a sale just after Cairo midnight is not dropped from the chart", async () => {
    // 22:30Z on Aug 9 is 00:30 Cairo on Aug 10. Keying by UTC put this on a
    // bucket that was never seeded and the amount vanished from the chart.
    const afterMidnight = {
      ...retailSale,
      createdAt: new Date("2026-08-09T22:30:00.000Z"),
    };
    setData({ sales: [afterMidnight] });
    const { summary, charts } = await runReport(AUG);

    const charted = charts.salesOverTime.data.reduce((a, b) => a + b, 0);
    expect(charted).toBeCloseTo(summary.totalSales, 2);
    expect(charts.salesOverTime.labels).toContain("2026-08-10");
  });
});

describe("branch scoping", () => {
  test("a branch with no linked warehouse is named, not silently zeroed", async () => {
    require("../../middleware/auth").getUserBranchFilter.mockResolvedValueOnce({
      id: 7,
    });
    setData({ sales: [], bulk: [] });
    prisma.branch.findMany.mockResolvedValue([
      { id: 7, name: "فرع بدون مخزن", warehouseId: null },
    ]);

    const { summary } = await runReport(AUG);

    expect(summary.wholesaleSales).toBe(0);
    expect(summary.branchesMissingWarehouse).toEqual(["فرع بدون مخزن"]);
  });
});
