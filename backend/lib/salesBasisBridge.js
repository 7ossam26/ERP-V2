/**
 * salesBasisBridge.js
 *
 * Explains, term by term, why التقرير العام and مبيعات الفروع report different
 * totals for the same date filter.
 *
 * They differ on purpose. /api/reports/general is the ACCRUAL view (what was
 * invoiced in the window); /api/branches/balances is the CASH view (what
 * actually reached the till). Neither is wrong and neither may be changed to
 * match the other — one feeds the P&L, the other reconciles the drawer.
 *
 * What was missing is a way to see WHY they differ. The gap is not small and it
 * is not stable: measured against production over 29 days it swung from
 * −75,120 to +40,470 in a single day, so a user had no way to tell a legitimate
 * wholesale timing difference from a bug.
 *
 * This module recomputes both bases over one window and decomposes the gap:
 *
 *     G = R_all + W_inv − W_ret                (accrual — التقرير العام)
 *     B = R_col + W_col − W_cashref            (cash    — مبيعات الفروع)
 *
 *     G − B = + delivery cash in flight        CASH, deliveryStatus ∉ {NULL, DELIVERED}
 *             + inactive-branch sales          accrual counts them, cash does not
 *             + wholesale invoiced, not yet collected
 *             − wholesale collected on earlier invoices
 *             − old-debt collections           BulkPayment with no order
 *             − wholesale returns reversed     full order total, any refund method
 *             + wholesale cash refunded        CASH_REFUND amount only
 *
 * The identity was validated against production for every day 29 Jul → 26 Aug
 * 2026: `MAX |residual| = 0`. `residual` is returned on every call and the UI
 * shows it as "غير مفسَّر" whenever it is non-zero, so a future edit that makes
 * one of these predicates drift out of step with the handler it mirrors becomes
 * visible instead of silently producing a wrong explanation.
 *
 * Money is accumulated in integer CENTS. Every column involved is
 * Decimal(_, 2), so this is exact and the residual cannot pick up float noise.
 */

const prisma = require("../config/database");

/**
 * Wholesale statuses that represent real invoiced revenue.
 *
 * An allow-list, not `notIn: ["DRAFT","CANCELLED"]`. Under the old exclusion
 * list a QUOTED order — a quotation, which nobody owes yet — was booked as
 * revenue the moment it was raised, and any status added to the enum later
 * would default to counting as revenue. Shared with routes/reports.js so the
 * bridge and the report can never disagree on what "invoiced" means.
 */
const INVOICED_BULK_STATUSES = ["CONFIRMED", "PARTIALLY_PAID", "PAID", "RETURNED"];

/** Decimal → integer cents. Exact for the Decimal(_, 2) columns used here. */
const cents = (v) => Math.round(Number(v || 0) * 100);
const toMoney = (c) => c / 100;

/**
 * A sale counts as CASH COLLECTED only if the money actually reached the till.
 * Mirrors `collectedSaleWhere` in routes/branches.js (D7): card sales settle
 * externally, cash on an undelivered order is still on the road.
 *
 * Note this is deliberately written as an allow-list of payment methods. The
 * PaymentMethod enum also carries CARD, which routes/branches.js silently drops
 * — unused today, but if it is ever used the amount surfaces in the
 * "delivery cash in flight" term rather than vanishing.
 */
const isCollectedRetail = (sale) => {
  if (sale.paymentMethod === "VISA" || sale.paymentMethod === "INSTAPAY") return true;
  if (sale.paymentMethod !== "CASH") return false;
  return sale.deliveryStatus == null || sale.deliveryStatus === "DELIVERED";
};

const isRefundRow = (sale) => String(sale.saleNumber || "").startsWith("REFUND-");

/**
 * Compute both bases and the bridge between them for one Cairo window.
 *
 * @param {Date}           start      window start (from utils/dateRange)
 * @param {Date}           end        window end   (inclusive)
 * @param {number[]|null}  branchIds  branches in scope; null = every branch
 * @returns {Promise<object>} { accrual, cash, terms, residual, diagnostics }
 */
async function computeSalesBasisBridge({ start, end, branchIds = null }) {
  const scoped = Array.isArray(branchIds) && branchIds.length > 0;

  // Every branch in scope, with the flags both handlers key off.
  const branches = await prisma.branch.findMany({
    where: scoped ? { id: { in: branchIds } } : {},
    select: { id: true, name: true, isActive: true, warehouseId: true, treasuryId: true },
  });

  const branchById = new Map(branches.map((b) => [b.id, b]));
  const activeBranches = branches.filter((b) => b.isActive);

  // Wholesale is scoped by WAREHOUSE (Branch.warehouseId is @unique), matching
  // routes/reports.js. null = every warehouse.
  const scopedWarehouseIds = scoped
    ? branches.map((b) => b.warehouseId).filter((id) => id != null)
    : null;

  // Attribution maps, built from IN-SCOPE ACTIVE branches only — exactly the
  // set routes/branches.js builds them from, so a payment that page cannot
  // attribute is not attributed here either.
  const warehouseToBranch = new Map(
    activeBranches.filter((b) => b.warehouseId).map((b) => [b.warehouseId, b.id]),
  );
  const treasuryToBranch = new Map(
    activeBranches.filter((b) => b.treasuryId).map((b) => [b.treasuryId, b.id]),
  );

  // ── Retail ────────────────────────────────────────────────────────────────
  // Light select: this runs alongside the report, so it must not re-hydrate
  // every sale's items the way /general does.
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: "COMPLETED",
      isVoided: false,
      ...(scoped ? { branchId: { in: branchIds } } : {}),
    },
    select: {
      total: true,
      saleNumber: true,
      paymentMethod: true,
      deliveryStatus: true,
      branchId: true,
    },
  });

  let retailAccrualC = 0;
  let retailCashC = 0;
  let retailAccrualCount = 0;
  let retailCashCount = 0;
  let deliveryInFlightC = 0; // on the road — will reach the till
  let deliveryFailedC = 0; // returned/cancelled — never will
  let uncountedMethodC = 0; // catch-all, see below
  let inactiveBranchC = 0; // whole branch excluded by the cash view
  let inFlightCount = 0;
  let failedCount = 0;
  let uncountedMethodCount = 0;
  let inactiveBranchCount = 0;

  for (const sale of sales) {
    const amount = cents(sale.total);
    const branch = branchById.get(sale.branchId);
    const branchActive = branch ? branch.isActive : false;
    const counts = !isRefundRow(sale);

    retailAccrualC += amount;
    if (counts) retailAccrualCount += 1;

    if (!branchActive) {
      // Disjoint from the delivery terms below: an inactive branch's sales are
      // excluded by مبيعات الفروع entirely, whatever their delivery state.
      inactiveBranchC += amount;
      if (counts) inactiveBranchCount += 1;
      continue;
    }

    if (isCollectedRetail(sale)) {
      retailCashC += amount;
      if (counts) retailCashCount += 1;
      continue;
    }

    // Not collected. Split by WHY, because the two cases mean opposite things
    // to a manager: in-flight money is still coming, failed delivery never is.
    if (sale.paymentMethod === "CASH") {
      if (sale.deliveryStatus === "RETURNED" || sale.deliveryStatus === "CANCELED") {
        deliveryFailedC += amount;
        if (counts) failedCount += 1;
      } else {
        deliveryInFlightC += amount;
        if (counts) inFlightCount += 1;
      }
    } else {
      // Catch-all. Unreachable today — the payment methods in use are exactly
      // the three both pages count. It exists so that a method added later
      // lands in a visible, labelled line instead of breaking the identity and
      // showing up as an unexplained residual.
      uncountedMethodC += amount;
      if (counts) uncountedMethodCount += 1;
    }
  }

  // ── Wholesale invoiced (accrual) ──────────────────────────────────────────
  const bulkOrders = await prisma.bulkOrder.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { in: INVOICED_BULK_STATUSES },
      ...(scopedWarehouseIds ? { warehouseId: { in: scopedWarehouseIds } } : {}),
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      createdAt: true,
      status: true,
      warehouseId: true,
    },
  });

  const invoicedInWindow = new Map(bulkOrders.map((o) => [o.id, o]));
  const wholesaleInvoicedC = bulkOrders.reduce((s, o) => s + cents(o.total), 0);

  // ── Wholesale returns ─────────────────────────────────────────────────────
  // Accrual reverses the FULL order total once per order, whatever the refund
  // method. The cash view only subtracts what was physically handed back
  // (CASH_REFUND); a CREDIT_NOTE moves no money. That asymmetry is a real term.
  const bulkRefunds = await prisma.bulkRefund.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...(scopedWarehouseIds
        ? { order: { warehouseId: { in: scopedWarehouseIds } } }
        : {}),
    },
    select: {
      orderId: true,
      method: true,
      amount: true,
      treasuryId: true,
      order: { select: { orderNumber: true, total: true, warehouseId: true } },
    },
  });

  const reversedOrders = new Map();
  let cashRefundedC = 0;
  for (const refund of bulkRefunds) {
    if (!reversedOrders.has(refund.orderId) && refund.order) {
      reversedOrders.set(refund.orderId, refund.order);
    }
    if (refund.method === "CASH_REFUND") {
      const branchId =
        warehouseToBranch.get(refund.order?.warehouseId) ??
        treasuryToBranch.get(refund.treasuryId);
      if (branchId) cashRefundedC += cents(refund.amount);
    }
  }
  const wholesaleReturnsC = [...reversedOrders.values()].reduce(
    (s, o) => s + cents(o.total),
    0,
  );

  // ── Wholesale collected (cash) ────────────────────────────────────────────
  // Mirrors routes/branches.js: dated by receivedAt, voided rows excluded, and
  // legacy opening-debt rows (no order AND a negative amount) dropped — those
  // are a pre-existing receivable, not money collected in this window.
  const bulkPayments = await prisma.bulkPayment.findMany({
    where: {
      receivedAt: { gte: start, lte: end },
      voidedAt: null,
      OR: [{ orderId: { not: null } }, { amount: { gte: 0 } }],
    },
    select: {
      amount: true,
      treasuryId: true,
      orderId: true,
      order: { select: { id: true, orderNumber: true, warehouseId: true, createdAt: true } },
    },
  });

  let collectedOnWindowOrdersC = 0; // against an invoice raised in this window
  let collectedOnPriorOrdersC = 0; // against an invoice raised earlier
  let oldDebtCollectedC = 0; // no invoice at all
  let unattributedC = 0; // no branch to sit under — dropped by both views
  const collectedByOrder = new Map();
  const priorOrders = new Map();

  for (const payment of bulkPayments) {
    const amount = cents(payment.amount);
    const branchId =
      warehouseToBranch.get(payment.order?.warehouseId) ??
      treasuryToBranch.get(payment.treasuryId);

    if (!branchId) {
      unattributedC += amount;
      continue;
    }

    if (payment.orderId == null) {
      oldDebtCollectedC += amount;
    } else if (invoicedInWindow.has(payment.orderId)) {
      collectedOnWindowOrdersC += amount;
      collectedByOrder.set(
        payment.orderId,
        (collectedByOrder.get(payment.orderId) || 0) + amount,
      );
    } else {
      collectedOnPriorOrdersC += amount;
      if (payment.order) {
        const prior = priorOrders.get(payment.orderId) || {
          orderNumber: payment.order.orderNumber,
          invoicedAt: payment.order.createdAt,
          amount: 0,
        };
        prior.amount += amount;
        priorOrders.set(payment.orderId, prior);
      }
    }
  }

  const wholesaleCollectedC =
    collectedOnWindowOrdersC + collectedOnPriorOrdersC + oldDebtCollectedC;

  // Which invoices raised in this window are still outstanding — this is what
  // turns "6,400 missing" into "BULK-0021, collected on 16 Aug".
  const uncollectedOrders = bulkOrders
    .map((o) => ({
      orderNumber: o.orderNumber,
      invoicedAt: o.createdAt,
      amount: toMoney(cents(o.total) - (collectedByOrder.get(o.id) || 0)),
      branchName: branchById.get(warehouseToBranch.get(o.warehouseId))?.name || null,
    }))
    .filter((o) => o.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  // ── Assemble ──────────────────────────────────────────────────────────────
  const accrualTotalC = retailAccrualC + wholesaleInvoicedC - wholesaleReturnsC;
  const cashTotalC = retailCashC + wholesaleCollectedC - cashRefundedC;

  // Signed so that Σ terms === accrual.total − cash.total.
  const rawTerms = [
    {
      key: "deliveryCashInFlight",
      label: "نقدية طلبات توصيل لم تُسلَّم بعد",
      hint: "مبيعات نقدي على طلبات دليفري ما زالت في الطريق — فوترت بالفعل لكنها لم تدخل الخزنة بعد.",
      amountC: deliveryInFlightC,
      count: inFlightCount,
    },
    {
      key: "deliveryFailed",
      label: "نقدية طلبات توصيل مرتجعة أو ملغاة",
      hint: "طلبات دليفري لم تصل للعميل — التقرير العام ما زال يحتسبها كفاتورة، والخزنة لن تستلمها.",
      amountC: deliveryFailedC,
      count: failedCount,
    },
    {
      key: "retailUncountedMethod",
      label: "مبيعات بطريقة دفع غير محسوبة في صفحة الفروع",
      hint: "لا توجد حاليًا — سطر احترازي يظهر فقط إذا أُضيفت طريقة دفع جديدة لا تحسبها صفحة الفروع.",
      amountC: uncountedMethodC,
      count: uncountedMethodCount,
    },
    {
      key: "inactiveBranchSales",
      label: "مبيعات فروع موقوفة",
      hint: "التقرير العام يشمل الفروع الموقوفة، صفحة مبيعات الفروع لا تعرضها.",
      amountC: inactiveBranchC,
      count: inactiveBranchCount,
    },
    {
      key: "wholesaleInvoicedUncollected",
      label: "جملة مفوترة ولم تُحصَّل بعد",
      hint: "فواتير جملة صدرت في هذه الفترة ولم يدفعها العميل بعد.",
      amountC: wholesaleInvoicedC - collectedOnWindowOrdersC,
      orders: uncollectedOrders,
    },
    {
      key: "wholesaleCollectedPrior",
      label: "جملة محصَّلة عن فواتير سابقة",
      hint: "نقدية وصلت في هذه الفترة عن فواتير جملة صادرة قبلها.",
      amountC: -collectedOnPriorOrdersC,
      orders: [...priorOrders.values()].map((o) => ({
        orderNumber: o.orderNumber,
        invoicedAt: o.invoicedAt,
        amount: toMoney(o.amount),
      })),
    },
    {
      key: "wholesaleOldDebt",
      label: "تحصيل مديونيات قديمة (بدون فاتورة)",
      hint: "سداد رصيد قديم لا تقابله فاتورة في النظام — نقدية حقيقية لكنها ليست مبيعات الفترة.",
      amountC: -oldDebtCollectedC,
    },
    {
      key: "wholesaleReturnsReversed",
      label: "مرتجعات جملة (عكس الفاتورة بالكامل)",
      hint: "التقرير العام يعكس قيمة الفاتورة كاملة عند الارتجاع.",
      amountC: -wholesaleReturnsC,
    },
    {
      key: "wholesaleCashRefunded",
      label: "مرتجعات جملة مردودة نقدًا",
      hint: "الجزء الذي خرج فعليًا من الخزنة عند الارتجاع (إشعار الخصم لا يحرك نقدية).",
      amountC: cashRefundedC,
    },
  ];

  const termsSumC = rawTerms.reduce((s, t) => s + t.amountC, 0);
  const residualC = accrualTotalC - cashTotalC - termsSumC;

  // The count gap has its own, much simpler bridge. It is mostly DEFINITIONAL:
  // التقرير العام adds wholesale orders to عدد الفواتير, مبيعات الفروع counts
  // retail receipts only. Stating that in one line is what stops "709 vs 705"
  // reading as a bug.
  const countTerms = [
    {
      key: "wholesaleOrdersNotRetailInvoices",
      label: "أوامر جملة (ليست فواتير تجزئة)",
      hint: "التقرير العام يضيف أوامر الجملة إلى عدد الفواتير؛ صفحة الفروع تعد فواتير التجزئة فقط.",
      amount: bulkOrders.length,
    },
    { key: "deliveryCashInFlight", label: "طلبات توصيل لم تُسلَّم بعد", amount: inFlightCount },
    { key: "deliveryFailed", label: "طلبات توصيل مرتجعة أو ملغاة", amount: failedCount },
    { key: "retailUncountedMethod", label: "طريقة دفع غير محسوبة", amount: uncountedMethodCount },
    { key: "inactiveBranchSales", label: "فواتير فروع موقوفة", amount: inactiveBranchCount },
  ];
  const accrualInvoiceCount = retailAccrualCount + bulkOrders.length;
  const countResidual =
    accrualInvoiceCount - retailCashCount - countTerms.reduce((s, t) => s + t.amount, 0);

  return {
    accrual: {
      source: "التقرير العام",
      basis: "بالفوترة",
      retail: toMoney(retailAccrualC),
      wholesale: toMoney(wholesaleInvoicedC - wholesaleReturnsC),
      total: toMoney(accrualTotalC),
      retailInvoiceCount: retailAccrualCount,
      wholesaleOrderCount: bulkOrders.length,
      invoiceCount: accrualInvoiceCount,
    },
    cash: {
      source: "مبيعات الفروع",
      basis: "المُحصَّل في الخزنة",
      retail: toMoney(retailCashC),
      wholesale: toMoney(wholesaleCollectedC - cashRefundedC),
      total: toMoney(cashTotalC),
      retailInvoiceCount: retailCashCount,
      invoiceCount: retailCashCount,
    },
    terms: rawTerms.map(({ amountC, ...rest }) => ({
      ...rest,
      amount: toMoney(amountC),
    })),
    gap: toMoney(accrualTotalC - cashTotalC),
    // Must be 0. Surfaced rather than asserted so a predicate that drifts out of
    // step with the handler it mirrors shows up in the UI instead of producing a
    // confident wrong answer.
    residual: toMoney(residualC),
    counts: {
      accrual: accrualInvoiceCount,
      cash: retailCashCount,
      gap: accrualInvoiceCount - retailCashCount,
      terms: countTerms,
      residual: countResidual,
    },
    diagnostics: {
      // Collections with no branch to sit under (no order and a non-branch
      // treasury). Excluded from BOTH views, so not a bridge term — but if this
      // is ever non-zero, money is missing from مبيعات الفروع.
      unattributedCollections: toMoney(unattributedC),
    },
  };
}

module.exports = {
  computeSalesBasisBridge,
  INVOICED_BULK_STATUSES,
  isCollectedRetail,
  isRefundRow,
};
