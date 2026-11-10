/**
 * sources.js — turns ERP documents into balanced journal entries.
 *
 * ERP-V2 stores no journal. Each document moves its own running balance, so the
 * American journal is SYNTHESISED here, at query time, one mapper per document
 * type. Nothing in this file writes to the database.
 *
 * Three rules every mapper follows:
 *
 * 1. CASH IS POSTED EXACTLY THE WAY lib/treasuryRebuild.js COUNTS IT. That
 *    module is the production-validated statement of which document moves which
 *    treasury (delivery sales reach cash only through DRIVER_SETTLEMENT deposits;
 *    a purchase is paid through its PURCHASE expense row, never both; a negative
 *    supplier payment is an opening balance, not cash …). The journal's cash and
 *    bank columns must equal that rebuild, treasury by treasury. A test pins it.
 *
 * 2. REVENUE IS POSTED EXACTLY THE WAY /api/reports/general COUNTS IT (accrual):
 *    retail COMPLETED non-voided sales by createdAt, wholesale INVOICED orders by
 *    createdAt, a wholesale return reversing the full order total. Revenue + VAT
 *    in the journal therefore ties to that report's totalSales.
 *
 * 3. EVERY ENTRY IS BALANCED BY CONSTRUCTION. Where two stored fields can
 *    disagree (e.g. a sale's total vs subtotal − discount + fee, which the POS
 *    no-discount path stores as sent by the client) one leg is the documented
 *    plug and the disagreement is reported as a diagnostic — never absorbed.
 *
 * Money is integer CENTS throughout (every column involved is Decimal(_, 2)),
 * the same convention as lib/salesBasisBridge.js.
 *
 * Mappers only use simple `where` clauses (a date range plus plain equality);
 * anything finer is filtered in JS. That keeps them trivially mockable and keeps
 * every rule readable in one place.
 */

const prisma = require("../../config/database");
const { INVOICED_BULK_STATUSES } = require("../salesBasisBridge");
const { CASH_METHODS, purchaseReturnTreasuryShare } = require("../treasuryRebuild");
const { treasuryAccount } = require("./accounts");

const BATCH = 2000;

/** Decimal → integer cents. Exact for Decimal(_, 2) columns. */
const cents = (v) => Math.round(Number(v || 0) * 100);
const toMoney = (c) => c / 100;

/** Σ costPrice × quantity in cents — the COGS formula /general uses. */
const lineCostC = (items) =>
  (items || []).reduce((s, it) => s + Math.round(Number(it.costPrice || 0) * Number(it.quantity) * 100), 0);

/** `{ gte, lte }` for a window; either end may be null (open). */
const range = ({ from, to }) => {
  const r = {};
  if (from) r.gte = from;
  if (to) r.lte = to;
  return r;
};

/**
 * Page through a model by id so an all-history pass (the opening balance)
 * never holds a whole table in memory at once.
 */
async function eachRow(model, args, onRow) {
  let cursor = null;
  for (;;) {
    const batch = await prisma[model].findMany({
      ...args,
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor != null ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const row of batch) onRow(row);
    if (batch.length < BATCH) break;
    cursor = batch[batch.length - 1].id;
  }
}

// ── entry construction ──────────────────────────────────────────────────────

const newEntry = ({ key, date, source, type, ref, party = null, branchId = null }) => ({
  key,
  date: new Date(date),
  source,
  type,
  ref,
  party,
  branchId,
  lines: [],
});

/**
 * Post `amountC` to `account` on `side`. A negative amount flips the side, so
 * a mapper can write the natural direction for an invoice and a negative refund
 * row reverses itself. Zero posts nothing.
 */
const post = (entry, side, account, amountC, attrs = {}) => {
  if (!amountC) return;
  const flip = amountC < 0;
  const abs = Math.abs(amountC);
  const isDr = (side === "dr") !== flip;
  entry.lines.push({
    account,
    dr: isDr ? abs : 0,
    cr: isDr ? 0 : abs,
    branchId: attrs.branchId !== undefined ? attrs.branchId : entry.branchId,
    treasuryId: attrs.treasuryId ?? null,
    supplierId: attrs.supplierId ?? null,
    customerId: attrs.customerId ?? null,
  });
};
const dr = (e, account, amountC, attrs) => post(e, "dr", account, amountC, attrs);
const cr = (e, account, amountC, attrs) => post(e, "cr", account, amountC, attrs);

/**
 * A treasury leg: right column (cash vs bank), right branch, treasury tagged.
 *
 * A branch treasury's leg belongs to that branch. A global card treasury
 * belongs to no branch, so its leg follows the document that moved it (the
 * sale, the order …). Any other treasury — the main treasury, the factory's —
 * is head office (null), so a branch view shows it as جاري الفروع والمركز
 * rather than counting head-office cash as the branch's.
 */
const treasuryLeg = (ctx, e, side, treasuryId, amountC) =>
  post(e, side, treasuryAccount(ctx, treasuryId), amountC, {
    treasuryId,
    branchId:
      ctx.treasuryToBranch.get(treasuryId) ??
      (ctx.bankTreasuryIds.has(treasuryId) ? e.branchId : null),
  });

/** Swap every line's side — the contra of an entry (bulk payment void). */
const mirrorLines = (lines) => lines.map((l) => ({ ...l, dr: l.cr, cr: l.dr }));

// ── retail POS / call center ────────────────────────────────────────────────

/**
 * Where a counter sale's money landed. Mirrors treasuryRebuild: CASH credits the
 * sale's own treasury, VISA/INSTAPAY the configured global treasury whatever
 * Sale.treasuryId says.
 */
const saleTreasuryId = (ctx, sale) => {
  if (sale.paymentMethod === "VISA") return ctx.config.visaTreasuryId ?? null;
  if (sale.paymentMethod === "INSTAPAY") return ctx.config.instapayTreasuryId ?? null;
  return sale.treasuryId;
};

async function retailSales(ctx, window, emit, diag) {
  await eachRow(
    "sale",
    {
      where: { createdAt: range(window) },
      select: {
        id: true, saleNumber: true, branchId: true, treasuryId: true,
        paymentMethod: true, status: true, isVoided: true, deliveryStatus: true,
        deliveryManId: true, subtotal: true, discountAmount: true, taxAmount: true,
        total: true, deliveryFee: true, deliveryDriverShare: true, createdAt: true,
        client: { select: { name: true } },
        items: { select: { quantity: true, costPrice: true } },
      },
    },
    (sale) => {
      const isRefund = String(sale.saleNumber || "").startsWith("REFUND-");
      const recognised = sale.status === "COMPLETED" && !sale.isVoided;
      const isDelivery = sale.deliveryStatus != null;
      const totalC = cents(sale.total);
      const taxC = cents(sale.taxAmount);
      const e = newEntry({
        key: `SALE:${sale.id}`,
        date: sale.createdAt,
        source: "SALE",
        type: isRefund ? "مرتجع مبيعات" : isDelivery ? "فاتورة توصيل" : "فاتورة مبيعات",
        ref: sale.saleNumber,
        party: sale.client?.name || null,
        branchId: sale.branchId,
      });

      if (isDelivery) {
        // A delivery sale moves no treasury: the money leaves with the driver
        // and reaches a treasury only through a DRIVER_SETTLEMENT deposit. One
        // that never completed (a cancelled call-center order) moved nothing.
        if (!recognised) return;
        dr(e, "DRIVER_CUSTODY", totalC);
      } else {
        const treasuryId = saleTreasuryId(ctx, sale);
        if (treasuryId == null) {
          diag.add("SALE_NO_CARD_TREASURY", sale.saleNumber, totalC);
          dr(e, "ADJUSTMENTS", totalC);
        } else {
          treasuryLeg(ctx, e, "dr", treasuryId, totalC);
        }
        if (!recognised) {
          // The treasury took the money (treasuryRebuild counts it whatever the
          // status) but /general does not book it as revenue. Parked, visibly.
          diag.add("SALE_CASH_WITHOUT_REVENUE", sale.saleNumber, totalC);
          cr(e, "ADJUSTMENTS", totalC);
          emit(e);
          return;
        }
      }

      cr(e, "VAT", taxC);
      const revenueC = totalC - taxC; // the plug
      cr(e, "REVENUE", revenueC);
      const expectedC =
        cents(sale.subtotal) - cents(sale.discountAmount) + cents(sale.deliveryFee);
      if (Math.abs(expectedC - revenueC) > 1) {
        diag.add("SALE_REVENUE_PLUG", sale.saleNumber, revenueC - expectedC);
      }

      // The driver keeps their share out of the cash they collect: a delivery
      // expense (عمولة التوصيل), so custody nets to total − share — exactly the
      // DEBT_ACCRUED written to the driver's wallet.
      if (isDelivery) {
        const shareC = cents(sale.deliveryDriverShare);
        dr(e, "OPEX", shareC);
        cr(e, "DRIVER_CUSTODY", shareC);
      }

      // Perpetual inventory. Refund lines carry negative quantities, so the
      // pair reverses itself — the same mechanism /general relies on.
      const costC = lineCostC(sale.items);
      dr(e, "COGS", costC);
      cr(e, "INVENTORY", costC);

      emit(e);
    },
  );
}

// ── wholesale ───────────────────────────────────────────────────────────────

async function bulkOrders(ctx, window, emit) {
  await eachRow(
    "bulkOrder",
    {
      // Same date and status basis as /general (user decision): createdAt, and
      // the shared allow-list of statuses that are real invoices.
      where: { createdAt: range(window), status: { in: INVOICED_BULK_STATUSES } },
      select: {
        id: true, orderNumber: true, warehouseId: true, customerId: true,
        total: true, taxAmount: true, createdAt: true,
        customer: { select: { companyName: true } },
        items: { select: { quantity: true, costPrice: true } },
      },
    },
    (o) => {
      const totalC = cents(o.total);
      const taxC = cents(o.taxAmount);
      const e = newEntry({
        key: `BULK_ORDER:${o.id}`,
        date: o.createdAt,
        source: "BULK_ORDER",
        type: "فاتورة جملة",
        ref: o.orderNumber || `BULK#${o.id}`,
        party: o.customer?.companyName || null,
        branchId: ctx.warehouseToBranch.get(o.warehouseId) ?? null,
      });
      dr(e, "RECEIVABLES", totalC, { customerId: o.customerId });
      cr(e, "VAT", taxC);
      cr(e, "REVENUE", totalC - taxC);
      const costC = lineCostC(o.items);
      dr(e, "COGS", costC);
      cr(e, "INVENTORY", costC);
      emit(e);
    },
  );
}

/**
 * A wholesale return reverses the WHOLE order (stock comes back in full,
 * /general reverses the full total) but hands back only the cash actually paid.
 * The rest of the reversal clears the customer's receivable.
 *
 * Only an order's FIRST refund row carries the reversal. A second row on the
 * same order (production has them — see scripts/correct-double-refund.js) only
 * moves whatever cash it moved.
 */
async function bulkRefunds(ctx, window, emit) {
  await eachRow(
    "bulkRefund",
    {
      where: { createdAt: range(window) },
      select: {
        id: true, orderId: true, method: true, amount: true, treasuryId: true,
        creditNoteNumber: true, createdAt: true,
        order: {
          select: {
            id: true, orderNumber: true, warehouseId: true, customerId: true,
            total: true, taxAmount: true,
            customer: { select: { companyName: true } },
            items: { select: { quantity: true, costPrice: true } },
            refunds: { select: { id: true } },
          },
        },
      },
    },
    (r) => {
      const o = r.order;
      const e = newEntry({
        key: `BULK_REFUND:${r.id}`,
        date: r.createdAt,
        source: "BULK_REFUND",
        type: "مرتجع جملة",
        ref: r.creditNoteNumber || o?.orderNumber || `BULK#${r.orderId}`,
        party: o?.customer?.companyName || null,
        branchId: ctx.warehouseToBranch.get(o?.warehouseId) ?? null,
      });
      const customer = { customerId: o?.customerId ?? null };
      // A CREDIT_NOTE row carries no treasury: no cash moved.
      const cashC = r.treasuryId != null ? cents(r.amount) : 0;
      const isFirst = o && Math.min(...o.refunds.map((x) => x.id)) === r.id;

      if (isFirst) {
        const totalC = cents(o.total);
        const taxC = cents(o.taxAmount);
        dr(e, "REVENUE", totalC - taxC);
        dr(e, "VAT", taxC);
        if (cashC) treasuryLeg(ctx, e, "cr", r.treasuryId, cashC);
        cr(e, "RECEIVABLES", totalC - cashC, customer);
        const costC = lineCostC(o.items);
        dr(e, "INVENTORY", costC);
        cr(e, "COGS", costC);
      } else {
        if (!cashC) return;
        dr(e, "RECEIVABLES", cashC, customer);
        treasuryLeg(ctx, e, "cr", r.treasuryId, cashC);
      }
      emit(e);
    },
  );
}

/** One bulk payment as an entry (no emit) — shared by receipt and void. */
function bulkPaymentEntry(ctx, p, diag) {
  const amountC = cents(p.amount);
  const e = newEntry({
    key: `BULK_PAYMENT:${p.id}`,
    date: p.receivedAt,
    source: "BULK_PAYMENT",
    type: "تحصيل جملة",
    ref: p.order?.orderNumber || `دفعة جملة #${p.id}`,
    party: p.customer?.companyName || null,
    // An order's branch is its warehouse's; a customer-level payment (no
    // order) sits with the treasury that took it.
    branchId:
      (p.order ? ctx.warehouseToBranch.get(p.order.warehouseId) : null) ??
      ctx.treasuryToBranch.get(p.treasuryId) ??
      null,
  });
  const customer = { customerId: p.customerId };

  if (CASH_METHODS.includes(p.method)) {
    if (p.treasuryId != null) {
      treasuryLeg(ctx, e, "dr", p.treasuryId, amountC);
    } else {
      diag?.add("BULK_PAYMENT_NO_TREASURY", e.ref, amountC);
      dr(e, "ADJUSTMENTS", amountC);
    }
    cr(e, "RECEIVABLES", amountC, customer);
  } else if (amountC < 0 && p.orderId == null) {
    // Old customer debt carried in when the system started — an opening
    // balance, the wholesale twin of a negative SupplierPayment.
    e.type = "رصيد افتتاحي عميل";
    dr(e, "RECEIVABLES", -amountC, customer);
    cr(e, "OPENING_EQUITY", -amountC);
  } else {
    // CREDIT method: the receivable is reduced with no cash moving.
    e.type = "تسوية رصيد عميل";
    dr(e, "ADJUSTMENTS", amountC);
    cr(e, "RECEIVABLES", amountC, customer);
  }
  return e;
}

async function bulkPayments(ctx, window, emit, diag) {
  const select = {
    id: true, orderId: true, customerId: true, treasuryId: true, method: true,
    amount: true, receivedAt: true, voidedAt: true, voidReason: true,
    order: { select: { orderNumber: true, warehouseId: true } },
    customer: { select: { companyName: true } },
  };
  await eachRow("bulkPayment", { where: { receivedAt: range(window) }, select }, (p) =>
    emit(bulkPaymentEntry(ctx, p, diag)),
  );
  // A void is posted as a contra ON THE VOID DATE, never by pulling the
  // receipt out of the period it was banked in.
  await eachRow(
    "bulkPayment",
    { where: { voidedAt: { not: null, ...range(window) } }, select },
    (p) => {
      const e = bulkPaymentEntry(ctx, p, null);
      emit({
        ...e,
        key: `BULK_PAYMENT_VOID:${p.id}`,
        date: new Date(p.voidedAt),
        type: "إلغاء تحصيل جملة",
        lines: mirrorLines(e.lines),
      });
    },
  );
}

// ── purchases & suppliers ───────────────────────────────────────────────────

async function purchases(ctx, window, emit) {
  await eachRow(
    "purchase",
    {
      where: { createdAt: range(window) },
      select: {
        id: true, supplierId: true, treasuryId: true, warehouseId: true,
        supplierInvoiceNo: true, paymentMethod: true, netTotal: true, createdAt: true,
        supplier: { select: { name: true } },
        expense: { select: { amount: true, treasuryId: true, type: true } },
      },
    },
    (p) => {
      const netC = cents(p.netTotal);
      const e = newEntry({
        key: `PURCHASE:${p.id}`,
        date: p.createdAt,
        source: "PURCHASE",
        type: "فاتورة مشتريات",
        ref: p.supplierInvoiceNo ? `PUR-${p.id} / ${p.supplierInvoiceNo}` : `PUR-${p.id}`,
        party: p.supplier?.name || null,
        branchId: ctx.warehouseToBranch.get(p.warehouseId) ?? null,
      });
      dr(e, "INVENTORY", netC);
      // The cash paid at purchase time is the purchase's own PURCHASE expense
      // row — the amount, and the treasury, that was actually debited (see
      // treasuryRebuild). Whatever was not paid is owed to the supplier.
      const paid = p.expense && p.expense.type === "PURCHASE" ? p.expense : null;
      const paidC = paid ? cents(paid.amount) : 0;
      if (paidC) treasuryLeg(ctx, e, "cr", paid.treasuryId, paidC);
      cr(e, "PAYABLES", netC - paidC, { supplierId: p.supplierId });
      emit(e);
    },
  );
}

async function purchaseReturns(ctx, window, emit) {
  await eachRow(
    "purchaseReturn",
    {
      where: { createdAt: range(window) },
      select: {
        id: true, returnNumber: true, totalAmount: true, createdAt: true,
        purchase: {
          select: {
            id: true, supplierId: true, treasuryId: true, warehouseId: true,
            paymentMethod: true, paidAmount: true, netTotal: true,
            supplier: { select: { name: true } },
          },
        },
      },
    },
    (r) => {
      const p = r.purchase;
      const totalC = cents(r.totalAmount);
      const e = newEntry({
        key: `PURCHASE_RETURN:${r.id}`,
        date: r.createdAt,
        source: "PURCHASE_RETURN",
        type: String(r.returnNumber).startsWith("CAN-") ? "إلغاء فاتورة مشتريات" : "مرتجع مشتريات",
        ref: r.returnNumber,
        party: p?.supplier?.name || null,
        branchId: ctx.warehouseToBranch.get(p?.warehouseId) ?? null,
      });
      // Same split routes/purchases.js applies and treasuryRebuild re-derives.
      const cashC = Math.round(purchaseReturnTreasuryShare(p, r.totalAmount) * 100);
      if (cashC) treasuryLeg(ctx, e, "dr", p.treasuryId, cashC);
      dr(e, "PAYABLES", totalC - cashC, { supplierId: p?.supplierId ?? null });
      cr(e, "INVENTORY", totalC);
      emit(e);
    },
  );
}

async function supplierPayments(ctx, window, emit) {
  await eachRow(
    "supplierPayment",
    {
      where: { paymentDate: range(window) },
      select: {
        id: true, amount: true, treasuryId: true, notes: true, paymentDate: true,
        supplierAccount: { select: { supplierId: true, supplier: { select: { name: true } } } },
      },
    },
    (sp) => {
      const amountC = cents(sp.amount);
      if (!amountC) return;
      const supplierId = sp.supplierAccount?.supplierId ?? null;
      const e = newEntry({
        key: `SUPPLIER_PAYMENT:${sp.id}`,
        date: sp.paymentDate,
        source: "SUPPLIER_PAYMENT",
        type: "سداد مورد",
        ref: `دفعة مورد #${sp.id}`,
        party: sp.supplierAccount?.supplier?.name || null,
        branchId: ctx.treasuryToBranch.get(sp.treasuryId) ?? null,
      });
      if (amountC > 0) {
        dr(e, "PAYABLES", amountC, { supplierId });
        treasuryLeg(ctx, e, "cr", sp.treasuryId, amountC);
      } else {
        // NEGATIVE = old debt carried in ([رصيد أولي]). Its treasuryId is an
        // arbitrary placeholder — no cash moved, so no treasury leg.
        e.type = "رصيد افتتاحي مورد";
        dr(e, "OPENING_EQUITY", -amountC);
        cr(e, "PAYABLES", -amountC, { supplierId });
      }
      emit(e);
    },
  );
}

// ── expenses & HR ───────────────────────────────────────────────────────────

async function expenses(ctx, window, emit) {
  await eachRow(
    "expense",
    {
      where: { date: range(window) },
      select: {
        id: true, description: true, amount: true, date: true, type: true,
        treasuryId: true, category: { select: { name: true } },
      },
    },
    (x) => {
      // PURCHASE rows are mirrors: with a purchaseId it is the purchase's own
      // payment (posted by purchases()), without one it mirrors a
      // SupplierPayment (posted by supplierPayments()). Posting either again
      // would pay the supplier twice. Same deny-list as treasuryRebuild.
      if (x.type === "PURCHASE") return;
      const e = newEntry({
        key: `EXPENSE:${x.id}`,
        date: x.date,
        source: "EXPENSE",
        type: "مصروف",
        ref: `مصروف #${x.id}`,
        party: [x.category?.name, x.description].filter(Boolean).join(" — ") || null,
        branchId: ctx.treasuryToBranch.get(x.treasuryId) ?? null,
      });
      const amountC = cents(x.amount);
      dr(e, "OPEX", amountC);
      treasuryLeg(ctx, e, "cr", x.treasuryId, amountC);
      emit(e);
    },
  );
}

async function employeeAdvances(ctx, window, emit, diag) {
  await eachRow(
    "employeeTransaction",
    {
      where: { date: range(window), type: "ADVANCE" },
      select: {
        id: true, amount: true, date: true, reason: true, branchId: true,
        branch: { select: { treasuryId: true } },
        employee: { select: { name: true } },
      },
    },
    (t) => {
      const amountC = cents(t.amount);
      // Advances debit the branch's treasury and nothing records which one
      // except the branch. treasuryRebuild skips a branchless advance too.
      const treasuryId = t.branch?.treasuryId ?? null;
      if (treasuryId == null) {
        diag.add("ADVANCE_NO_BRANCH", `سلفة #${t.id}`, amountC);
        return;
      }
      const e = newEntry({
        key: `ADVANCE:${t.id}`,
        date: t.date,
        source: "ADVANCE",
        type: "سلفة موظف",
        ref: `سلفة #${t.id}`,
        party: t.employee?.name || null,
        branchId: t.branchId,
      });
      dr(e, "EMPLOYEE_ADVANCES", amountC);
      treasuryLeg(ctx, e, "cr", treasuryId, amountC);
      emit(e);
    },
  );
}

async function payrolls(ctx, window, emit, diag) {
  await eachRow(
    "payroll",
    {
      where: { paymentDate: range(window), status: "PAID" },
      select: {
        id: true, month: true, year: true, baseSalary: true, advances: true,
        deductions: true, overtime: true, bonuses: true, netSalary: true,
        treasuryId: true, paymentDate: true,
        employee: { select: { name: true, branchId: true } },
      },
    },
    (p) => {
      const netC = cents(p.netSalary);
      const advC = cents(p.advances);
      const ref = `راتب ${p.month}/${p.year}`;
      const e = newEntry({
        key: `PAYROLL:${p.id}`,
        date: p.paymentDate,
        source: "PAYROLL",
        type: "صرف راتب",
        ref,
        party: p.employee?.name || null,
        branchId: ctx.treasuryToBranch.get(p.treasuryId) ?? p.employee?.branchId ?? null,
      });
      // net = base − advances − deductions + overtime + bonuses
      // (routes/employees.js). The salary cost is the plug advances + net; a
      // disagreement with the components is surfaced, not absorbed.
      const costC = advC + netC;
      const expectedC =
        cents(p.baseSalary) + cents(p.overtime) + cents(p.bonuses) - cents(p.deductions);
      if (costC !== expectedC) diag.add("PAYROLL_COMPONENTS", ref, costC - expectedC);
      dr(e, "PAYROLL", costC);
      // The month's advances were already paid out in cash; payroll recovers
      // them from the salary, clearing the advances account.
      cr(e, "EMPLOYEE_ADVANCES", advC);
      if (p.treasuryId != null) {
        treasuryLeg(ctx, e, "cr", p.treasuryId, netC);
      } else if (netC) {
        diag.add("PAYROLL_NO_TREASURY", ref, netC);
        cr(e, "ADJUSTMENTS", netC);
      }
      emit(e);
    },
  );
}

// ── treasury movements ──────────────────────────────────────────────────────

/**
 * A transfer moves its two sides at DIFFERENT times (routes/treasuries.js):
 * the source is debited at creation, the destination credited on approval, and
 * a rejection refunds the source. Between the two the money is in transit.
 */
async function cashTransfers(ctx, window, emit, diag) {
  const select = {
    id: true, amount: true, status: true, createdAt: true, resolvedAt: true,
    fromTreasuryId: true, toTreasuryId: true,
  };
  const party = (t) =>
    `${ctx.treasuryNames.get(t.fromTreasuryId) || t.fromTreasuryId} ← ${ctx.treasuryNames.get(t.toTreasuryId) || t.toTreasuryId}`;
  const fromBranch = (t) => ctx.treasuryToBranch.get(t.fromTreasuryId) ?? null;

  await eachRow("cashTransfer", { where: { createdAt: range(window) }, select }, (t) => {
    const e = newEntry({
      key: `TRANSFER:${t.id}`,
      date: t.createdAt,
      source: "TRANSFER",
      type: "تحويل نقدية",
      ref: `تحويل #${t.id}`,
      party: party(t),
      branchId: fromBranch(t),
    });
    const amountC = cents(t.amount);
    dr(e, "IN_TRANSIT", amountC);
    treasuryLeg(ctx, e, "cr", t.fromTreasuryId, amountC);
    emit(e);
  });

  const resolve = (t, date) => {
    const amountC = cents(t.amount);
    const approved = t.status === "APPROVED";
    const e = newEntry({
      key: `TRANSFER_${t.status}:${t.id}`,
      date,
      source: "TRANSFER",
      type: approved ? "استلام تحويل" : "رفض تحويل",
      ref: `تحويل #${t.id}`,
      party: party(t),
      branchId: fromBranch(t),
    });
    treasuryLeg(ctx, e, "dr", approved ? t.toTreasuryId : t.fromTreasuryId, amountC);
    cr(e, "IN_TRANSIT", amountC);
    emit(e);
  };

  await eachRow(
    "cashTransfer",
    { where: { resolvedAt: { not: null, ...range(window) } }, select },
    (t) => {
      if (t.status === "APPROVED" || t.status === "REJECTED") resolve(t, t.resolvedAt);
    },
  );
  // Rows resolved before resolvedAt existed: resolve them at creation so the
  // transit account still clears, and say so.
  await eachRow(
    "cashTransfer",
    { where: { resolvedAt: null, createdAt: range(window) }, select },
    (t) => {
      if (t.status !== "APPROVED" && t.status !== "REJECTED") return;
      diag.add("TRANSFER_NO_RESOLVED_AT", `تحويل #${t.id}`, cents(t.amount));
      resolve(t, t.createdAt);
    },
  );
}

const DEPOSIT_TYPES = {
  DRIVER_SETTLEMENT: "توريد طيار",
  SHIFT_VARIANCE: "زيادة نقدية وردية",
  SHIFT_OPENING: "عهدة افتتاح وردية",
  MANUAL: "إيداع",
};
const WITHDRAWAL_TYPES = {
  DRIVER_DUES: "صرف مستحقات طيار",
  SHIFT_VARIANCE: "عجز نقدية وردية",
  SHIFT_OPENING: "عهدة افتتاح وردية",
  MANUAL: "سحب",
};

async function depositsAndWithdrawals(ctx, window, emit) {
  const select = {
    id: true, amount: true, description: true, date: true, treasuryId: true, source: true,
  };
  await eachRow("deposit", { where: { date: range(window) }, select }, (d) => {
    const amountC = cents(d.amount);
    const e = newEntry({
      key: `DEPOSIT:${d.id}`,
      date: d.date,
      source: "DEPOSIT",
      type: DEPOSIT_TYPES[d.source] || "إيداع",
      ref: `إيداع #${d.id}`,
      party: d.description || null,
      branchId: ctx.treasuryToBranch.get(d.treasuryId) ?? null,
    });
    treasuryLeg(ctx, e, "dr", d.treasuryId, amountC);
    // A driver settlement (and an InstaPay conversion, which writes the same
    // source) is the driver handing over custody. Everything else has no
    // document-level counterparty and lands in adjustments.
    cr(e, d.source === "DRIVER_SETTLEMENT" ? "DRIVER_CUSTODY" : "ADJUSTMENTS", amountC);
    emit(e);
  });
  await eachRow("withdrawal", { where: { date: range(window) }, select }, (w) => {
    const amountC = cents(w.amount);
    const e = newEntry({
      key: `WITHDRAWAL:${w.id}`,
      date: w.date,
      source: "WITHDRAWAL",
      type: WITHDRAWAL_TYPES[w.source] || "سحب",
      ref: `سحب #${w.id}`,
      party: w.description || null,
      branchId: ctx.treasuryToBranch.get(w.treasuryId) ?? null,
    });
    dr(e, w.source === "DRIVER_DUES" ? "DRIVER_CUSTODY" : "ADJUSTMENTS", amountC);
    treasuryLeg(ctx, e, "cr", w.treasuryId, amountC);
    emit(e);
  });
}

// ── stock ───────────────────────────────────────────────────────────────────

async function stockWriteOffs(ctx, window, emit) {
  await eachRow(
    "stockWriteOff",
    {
      where: { date: range(window) },
      select: {
        id: true, warehouseId: true, quantity: true, unitCost: true, date: true,
        reversesId: true, item: { select: { name: true } },
      },
    },
    (w) => {
      // A reversal is a contra row with a negative quantity and the COPIED
      // unitCost, so it flips itself and nets the original to exactly zero.
      const costC = Math.round(Number(w.unitCost || 0) * Number(w.quantity) * 100);
      const e = newEntry({
        key: `WRITE_OFF:${w.id}`,
        date: w.date,
        source: "WRITE_OFF",
        type: w.reversesId ? "إلغاء إهلاك" : "إهلاك مخزون",
        ref: `إهلاك #${w.id}`,
        party: w.item?.name || null,
        branchId: ctx.warehouseToBranch.get(w.warehouseId) ?? null,
      });
      dr(e, "COGS", costC);
      cr(e, "INVENTORY", costC);
      if (e.lines.length) emit(e);
    },
  );
}

async function initialInventory(ctx, window, emit, diag) {
  await eachRow(
    "initialInventory",
    {
      where: { date: range(window) },
      select: {
        id: true, warehouseId: true, quantity: true, unitCost: true, date: true,
        item: { select: { name: true } },
      },
    },
    (r) => {
      if (r.unitCost == null) {
        // Opening stock entered before unit cost existed: it carries no value.
        diag.add("OPENING_STOCK_NO_COST", r.item?.name || `#${r.id}`, 0);
        return;
      }
      const valueC = Math.round(Number(r.unitCost) * Number(r.quantity) * 100);
      const e = newEntry({
        key: `OPENING_STOCK:${r.id}`,
        date: r.date,
        source: "OPENING_STOCK",
        type: "مخزون أول المدة",
        ref: `رصيد افتتاحي #${r.id}`,
        party: r.item?.name || null,
        branchId: ctx.warehouseToBranch.get(r.warehouseId) ?? null,
      });
      dr(e, "INVENTORY", valueC);
      cr(e, "OPENING_EQUITY", valueC);
      if (e.lines.length) emit(e);
    },
  );
}

/** Every mapper, in the order a same-instant tie is listed in the report. */
const SOURCES = [
  initialInventory,
  purchases,
  purchaseReturns,
  supplierPayments,
  retailSales,
  bulkOrders,
  bulkPayments,
  bulkRefunds,
  cashTransfers,
  depositsAndWithdrawals,
  expenses,
  employeeAdvances,
  payrolls,
  stockWriteOffs,
];

module.exports = { SOURCES, cents, toMoney, range, eachRow };
