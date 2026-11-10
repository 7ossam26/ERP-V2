/**
 * tieouts.js — does the journal agree with the numbers the rest of the ERP shows?
 *
 * Two kinds of check:
 *
 * PERIOD (any window, any scope)
 *   revenue  Revenue + VAT movement vs التقرير العام's totalSales, recomputed
 *            independently by lib/salesBasisBridge (its accrual side). Must be 0.
 *
 * LIVE BALANCES (consolidated view, window ending today or later)
 *   treasuries  journal balance per treasury vs lib/treasuryRebuild (must be 0 —
 *               same rules) and vs the stored Treasury.balance. The second gap is
 *               the pre-existing "رصيد بلا مستند" drift that
 *               scripts/reconcile-treasuries.js reports; the journal exposes it,
 *               it never absorbs it.
 *   suppliers   journal payable vs SupplierAccount.balance.
 *   customers   journal receivable vs services/bulkCredit's open balance, with
 *               the one named term that formula leaves out.
 *   drivers     journal custody vs Σ DeliveryMan.walletBalance, with the
 *               undispatched delivery orders named.
 *
 * Every residual is reported, never rounded away.
 */

const prisma = require("../../config/database");
const { computeSalesBasisBridge } = require("../salesBasisBridge");
const { rebuild } = require("../treasuryRebuild");
const { cents, toMoney } = require("./sources");

const BULK_OPEN_STATUSES = ["CONFIRMED", "PARTIALLY_PAID", "PAID"]; // services/bulkCredit.service.js

async function revenueTieOut(journal, { start, end, branchIds }) {
  const bridge = await computeSalesBasisBridge({ start, end, branchIds });
  const p = journal.period;
  const journalC = p.REVENUE.cr - p.REVENUE.dr + (p.VAT.cr - p.VAT.dr);
  const generalC = cents(bridge.accrual.total);
  return {
    label: "المبيعات + الضريبة مقابل التقرير العام",
    journal: toMoney(journalC),
    general: toMoney(generalC),
    difference: toMoney(journalC - generalC),
  };
}

async function treasuryTieOut(journal) {
  const { ctx, subsidiary } = journal;
  const out = [];
  for (const t of ctx.treasuries) {
    const r = await rebuild(t, ctx.config);
    const journalC = subsidiary.treasury.get(t.id) || 0;
    out.push({
      treasuryId: t.id,
      name: t.name,
      journal: toMoney(journalC),
      documents: r.expected,
      stored: r.actual,
      // Must be 0: the journal and the rebuild apply the same posting rules.
      journalVsDocuments: toMoney(journalC - cents(r.expected)),
      // Pre-existing drift between the stored balance and its paperwork.
      unexplained: toMoney(cents(r.actual) - journalC),
    });
  }
  return out;
}

async function supplierTieOut(journal) {
  const accounts = await prisma.supplierAccount.findMany({
    select: { supplierId: true, balance: true, supplier: { select: { name: true } } },
  });
  const seen = new Set();
  const rows = [];
  let journalC = 0;
  let storedC = 0;
  for (const a of accounts) {
    seen.add(a.supplierId);
    const j = journal.subsidiary.supplier.get(a.supplierId) || 0;
    const s = cents(a.balance);
    journalC += j;
    storedC += s;
    if (j !== s) rows.push({ supplierId: a.supplierId, name: a.supplier?.name, journal: toMoney(j), stored: toMoney(s), difference: toMoney(j - s) });
  }
  for (const [supplierId, j] of journal.subsidiary.supplier) {
    if (seen.has(supplierId) || !j) continue;
    journalC += j;
    rows.push({ supplierId, name: null, journal: toMoney(j), stored: 0, difference: toMoney(j) });
  }
  return { journal: toMoney(journalC), stored: toMoney(storedC), difference: toMoney(journalC - storedC), mismatches: rows };
}

/**
 * bulkCredit's open balance = Σ open order totals − Σ non-voided payments. It
 * drops a RETURNED order's total but keeps its payments, so a customer whose
 * paid order came back reads as owed the cash that was in fact refunded. The
 * journal clears that order to zero, so the two differ by exactly the cash
 * refunded — named here as the one bridge term.
 */
async function customerTieOut(journal) {
  const [orders, payments, refunds] = await Promise.all([
    prisma.bulkOrder.findMany({
      where: { status: { in: BULK_OPEN_STATUSES } },
      select: { customerId: true, total: true },
    }),
    prisma.bulkPayment.findMany({ where: { voidedAt: null }, select: { customerId: true, amount: true } }),
    prisma.bulkRefund.findMany({
      where: { treasuryId: { not: null } },
      select: { amount: true, order: { select: { customerId: true } } },
    }),
  ]);
  const openC = orders.reduce((s, o) => s + cents(o.total), 0) - payments.reduce((s, p) => s + cents(p.amount), 0);
  const refundedC = refunds.reduce((s, r) => s + cents(r.amount), 0);
  let journalC = 0;
  for (const v of journal.subsidiary.customer.values()) journalC += v;
  return {
    journal: toMoney(journalC),
    openBalance: toMoney(openC),
    cashRefundedOnReturns: toMoney(refundedC),
    residual: toMoney(journalC - openC - refundedC),
  };
}

/**
 * The journal books a delivery sale to custody the moment it is invoiced; the
 * driver's wallet only takes it on dispatch. Orders still PENDING dispatch are
 * the named difference.
 */
async function driverTieOut(journal) {
  const [wallets, pending] = await Promise.all([
    prisma.deliveryMan.aggregate({ _sum: { walletBalance: true } }),
    prisma.sale.findMany({
      where: { deliveryStatus: "PENDING", status: "COMPLETED", isVoided: false },
      select: { total: true, deliveryDriverShare: true },
    }),
  ]);
  const walletC = cents(wallets._sum.walletBalance);
  const pendingC = pending.reduce((s, x) => s + cents(x.total) - cents(x.deliveryDriverShare), 0);
  const journalC = journal.subsidiary.custodyC;
  return {
    journal: toMoney(journalC),
    wallets: toMoney(walletC),
    pendingDispatch: toMoney(pendingC),
    residual: toMoney(journalC - walletC - pendingC),
  };
}

/**
 * @param {boolean} live  also tie to stored balances (consolidated, up to today)
 */
async function computeTieOuts(journal, { start, end, branchIds, live }) {
  const result = { revenue: await revenueTieOut(journal, { start, end, branchIds }) };
  if (live) {
    result.treasuries = await treasuryTieOut(journal);
    result.suppliers = await supplierTieOut(journal);
    result.customers = await customerTieOut(journal);
    result.drivers = await driverTieOut(journal);
  }
  return result;
}

module.exports = { computeTieOuts };
