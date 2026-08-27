/**
 * إهلاك in GET /api/reports/general.
 *
 * A consumable (tissues, bags) is bought but never sold, so no sale line ever
 * carries its cost — and its purchase Expense row is excluded from operating
 * expenses by design, because a purchase's cost is meant to become COGS when the
 * stock sells. For a consumable that never happens, so the cost was recognised
 * NOWHERE and net profit was overstated by it permanently.
 *
 * These tests pin the fix: the write-off's cost lands in COGS, in operating
 * expenses NOTHING changes, revenue is untouched, and a reversal unwinds itself.
 */

jest.mock("../../config/database", () => ({
  sale: { findMany: jest.fn() },
  bulkOrder: { findMany: jest.fn() },
  bulkRefund: { findMany: jest.fn() },
  stockWriteOff: { findMany: jest.fn() },
  expense: { findMany: jest.fn() },
  branch: { findMany: jest.fn() },
  inventory: { findMany: jest.fn() },
  item: { findMany: jest.fn() },
}));

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
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

const retailSale = {
  saleNumber: "SALE-202608-00001",
  total: "1000.00",
  createdAt: IN_WINDOW,
  branch: { name: "فرع أ" },
  items: [
    { item: { name: "لاتيه" }, total: "1000.00", quantity: 2, costPrice: 300 },
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

// 10 tissue boxes at 25 = 250 of cost that today is recognised nowhere.
const tissueWriteOff = { quantity: 10, unitCost: 25, reason: "INTERNAL_USE" };
// Its contra row: negative quantity, unit cost COPIED from the original.
const tissueReversal = { quantity: -10, unitCost: 25, reason: "INTERNAL_USE" };
const damagedWriteOff = { quantity: 2, unitCost: 100, reason: "DAMAGED" };

const setData = ({
  sales = [],
  bulk = [],
  refunds = [],
  expenses = [],
  writeOffs = [],
}) => {
  prisma.sale.findMany.mockResolvedValue(sales);
  prisma.bulkOrder.findMany.mockResolvedValue(bulk);
  prisma.bulkRefund.findMany.mockResolvedValue(refunds);
  prisma.stockWriteOff.findMany.mockResolvedValue(writeOffs);
  prisma.expense.findMany.mockResolvedValue(expenses);
  prisma.inventory.findMany.mockResolvedValue([]);
  prisma.item.findMany.mockResolvedValue([]);
  prisma.branch.findMany.mockResolvedValue([]);
};

// Baseline: retail COGS 600 (2 × 300) + wholesale COGS 2000 (10 × 200) = 2600.
const BASE = { sales: [retailSale], bulk: [bulkOrder] };

beforeEach(() => jest.clearAllMocks());

// ── tests ───────────────────────────────────────────────────────────────────

describe("write-off cost is recognised as COGS", () => {
  test("it adds to cogs and NOT to operating expenses", async () => {
    setData({
      ...BASE,
      expenses: [{ type: "MANUAL", amount: "500.00" }],
      writeOffs: [tissueWriteOff],
    });
    const { summary } = await runReport(AUG);

    expect(summary.cogs).toBe(2600 + 250);
    // The whole point: no Expense row is written, so this must not budge.
    expect(summary.operatingExpenses).toBe(500);
  });

  test("gross profit and net profit each drop by the write-off cost", async () => {
    setData({ ...BASE, writeOffs: [] });
    const before = (await runReport(AUG)).summary;

    setData({ ...BASE, writeOffs: [tissueWriteOff] });
    const after = (await runReport(AUG)).summary;

    expect(after.grossProfit).toBeCloseTo(before.grossProfit - 250, 2);
    expect(after.netProfit).toBeCloseTo(before.netProfit - 250, 2);
  });

  test("writeOffCost is reported on its own so the COGS jump is explainable", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff, damagedWriteOff] });
    const { summary } = await runReport(AUG);

    expect(summary.writeOffCost).toBe(250 + 200);
    expect(summary.retailCogs).toBe(600);
    expect(summary.wholesaleCogs).toBe(2000);
    // The three halves must reconstruct the headline figure exactly.
    expect(summary.retailCogs + summary.wholesaleCogs + summary.writeOffCost).toBeCloseTo(
      summary.cogs,
      2,
    );
  });

  test("REGRESSION: no write-offs is a strict no-op on every summary figure", async () => {
    setData({ ...BASE, expenses: [{ type: "MANUAL", amount: "500.00" }] });
    const { summary } = await runReport(AUG);

    expect(summary.cogs).toBe(2600);
    expect(summary.writeOffCost).toBe(0);
    expect(summary.writeOffCount).toBe(0);
    expect(summary.grossProfit).toBe(6000 - 2600);
    expect(summary.netProfit).toBe(6000 - 2600 - 500);
  });
});

describe("a reversal is a contra row, not a deletion", () => {
  test("it unwinds its original to exactly zero", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff, tissueReversal] });
    const { summary } = await runReport(AUG);

    expect(summary.writeOffCost).toBe(0);
    expect(summary.cogs).toBe(2600);
  });

  test("it is not counted as another إهلاك", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff, tissueReversal] });
    const { summary } = await runReport(AUG);

    // Same rule as invoiceCount for REFUND- rows: a reversal is not an event.
    expect(summary.writeOffCount).toBe(1);
  });

  test("a reversal alone in a later window credits that window", async () => {
    // The original landed in July; only its August reversal is in range. The
    // month that already closed is left alone — that is why reversal is a new
    // row rather than a delete.
    setData({ ...BASE, writeOffs: [tissueReversal] });
    const { summary } = await runReport(AUG);

    expect(summary.writeOffCost).toBe(-250);
    expect(summary.cogs).toBe(2600 - 250);
  });
});

describe("REGRESSION: write-offs never leak into revenue", () => {
  test("sales figures and invoice counts are untouched", async () => {
    setData({ ...BASE });
    const before = (await runReport(AUG)).summary;

    setData({ ...BASE, writeOffs: [tissueWriteOff, damagedWriteOff] });
    const after = (await runReport(AUG)).summary;

    expect(after.totalSales).toBe(before.totalSales);
    expect(after.retailSales).toBe(before.retailSales);
    expect(after.wholesaleSales).toBe(before.wholesaleSales);
    expect(after.invoiceCount).toBe(before.invoiceCount);
    expect(after.retailInvoiceCount).toBe(before.retailInvoiceCount);
  });

  test("salesOverTime still totals to totalSales", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff] });
    const { summary, charts } = await runReport(AUG);

    const charted = charts.salesOverTime.data.reduce((a, b) => a + b, 0);
    expect(charted).toBeCloseTo(summary.totalSales, 2);
  });

  test("salesByBranch still totals to totalSales", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff] });
    const { summary, tables } = await runReport(AUG);

    const tabled = tables.salesByBranch.reduce((a, r) => a + r.totalSales, 0);
    expect(tabled).toBeCloseTo(summary.totalSales, 2);
  });
});

describe("the write-off query predicate", () => {
  test("filters on the business date, never on createdAt", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff] });
    await runReport(AUG);

    const where = prisma.stockWriteOff.findMany.mock.calls[0][0].where;
    expect(where.date).toBeDefined();
    // Filtering on createdAt would book a back-dated correction in the month it
    // was typed rather than the month it belongs to.
    expect(where.createdAt).toBeUndefined();
  });

  test("uses Cairo day boundaries, not the server's timezone", async () => {
    setData({ ...BASE, writeOffs: [] });
    await runReport(AUG);

    const where = prisma.stockWriteOff.findMany.mock.calls[0][0].where;
    // 2026-08-01 00:00 Cairo (UTC+2) is 2026-07-31T22:00:00Z.
    expect(where.date.gte.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(where.date.lte.toISOString()).toBe("2026-08-31T21:59:59.999Z");
  });

  test("is warehouse-scoped for a single branch, exactly like wholesale", async () => {
    require("../../middleware/auth").getUserBranchFilter.mockResolvedValueOnce({
      id: 7,
    });
    setData({ ...BASE, writeOffs: [] });
    prisma.branch.findMany.mockResolvedValue([
      { id: 7, name: "فرع أ", warehouseId: 3 },
    ]);

    await runReport(AUG);

    const where = prisma.stockWriteOff.findMany.mock.calls[0][0].where;
    expect(where.warehouseId).toEqual({ in: [3] });
  });

  test("a branch with no linked warehouse reports zero write-offs, not all of them", async () => {
    require("../../middleware/auth").getUserBranchFilter.mockResolvedValueOnce({
      id: 7,
    });
    setData({ ...BASE, writeOffs: [] });
    prisma.branch.findMany.mockResolvedValue([
      { id: 7, name: "فرع بدون مخزن", warehouseId: null },
    ]);

    await runReport(AUG);

    const where = prisma.stockWriteOff.findMany.mock.calls[0][0].where;
    // `{ in: [] }` matches nothing. An ABSENT warehouseId would match every
    // warehouse in the system and charge one branch for the whole group.
    expect(where.warehouseId).toEqual({ in: [] });
  });

  test("an unscoped (all-branches) report applies no warehouse filter", async () => {
    setData({ ...BASE, writeOffs: [] });
    await runReport(AUG);

    const where = prisma.stockWriteOff.findMany.mock.calls[0][0].where;
    expect(where.warehouseId).toBeUndefined();
  });
});

describe("the reason breakdown", () => {
  test("writeOffsByReason totals to writeOffCost", async () => {
    setData({ ...BASE, writeOffs: [tissueWriteOff, damagedWriteOff] });
    const { summary, tables } = await runReport(AUG);

    const summed = tables.writeOffsByReason.reduce((a, r) => a + r.cost, 0);
    expect(summed).toBeCloseTo(summary.writeOffCost, 2);
  });

  test("it groups by reason and sorts by cost descending", async () => {
    setData({ ...BASE, writeOffs: [damagedWriteOff, tissueWriteOff] });
    const { tables } = await runReport(AUG);

    expect(tables.writeOffsByReason).toEqual([
      { reason: "INTERNAL_USE", cost: 250, quantity: 10 },
      { reason: "DAMAGED", cost: 200, quantity: 2 },
    ]);
  });
});
