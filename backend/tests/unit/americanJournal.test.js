/**
 * اليومية الأمريكية (lib/journal) — the synthesised double-entry journal.
 *
 * One small but complete world: counter, card, refund, delivery and held
 * sales; wholesale invoices, payments, a void, old debt and a return; MIXED and
 * DEFERRED purchases with a return, supplier payments and old supplier debt;
 * expenses including both PURCHASE mirrors; an advance and a payroll; pending,
 * approved and rejected transfers; driver settlement and shift variance; a
 * write-off and its reversal; opening stock with and without cost.
 *
 * The mock prisma really filters by `where`, so the opening pass (before the
 * window) and the period pass see different rows, exactly as in production.
 *
 * What is pinned:
 *   - every entry balances; the period balances
 *   - cash columns equal lib/treasuryRebuild, treasury by treasury (same rules)
 *   - Revenue + VAT equals التقرير العام's accrual total (salesBasisBridge)
 *   - COGS equals /general's formula; opex = expenses + driver share
 *   - payables tie to SupplierAccount.balance, receivables to bulkCredit,
 *     driver custody to wallets
 *   - no document is posted twice (PURCHASE expense mirrors, delivery deposits)
 *   - branch view re-points other-branch legs and stays balanced
 */

const mockDb = {};

jest.mock("../../config/database", () => {
  const cmp = (val, bound) =>
    bound instanceof Date ? new Date(val).getTime() - bound.getTime() : Number(val) - Number(bound);
  const OPS = ["gte", "lte", "gt", "lt", "in", "not"];
  const match = (row, where) => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (k === "NOT") return !match(row, v);
      if (k === "OR") return v.some((w) => match(row, w));
      const val = row ? row[k] : undefined;
      if (v === null) return val == null;
      if (v instanceof Date) return val != null && new Date(val).getTime() === v.getTime();
      if (typeof v !== "object") return val === v;
      const keys = Object.keys(v);
      if (keys.length && keys.every((op) => OPS.includes(op))) {
        if ("in" in v && !v.in.includes(val)) return false;
        if ("not" in v && (v.not === null ? val == null : val === v.not)) return false;
        for (const op of ["gte", "lte", "gt", "lt"]) {
          if (!(op in v)) continue;
          if (val == null) return false;
          const d = cmp(val, v[op]);
          if (op === "gte" && d < 0) return false;
          if (op === "lte" && d > 0) return false;
          if (op === "gt" && d <= 0) return false;
          if (op === "lt" && d >= 0) return false;
        }
        return true;
      }
      return val != null && match(val, v); // relation filter
    });
  };
  const model = (name) => ({
    findMany: jest.fn(async (args = {}) => (mockDb[name] || []).filter((r) => match(r, args.where))),
    findFirst: jest.fn(async () => (mockDb[name] || [])[0] ?? null),
    aggregate: jest.fn(async (args = {}) => {
      const rows = (mockDb[name] || []).filter((r) => match(r, args.where));
      const _sum = {};
      for (const f of Object.keys(args._sum || {})) {
        _sum[f] = rows.length ? rows.reduce((s, r) => s + Number(r[f] || 0), 0) : null;
      }
      return { _sum, _count: rows.length };
    }),
  });
  const NOT_MODELS = new Set(["then", "__esModule", "default", "asymmetricMatch", "$$typeof", "toJSON"]);
  return new Proxy({}, {
    get: (_, name) =>
      typeof name === "string" && !NOT_MODELS.has(name) ? (mockDb[`__m_${name}`] ||= model(name)) : undefined,
  });
});

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  getUserBranchFilter: jest.fn(async () => null),
}));

const XLSX = require("xlsx");
const { getUserBranchFilter } = require("../../middleware/auth");
const { parseDateStart, parseDateEnd } = require("../../utils/dateRange");
const { buildJournal, present } = require("../../lib/journal/engine");
const { computeTieOuts } = require("../../lib/journal/tieouts");
const { buildJournalWorkbook } = require("../../lib/journal/excel");
const { rebuild } = require("../../lib/treasuryRebuild");
const router = require("../../routes/reports");

// ── fixtures ────────────────────────────────────────────────────────────────

const START = parseDateStart("2026-08-01");
const END = parseDateEnd("2026-08-31");
const IN = new Date("2026-08-10T09:00:00.000Z");
const IN2 = new Date("2026-08-12T09:00:00.000Z");
const BEFORE = new Date("2026-07-15T09:00:00.000Z");

const branch1 = { id: 1, name: "فرع أ", isActive: true, treasuryId: 10, warehouseId: 100 };
const branch2 = { id: 2, name: "فرع ب", isActive: true, treasuryId: 20, warehouseId: 200 };

const sale = (o) => ({
  isVoided: false,
  status: "COMPLETED",
  deliveryStatus: null,
  deliveryFee: null,
  deliveryDriverShare: null,
  discountAmount: null,
  paymentMethod: "CASH",
  branchId: 1,
  treasuryId: 10,
  client: { name: "عميل" },
  items: [],
  ...o,
});

const bulkOrderO1 = {
  id: 1, orderNumber: "BULK-0001", customerId: 3, warehouseId: 100, status: "CONFIRMED",
  total: 1140, taxAmount: 140, createdAt: IN,
  customer: { companyName: "شركة ج" }, items: [{ quantity: 10, costPrice: 60 }],
};
const bulkOrderO2 = {
  id: 2, orderNumber: "BULK-0002", customerId: 4, warehouseId: 200, status: "RETURNED",
  total: 570, taxAmount: 70, createdAt: IN,
  customer: { companyName: "شركة د" }, items: [{ quantity: 5, costPrice: 60 }],
};

const purchaseP1 = {
  id: 1, supplierId: 7, treasuryId: 50, warehouseId: 100, supplierInvoiceNo: "INV-9",
  paymentMethod: "MIXED", netTotal: 500, paidAmount: 200, createdAt: IN,
  supplier: { name: "مورد ز" }, expense: { amount: 200, treasuryId: 50, type: "PURCHASE" },
};
const purchaseP2 = {
  id: 2, supplierId: 7, treasuryId: 50, warehouseId: 100, supplierInvoiceNo: null,
  paymentMethod: "DEFERRED", netTotal: 300, paidAmount: 0, createdAt: IN,
  supplier: { name: "مورد ز" }, expense: null,
};

function seed() {
  for (const k of Object.keys(mockDb)) if (!k.startsWith("__m_")) delete mockDb[k];
  Object.assign(mockDb, {
    systemConfiguration: [{ mainTreasuryId: 50, visaTreasuryId: 90, instapayTreasuryId: 91 }],
    branch: [branch1, branch2],
    treasury: [
      { id: 10, name: "خزينة أ", balance: 0 },
      { id: 20, name: "خزينة ب", balance: 0 },
      { id: 50, name: "الخزينة الرئيسية", balance: 0 },
      { id: 90, name: "فيزا", balance: 0 },
      { id: 91, name: "انستاباي", balance: 0 },
    ],
    sale: [
      sale({ id: 1, saleNumber: "SALE-1", subtotal: 100, taxAmount: 14, total: 114, createdAt: IN,
        items: [{ quantity: 1, costPrice: 40 }] }),
      sale({ id: 2, saleNumber: "SALE-2", paymentMethod: "VISA", subtotal: 200, taxAmount: 28, total: 228, createdAt: IN }),
      sale({ id: 3, saleNumber: "REFUND-1", refundOfSaleId: 1, subtotal: -50, taxAmount: -7, total: -57, createdAt: IN2,
        items: [{ quantity: -1, costPrice: 20 }] }),
      sale({ id: 4, saleNumber: "SALE-4", deliveryStatus: "OUT_FOR_DELIVERY", deliveryManId: 1,
        subtotal: 100, taxAmount: 14, deliveryFee: 16, deliveryDriverShare: 10, total: 130, createdAt: IN,
        items: [{ quantity: 1, costPrice: 30 }] }),
      sale({ id: 5, saleNumber: "SALE-5", status: "CANCELLED", deliveryStatus: "PENDING",
        subtotal: 80, taxAmount: 0, total: 80, createdAt: IN }),
      sale({ id: 6, saleNumber: "SALE-6", status: "HELD", subtotal: 50, taxAmount: 0, total: 50, createdAt: IN }),
      sale({ id: 7, saleNumber: "SALE-7", branchId: 2, treasuryId: 20, subtotal: 1000, taxAmount: 0, total: 1000, createdAt: BEFORE }),
    ],
    deposit: [
      { id: 1, amount: 120, date: IN2, treasuryId: 10, source: "DRIVER_SETTLEMENT", description: "تسوية" },
      { id: 2, amount: 300, date: BEFORE, treasuryId: 50, source: "MANUAL", description: "رأس مال" },
    ],
    withdrawal: [{ id: 1, amount: 5, date: IN2, treasuryId: 10, source: "SHIFT_VARIANCE", description: "عجز" }],
    purchase: [purchaseP1, purchaseP2],
    purchaseReturn: [
      { id: 1, returnNumber: "PR-1", totalAmount: 100, createdAt: IN2, purchase: purchaseP1 },
    ],
    supplierPayment: [
      { id: 1, amount: 150, treasuryId: 50, paymentDate: IN2, supplierAccount: { supplierId: 7, supplier: { name: "مورد ز" } } },
      { id: 2, amount: -1000, treasuryId: 50, paymentDate: BEFORE, notes: "[رصيد أولي]", supplierAccount: { supplierId: 8, supplier: { name: "مورد ح" } } },
    ],
    supplierAccount: [
      { supplierId: 7, balance: 390, supplier: { name: "مورد ز" } },
      { supplierId: 8, balance: 1000, supplier: { name: "مورد ح" } },
    ],
    expense: [
      { id: 1, description: "كهرباء", amount: 80, date: IN, type: "MANUAL", treasuryId: 10, purchaseId: null, category: { name: "مرافق" } },
      { id: 2, description: "Purchase Invoice #1", amount: 200, date: IN, type: "PURCHASE", treasuryId: 50, purchaseId: 1 },
      { id: 3, description: "سداد مورد", amount: 150, date: IN2, type: "PURCHASE", treasuryId: 50, purchaseId: null },
    ],
    employeeTransaction: [
      { id: 1, type: "ADVANCE", amount: 100, date: IN, branchId: 1, branch: { treasuryId: 10 }, employee: { name: "موظف" } },
      { id: 2, type: "BONUS", amount: 50, date: IN, branchId: 1, branch: { treasuryId: 10 }, employee: { name: "موظف" } },
    ],
    payroll: [
      { id: 1, month: 8, year: 2026, baseSalary: 1000, advances: 100, deductions: 20, overtime: 0, bonuses: 50,
        netSalary: 930, status: "PAID", treasuryId: 10, paymentDate: IN2, employee: { name: "موظف", branchId: 1 } },
    ],
    cashTransfer: [
      { id: 1, amount: 200, status: "PENDING", createdAt: IN, resolvedAt: null, fromTreasuryId: 10, toTreasuryId: 50 },
      { id: 2, amount: 100, status: "APPROVED", createdAt: BEFORE, resolvedAt: IN, fromTreasuryId: 20, toTreasuryId: 50 },
      { id: 3, amount: 70, status: "REJECTED", createdAt: IN, resolvedAt: IN2, fromTreasuryId: 10, toTreasuryId: 50 },
    ],
    bulkOrder: [
      bulkOrderO1,
      bulkOrderO2,
      { ...bulkOrderO1, id: 3, orderNumber: "BULK-0003", status: "DRAFT" },
    ],
    bulkPayment: [
      { id: 1, orderId: 1, customerId: 3, treasuryId: 10, method: "CASH", amount: 500, receivedAt: IN, voidedAt: null,
        order: bulkOrderO1, customer: bulkOrderO1.customer },
      { id: 2, orderId: 2, customerId: 4, treasuryId: 20, method: "CASH", amount: 570, receivedAt: IN, voidedAt: null,
        order: bulkOrderO2, customer: bulkOrderO2.customer },
      { id: 3, orderId: 1, customerId: 3, treasuryId: 10, method: "CASH", amount: 100, receivedAt: IN, voidedAt: IN2,
        order: bulkOrderO1, customer: bulkOrderO1.customer },
      { id: 4, orderId: null, customerId: 3, treasuryId: null, method: "CREDIT", amount: -250, receivedAt: BEFORE, voidedAt: null,
        order: null, customer: bulkOrderO1.customer },
    ],
    bulkRefund: [
      { id: 1, orderId: 2, method: "CASH_REFUND", amount: 570, treasuryId: 20, creditNoteNumber: null, createdAt: IN2,
        order: { ...bulkOrderO2, refunds: [{ id: 1 }] } },
    ],
    stockWriteOff: [
      { id: 1, warehouseId: 100, quantity: 2, unitCost: 15, date: IN, reversesId: null, item: { name: "مناديل" } },
      { id: 2, warehouseId: 100, quantity: -2, unitCost: 15, date: IN2, reversesId: 1, item: { name: "مناديل" } },
    ],
    initialInventory: [
      { id: 1, warehouseId: 100, quantity: 10, unitCost: 5, date: BEFORE, item: { name: "بن" } },
      { id: 2, warehouseId: 100, quantity: 3, unitCost: null, date: BEFORE, item: { name: "سكر" } },
    ],
    deliveryMan: [{ id: 1, walletBalance: 0 }],
  });
}

const net = (t, id) => t[id].dr - t[id].cr; // cents
const build = (opts = {}) => buildJournal({ start: START, end: END, ...opts });

beforeEach(() => {
  seed();
  getUserBranchFilter.mockImplementation(async () => null);
});

// ── tests ───────────────────────────────────────────────────────────────────

describe("double-entry identity", () => {
  test("every entry balances and the period balances", async () => {
    const j = await build();
    // 5 sales, 2 bulk orders, 3 payments + 1 void, 1 bulk return, 2 purchases,
    // 1 purchase return, 1 supplier payment, 1 expense, 1 advance, 1 payroll,
    // 4 transfer events, 1 deposit, 1 withdrawal, 2 write-offs.
    expect(j.rows).toHaveLength(27);
    expect(j.integrity.unbalancedEntries).toBe(0);
    expect(j.integrity.periodBalanced).toBe(true);
    for (const e of j.rows) {
      const dr = e.lines.reduce((s, l) => s + l.dr, 0);
      const cr = e.lines.reduce((s, l) => s + l.cr, 0);
      expect({ key: e.key, dr }).toEqual({ key: e.key, dr: cr });
    }
  });

  test("opening + period = closing, and opening holds only pre-window history", async () => {
    const j = await build();
    // Before August: SALE-7 1000 cash, manual deposit 300, transfer #2 out 100.
    expect(net(j.opening, "CASH")).toBe(120000);
    expect(net(j.opening, "IN_TRANSIT")).toBe(10000);
    expect(net(j.opening, "INVENTORY")).toBe(5000); // 10 × 5; the costless row is skipped
    // Old supplier debt 1000 (Dr) against opening stock 50 and old customer debt 250 (Cr).
    expect(net(j.opening, "OPENING_EQUITY")).toBe(100000 - 5000 - 25000);
    for (const id of Object.keys(j.closing)) {
      expect(j.closing[id].dr).toBe(j.opening[id].dr + j.period[id].dr);
      expect(j.closing[id].cr).toBe(j.opening[id].cr + j.period[id].cr);
    }
  });
});

describe("ties to the rest of the ERP", () => {
  test("cash and bank equal lib/treasuryRebuild for every treasury", async () => {
    const j = await build();
    const config = mockDb.systemConfiguration[0];
    for (const t of mockDb.treasury) {
      const r = await rebuild(t, config);
      expect({ id: t.id, cents: j.subsidiary.treasury.get(t.id) || 0 })
        .toEqual({ id: t.id, cents: Math.round(r.expected * 100) });
    }
  });

  test("Revenue + VAT equals التقرير العام; COGS and opex follow /general", async () => {
    const j = await build();
    const tie = await computeTieOuts(j, { start: START, end: END, branchIds: null, live: false });
    expect(tie.revenue.difference).toBe(0);
    // retail 114 + 228 − 57 + 130, wholesale 1140 + 570 − 570
    expect(tie.revenue.journal).toBe(1555);
    // 40 − 20 + 30 retail, 600 + 300 − 300 wholesale, write-off and reversal net 0
    expect(net(j.period, "COGS")).toBe(65000);
    // expense 80 + driver share 10; PURCHASE mirrors never reach opex
    expect(net(j.period, "OPEX")).toBe(9000);
    expect(net(j.period, "PAYROLL")).toBe(103000); // 1000 + 50 − 20
  });

  test("live tie-outs: treasuries, suppliers, customers, drivers", async () => {
    // Stored balances: rebuild-consistent, except treasury 20 carries 25 with no paper.
    for (const t of mockDb.treasury) {
      t.balance = (await rebuild(t, mockDb.systemConfiguration[0])).expected;
    }
    mockDb.treasury.find((t) => t.id === 20).balance += 25;

    const j = await build();
    const tie = await computeTieOuts(j, { start: START, end: END, branchIds: null, live: true });

    for (const t of tie.treasuries) expect({ id: t.treasuryId, d: t.journalVsDocuments }).toEqual({ id: t.treasuryId, d: 0 });
    expect(tie.treasuries.find((t) => t.treasuryId === 20).unexplained).toBe(25);
    expect(tie.treasuries.find((t) => t.treasuryId === 10).unexplained).toBe(0);

    expect(tie.suppliers.difference).toBe(0);
    expect(tie.suppliers.mismatches).toEqual([]);

    // AR: 1140 − 500 (bp1) − 100 + 100 (bp3 and its void) + 250 old debt = 890;
    // bulkCredit drops the returned order but keeps its 570 payment → named term.
    expect(tie.customers.journal).toBe(890);
    expect(tie.customers.cashRefundedOnReturns).toBe(570);
    expect(tie.customers.residual).toBe(0);

    expect(tie.drivers.journal).toBe(0); // 130 − 10 share − 120 settled
    expect(tie.drivers.residual).toBe(0);
  });
});

describe("posting rules", () => {
  const entry = (j, key) => j.rows.find((e) => e.key === key);
  const line = (e, account) =>
    e.lines.filter((l) => l.account === account).reduce((s, l) => s + l.dr - l.cr, 0);

  test("purchases are paid through their expense row once; mirrors are never posted", async () => {
    const j = await build();
    expect(j.rows.some((e) => e.key.startsWith("EXPENSE:2") || e.key.startsWith("EXPENSE:3"))).toBe(false);
    const p1 = entry(j, "PURCHASE:1");
    expect(line(p1, "INVENTORY")).toBe(50000);
    expect(line(p1, "CASH")).toBe(-20000);
    expect(line(p1, "PAYABLES")).toBe(-30000);
    // MIXED return: 100 × 200/500 back to the treasury, the rest off the supplier
    const r = entry(j, "PURCHASE_RETURN:1");
    expect(line(r, "CASH")).toBe(4000);
    expect(line(r, "PAYABLES")).toBe(6000);
    expect(line(r, "INVENTORY")).toBe(-10000);
  });

  test("card sales land in the configured card treasury, not the sale's own", async () => {
    const j = await build();
    const s2 = entry(j, "SALE:2");
    const bank = s2.lines.find((l) => l.account === "BANK");
    expect(bank.treasuryId).toBe(90);
    expect(bank.branchId).toBe(1); // follows the sale's branch
  });

  test("delivery sales go to driver custody, never straight to cash", async () => {
    const j = await build();
    const s4 = entry(j, "SALE:4");
    expect(s4.lines.some((l) => l.account === "CASH")).toBe(false);
    expect(line(s4, "DRIVER_CUSTODY")).toBe(12000); // 130 − 10 share
    expect(line(s4, "OPEX")).toBe(1000);
    expect(entry(j, "SALE:5")).toBeUndefined(); // cancelled call-center order
  });

  test("a held sale's cash is parked in adjustments, with a diagnostic", async () => {
    const j = await build();
    const s6 = entry(j, "SALE:6");
    expect(line(s6, "REVENUE")).toBe(0);
    expect(line(s6, "ADJUSTMENTS")).toBe(-5000);
    expect(j.diagnostics.find((d) => d.code === "SALE_CASH_WITHOUT_REVENUE")).toMatchObject({ count: 1, amount: 50 });
    expect(j.diagnostics.find((d) => d.code === "OPENING_STOCK_NO_COST")).toBeUndefined(); // only reported for the period
  });

  test("a bulk payment void is a contra on the void date", async () => {
    const j = await build();
    const void3 = entry(j, "BULK_PAYMENT_VOID:3");
    expect(void3.date).toEqual(IN2);
    expect(line(void3, "CASH")).toBe(-10000);
    expect(line(void3, "RECEIVABLES")).toBe(10000);
  });

  test("transfers sit in transit until resolved; a rejection refunds the source", async () => {
    const j = await build();
    // #1 pending 200 stays in transit; #2 (opening 100) resolves; #3 70 nets out.
    expect(net(j.closing, "IN_TRANSIT")).toBe(20000);
  });

  test("payroll clears the month's advances", async () => {
    const j = await build();
    expect(net(j.closing, "EMPLOYEE_ADVANCES")).toBe(0);
  });
});

describe("branch view", () => {
  test("other-branch and head-office legs are re-pointed; rows stay balanced", async () => {
    const j = await build({ branchIds: [1] });
    expect(j.integrity.unbalancedEntries).toBe(0);
    expect(j.rows.some((e) => e.key === "BULK_PAYMENT:2")).toBe(false); // branch 2 only
    const p1 = j.rows.find((e) => e.key === "PURCHASE:1");
    expect(p1.lines.find((l) => l.treasuryId === 50).account).toBe("INTER_BRANCH");
    expect(j.rows.every((e) => e.lines.every((l) => l.account !== "CASH" || l.treasuryId === 10))).toBe(true);
    // The branch's cash column is exactly its own treasury.
    expect(net(j.closing, "CASH")).toBe(j.subsidiary.treasury.get(10));
  });
});

describe("presentation", () => {
  test("unselected accounts fold into حسابات أخرى and rows still balance", async () => {
    const j = await build();
    const view = present(j, { accounts: ["CASH", "REVENUE"] });
    expect(view.columns.map((c) => c.id)).toEqual(["CASH", "REVENUE", "OTHER"]);
    for (const r of view.rows) expect(r.totalDr).toBeCloseTo(r.totalCr, 2);
  });

  test("daily mode merges rows without changing totals; paging slices rows", async () => {
    const j = await build();
    const detail = present(j, {});
    const daily = present(j, { mode: "daily" });
    expect(daily.totalRows).toBeLessThan(detail.totalRows);
    expect(daily.period).toEqual(detail.period);
    const page = present(j, { offset: 0, limit: 5 });
    expect(page.rows).toHaveLength(5);
    expect(page.nextOffset).toBe(5);
    expect(detail.columns.some((c) => c.id === "INTER_BRANCH")).toBe(false);
  });

  test("the workbook is RTL with three sheets and merged pair headers", async () => {
    const j = await build();
    const view = present(j, {});
    const wb = buildJournalWorkbook(view, { title: "اختبار", tieOuts: null });
    const back = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
    expect(back.SheetNames).toEqual(["اليومية الأمريكية", "ملخص ومطابقة", "تنبيهات"]);
    expect(back.Workbook.Views[0].RTL).toBe(true);
    const ws = back.Sheets["اليومية الأمريكية"];
    expect(ws["!merges"].length).toBeGreaterThan(view.columns.length);
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    expect(rows[1][7]).toBe(view.columns[0].labelAr);
    expect(rows[2].slice(7, 9)).toEqual(["مدين", "دائن"]);
    expect(rows[3][2]).toBe("رصيد أول المدة");
    expect(rows[rows.length - 1][2]).toBe("رصيد آخر المدة");
  });
});

describe("GET /american-journal", () => {
  const handlerFor = (path) => {
    const layer = router.stack.find((l) => l.route && l.route.path === path);
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
  };
  const call = async (query) => {
    let payload;
    let status = 200;
    const res = { json: (p) => { payload = p; }, status: (s) => { status = s; return res; } };
    await handlerFor("/american-journal")({ query, user: { id: 1 } }, res);
    return { status, payload };
  };

  test("returns columns, balances, rows and the revenue tie", async () => {
    const { status, payload } = await call({ startDate: "2026-08-01", endDate: "2026-08-31", tieOut: "1" });
    expect(status).toBe(200);
    expect(payload.integrity.unbalancedEntries).toBe(0);
    expect(payload.tieOuts.revenue.difference).toBe(0);
    expect(payload.tieOuts.treasuries).toBeUndefined(); // August ended: no live balances
    expect(payload.rows.length).toBe(payload.totalRows);
  });

  test("403 for a branch outside the caller's access", async () => {
    getUserBranchFilter.mockImplementation(async () => ({ id: 1 }));
    const { status } = await call({ startDate: "2026-08-01", endDate: "2026-08-31", branchId: "2" });
    expect(status).toBe(403);
  });

  test("400 when the window is reversed", async () => {
    const { status } = await call({ startDate: "2026-08-31", endDate: "2026-08-01" });
    expect(status).toBe(400);
  });
});
