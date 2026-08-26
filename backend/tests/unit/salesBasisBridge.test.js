/**
 * The reconciliation between التقرير العام (accrual) and مبيعات الفروع (cash).
 *
 * The two pages disagreed on the same date filter and nobody could say why. On
 * production the daily gap swung from −75,120 to +40,470, so a real bug and a
 * legitimate wholesale timing difference looked identical from the UI.
 *
 * lib/salesBasisBridge.js decomposes that gap. These tests pin the one property
 * that makes it worth trusting: **it ties out to the cent**. If the terms don't
 * sum to the gap, the panel is confidently explaining a number with the wrong
 * reasons — worse than showing nothing. `residual` is the canary and every
 * fixture here asserts it is exactly 0.
 *
 * The per-term tests exist because each term mirrors a predicate that lives in
 * a DIFFERENT file (routes/reports.js for accrual, routes/branches.js for cash).
 * A predicate edited there and not here would silently mis-attribute the gap.
 */

jest.mock("../../config/database", () => ({
  branch: { findMany: jest.fn() },
  sale: { findMany: jest.fn() },
  bulkOrder: { findMany: jest.fn() },
  bulkRefund: { findMany: jest.fn() },
  bulkPayment: { findMany: jest.fn() },
}));

const prisma = require("../../config/database");
const { parseDateStart, parseDateEnd } = require("../../utils/dateRange");
const {
  computeSalesBasisBridge,
  INVOICED_BULK_STATUSES,
} = require("../../lib/salesBasisBridge");

const START = parseDateStart("2026-08-02");
const END = parseDateEnd("2026-08-02");
const IN_WINDOW = new Date("2026-08-02T12:00:00.000Z");
const BEFORE_WINDOW = new Date("2026-07-20T12:00:00.000Z");

// Three branches: two live, one shut down. The shut-down one is what makes the
// `inactiveBranchSales` term non-zero — التقرير العام still counts it,
// مبيعات الفروع drops it entirely (branches.js:151 `where = { isActive: true }`).
const BRANCHES = [
  { id: 1, name: "فرع أ", isActive: true, warehouseId: 100, treasuryId: 200 },
  { id: 2, name: "فرع ب", isActive: true, warehouseId: 101, treasuryId: 201 },
  { id: 3, name: "فرع موقوف", isActive: false, warehouseId: 102, treasuryId: 202 },
];

const sale = (over) => ({
  total: "0.00",
  saleNumber: "SALE-1",
  paymentMethod: "CASH",
  deliveryStatus: null,
  branchId: 1,
  ...over,
});

// A fixture that makes EVERY term non-zero at once. Amounts are deliberately
// distinct so a mis-routed row shows up as a wrong number, not a coincidence.
const SALES = [
  sale({ saleNumber: "SALE-1", total: "1000.00" }), // collected, cash
  sale({ saleNumber: "SALE-2", total: "500.00", paymentMethod: "VISA" }), // collected, card
  sale({ saleNumber: "REFUND-1", total: "-200.00" }), // nets money, not an invoice
  sale({ saleNumber: "SALE-4", total: "300.00", deliveryStatus: "OUT_FOR_DELIVERY" }),
  sale({ saleNumber: "SALE-5", total: "150.00", deliveryStatus: "RETURNED", branchId: 2 }),
  sale({ saleNumber: "SALE-6", total: "700.00", branchId: 3 }), // inactive branch
  sale({ saleNumber: "SALE-7", total: "250.00", deliveryStatus: "DELIVERED", branchId: 2 }),
];

const BULK_ORDERS = [
  { id: 10, orderNumber: "BULK-0021", total: "6400.00", createdAt: IN_WINDOW, status: "PAID", warehouseId: 100 },
  { id: 11, orderNumber: "BULK-0022", total: "1000.00", createdAt: IN_WINDOW, status: "PAID", warehouseId: 101 },
];

const BULK_PAYMENTS = [
  // Paid in the same window it was invoiced in — the only fully-reconciled case.
  { amount: "1000.00", treasuryId: 201, orderId: 11, order: { id: 11, orderNumber: "BULK-0022", warehouseId: 101, createdAt: IN_WINDOW } },
  // Cash arriving now against an invoice raised earlier.
  { amount: "2000.00", treasuryId: 200, orderId: 99, order: { id: 99, orderNumber: "BULK-0009", warehouseId: 100, createdAt: BEFORE_WINDOW } },
  // On-account settlement with no invoice behind it at all.
  { amount: "500.00", treasuryId: 200, orderId: null, order: null },
  // Neither the warehouse nor the treasury maps to a branch → both pages drop it.
  { amount: "750.00", treasuryId: 999, orderId: 98, order: { id: 98, orderNumber: "BULK-0008", warehouseId: 999, createdAt: BEFORE_WINDOW } },
];

// Two refund rows against ONE order: the accrual reversal must count the order
// once, the cash leg must sum both rows — and only the CASH_REFUND one moves money.
const BULK_REFUNDS = [
  { orderId: 50, method: "CREDIT_NOTE", amount: "300.00", treasuryId: 200, order: { orderNumber: "BULK-0050", total: "5000.00", warehouseId: 100 } },
  { orderId: 50, method: "CASH_REFUND", amount: "200.00", treasuryId: 200, order: { orderNumber: "BULK-0050", total: "5000.00", warehouseId: 100 } },
];

const seed = ({
  branches = BRANCHES,
  sales = SALES,
  orders = BULK_ORDERS,
  payments = BULK_PAYMENTS,
  refunds = BULK_REFUNDS,
} = {}) => {
  prisma.branch.findMany.mockResolvedValue(branches);
  prisma.sale.findMany.mockResolvedValue(sales);
  prisma.bulkOrder.findMany.mockResolvedValue(orders);
  prisma.bulkPayment.findMany.mockResolvedValue(payments);
  prisma.bulkRefund.findMany.mockResolvedValue(refunds);
};

const run = (opts = {}) =>
  computeSalesBasisBridge({ start: START, end: END, branchIds: null, ...opts });

const termOf = (bridge, key) => bridge.terms.find((t) => t.key === key);
const sumTerms = (bridge) => bridge.terms.reduce((s, t) => s + t.amount, 0);

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

describe("the bridge ties out", () => {
  it("accounts for the whole money gap, to the cent", async () => {
    const bridge = await run();

    // retail 2700 + wholesale invoiced 7400 − returns 5000
    expect(bridge.accrual.total).toBe(5100);
    // retail 1550 + collected 3500 − cash refunded 200
    expect(bridge.cash.total).toBe(4850);
    expect(bridge.gap).toBe(250);

    expect(sumTerms(bridge)).toBe(250);
    // The property the whole panel rests on.
    expect(bridge.residual).toBe(0);
  });

  it("accounts for the whole invoice-count gap", async () => {
    const bridge = await run();

    expect(bridge.accrual.retailInvoiceCount).toBe(6); // REFUND- row excluded
    expect(bridge.accrual.wholesaleOrderCount).toBe(2);
    expect(bridge.accrual.invoiceCount).toBe(8);
    expect(bridge.cash.invoiceCount).toBe(3);

    expect(bridge.counts.gap).toBe(5);
    expect(bridge.counts.terms.reduce((s, t) => s + t.amount, 0)).toBe(5);
    expect(bridge.counts.residual).toBe(0);
  });

  it("still ties out when nothing differs", async () => {
    seed({ sales: [sale({ total: "1000.00" })], orders: [], payments: [], refunds: [] });
    const bridge = await run();

    expect(bridge.accrual.total).toBe(1000);
    expect(bridge.cash.total).toBe(1000);
    expect(bridge.gap).toBe(0);
    expect(bridge.residual).toBe(0);
  });
});

describe("retail terms", () => {
  it("separates money still on the road from money that will never arrive", async () => {
    const bridge = await run();

    // A manager reads these opposite ways: one is coming, one is gone.
    expect(termOf(bridge, "deliveryCashInFlight").amount).toBe(300);
    expect(termOf(bridge, "deliveryFailed").amount).toBe(150);
  });

  it("attributes an inactive branch's sale to the branch term only, never to delivery", async () => {
    // The disjointness that keeps the identity honest: this row is BOTH at an
    // inactive branch AND undelivered, and must be counted exactly once.
    seed({
      sales: [sale({ total: "700.00", branchId: 3, deliveryStatus: "OUT_FOR_DELIVERY" })],
      orders: [],
      payments: [],
      refunds: [],
    });
    const bridge = await run();

    expect(termOf(bridge, "inactiveBranchSales").amount).toBe(700);
    expect(termOf(bridge, "deliveryCashInFlight").amount).toBe(0);
    expect(bridge.residual).toBe(0);
  });

  it("counts card sales as collected regardless of delivery state", async () => {
    // branches.js gates only CASH on delivery — the card is charged at the till.
    seed({
      sales: [sale({ total: "500.00", paymentMethod: "VISA", deliveryStatus: "PENDING" })],
      orders: [],
      payments: [],
      refunds: [],
    });
    const bridge = await run();

    expect(bridge.cash.retail).toBe(500);
    expect(bridge.gap).toBe(0);
  });
});

describe("wholesale terms", () => {
  it("names the invoice behind an uncollected wholesale gap", async () => {
    const bridge = await run();
    const term = termOf(bridge, "wholesaleInvoicedUncollected");

    // This is the production case: BULK-0021 invoiced 2 Aug, collected 16 Aug.
    expect(term.amount).toBe(6400);
    expect(term.orders).toHaveLength(1);
    expect(term.orders[0]).toMatchObject({
      orderNumber: "BULK-0021",
      amount: 6400,
      branchName: "فرع أ",
    });
  });

  it("does not list an invoice that was collected in the same window", async () => {
    const bridge = await run();
    const listed = termOf(bridge, "wholesaleInvoicedUncollected").orders.map(
      (o) => o.orderNumber,
    );
    expect(listed).not.toContain("BULK-0022");
  });

  it("separates cash on earlier invoices from cash with no invoice at all", async () => {
    const bridge = await run();

    expect(termOf(bridge, "wholesaleCollectedPrior").amount).toBe(-2000);
    expect(termOf(bridge, "wholesaleOldDebt").amount).toBe(-500);
    // The old-debt line is real cash but it is NOT this window's sales — that
    // distinction is why مبيعات الفروع can exceed التقرير العام on a quiet day.
  });

  it("reverses a returned order once but sums every cash refund row", async () => {
    const bridge = await run();

    // Accrual drops the full order total, once, however many refund rows exist.
    expect(termOf(bridge, "wholesaleReturnsReversed").amount).toBe(-5000);
    // Cash only moves for the CASH_REFUND row; a CREDIT_NOTE moves nothing.
    expect(termOf(bridge, "wholesaleCashRefunded").amount).toBe(200);
    expect(bridge.residual).toBe(0);
  });

  it("keeps a payment it cannot attribute out of the cash total, and says so", async () => {
    const bridge = await run();

    // 1000 + 2000 + 500 collected; the 750 unattributable row is excluded.
    expect(bridge.cash.wholesale).toBe(3300);
    expect(bridge.diagnostics.unattributedCollections).toBe(750);
    expect(bridge.residual).toBe(0);
  });

  it("falls back to the treasury when the order's warehouse has no branch", async () => {
    // Mirrors the `??` at branches.js:333 — an order in an unmapped warehouse
    // paid into a real branch treasury still belongs to that branch.
    seed({
      sales: [],
      orders: [],
      payments: [
        { amount: "900.00", treasuryId: 200, orderId: 77, order: { id: 77, orderNumber: "BULK-0077", warehouseId: 999, createdAt: BEFORE_WINDOW } },
      ],
      refunds: [],
    });
    const bridge = await run();

    expect(bridge.cash.wholesale).toBe(900);
    expect(bridge.diagnostics.unattributedCollections).toBe(0);
  });
});

describe("predicates mirror the handlers they explain", () => {
  it("pins the Cairo window on every query", async () => {
    await run();

    const saleWhere = prisma.sale.findMany.mock.calls[0][0].where;
    expect(saleWhere.createdAt.gte.toISOString()).toBe("2026-08-01T22:00:00.000Z");
    expect(saleWhere.createdAt.lte.toISOString()).toBe("2026-08-02T21:59:59.999Z");

    // Collections are dated by when the money ARRIVED, not by the order date.
    const payWhere = prisma.bulkPayment.findMany.mock.calls[0][0].where;
    expect(payWhere.receivedAt.gte.toISOString()).toBe("2026-08-01T22:00:00.000Z");
  });

  it("uses an allow-list of invoiced wholesale statuses, never an exclusion list", async () => {
    await run();
    const where = prisma.bulkOrder.findMany.mock.calls[0][0].where;

    // A quotation is not revenue. `notIn: [DRAFT, CANCELLED]` let QUOTED through
    // and would count any status added to the enum later.
    expect(where.status).toEqual({ in: INVOICED_BULK_STATUSES });
    expect(where.status.notIn).toBeUndefined();
    expect(INVOICED_BULK_STATUSES).not.toContain("QUOTED");
    // RETURNED must stay: the order WAS invoiced in its window; the return is
    // reversed separately, on the day it happened.
    expect(INVOICED_BULK_STATUSES).toContain("RETURNED");
  });

  it("excludes voided payments and legacy opening debt", async () => {
    await run();
    const where = prisma.bulkPayment.findMany.mock.calls[0][0].where;

    expect(where.voidedAt).toBeNull();
    // Positive complement of (orderId IS NULL AND amount < 0) — an opening
    // balance carried from before the system is a receivable, not takings.
    expect(where.OR).toEqual([{ orderId: { not: null } }, { amount: { gte: 0 } }]);
  });

  it("excludes held, cancelled and voided sales", async () => {
    await run();
    const where = prisma.sale.findMany.mock.calls[0][0].where;

    expect(where.status).toBe("COMPLETED");
    expect(where.isVoided).toBe(false);
  });

  it("never writes", async () => {
    await run();
    for (const model of Object.values(prisma)) {
      expect(model.create).toBeUndefined();
      expect(model.update).toBeUndefined();
      expect(model.delete).toBeUndefined();
    }
  });
});

describe("branch scoping", () => {
  it("scopes both sides to the requested branch and still ties out", async () => {
    seed({ branches: [BRANCHES[0]] });
    const bridge = await run({ branchIds: [1] });

    expect(prisma.sale.findMany.mock.calls[0][0].where.branchId).toEqual({ in: [1] });
    // Wholesale is keyed off the branch's warehouse, not the branch id.
    expect(prisma.bulkOrder.findMany.mock.calls[0][0].where.warehouseId).toEqual({
      in: [100],
    });
    expect(bridge.residual).toBe(0);
  });

  it("leaves wholesale unscoped for an all-branches request", async () => {
    await run({ branchIds: null });

    expect(prisma.sale.findMany.mock.calls[0][0].where.branchId).toBeUndefined();
    expect(prisma.bulkOrder.findMany.mock.calls[0][0].where.warehouseId).toBeUndefined();
  });
});
