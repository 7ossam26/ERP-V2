/**
 * treasuryRebuild.js
 *
 * Rebuild one treasury's balance from the documents that are allowed to move it.
 *
 * Extracted verbatim from scripts/reconcile-treasuries.js so the American journal
 * (lib/journal) can tie its cash and bank columns to the exact same rules the
 * reconciliation script has been validated with. The script still owns its CLI
 * output; this module owns the posting rules. If one of the two ever needs a
 * rule change, change it HERE so they cannot drift apart.
 *
 * Treasury.balance is a stored number, not a derived one. Every code path that
 * moves money issues its own `balance: { increment/decrement }` and separately
 * writes whatever document represents it. Nothing forces the two to agree —
 * this is what makes a disagreement visible.
 */

const prisma = require("../config/database");

const CASH_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE"];
const TOLERANCE = 0.005; // half a piastre — below this is float noise, not drift

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * The documents that may move one treasury, each as a signed total.
 *
 * Routing note: a card or InstaPay sale credits the GLOBAL treasury named in
 * system configuration, not the branch treasury recorded on the sale row. So
 * sales are matched by payment method against the treasury's role, never by
 * Sale.treasuryId alone.
 */
async function rebuild(treasury, config) {
  const id = treasury.id;
  const lines = [];
  const push = (label, sign, sum, count) =>
    lines.push({ label, amount: round2(sign * Number(sum || 0)), count: count || 0 });

  // ── point of sale ──────────────────────────────────────────────────────────
  // DELIVERY SALES ARE EXCLUDED EVERYWHERE BELOW.
  //
  // A counter sale credits its treasury the moment it is rung up. A delivery
  // sale does not: the cash leaves with the rider as a debt on their wallet and
  // only reaches a treasury when they settle, which writes a Deposit row. An
  // InstaPay conversion goes further and rewrites the sale's own paymentMethod
  // to INSTAPAY while also writing a Deposit — so counting the sale AND the
  // deposit charges the same money twice.
  //
  // Measured against production on 04/08/2026, this single exclusion accounted
  // for every branch discrepancy exactly: مكه 90,558.90, مصر حلوان 4,997.50,
  // الرحاب 380.00, انستاباي 23,080.00 — to the piastre, all of it delivery.
  const cashSales = await prisma.sale.aggregate({
    where: { treasuryId: id, paymentMethod: "CASH", deliveryStatus: null },
    _sum: { total: true },
    _count: true,
  });
  push("مبيعات نقدية (كاونتر)", +1, cashSales._sum.total, cashSales._count);

  // Card / InstaPay sales land in the configured global treasury, wherever sold.
  if (config?.visaTreasuryId === id) {
    const v = await prisma.sale.aggregate({
      where: { paymentMethod: "VISA", deliveryStatus: null },
      _sum: { total: true },
      _count: true,
    });
    push("مبيعات فيزا", +1, v._sum.total, v._count);
  }
  if (config?.instapayTreasuryId === id) {
    const i = await prisma.sale.aggregate({
      where: { paymentMethod: "INSTAPAY", deliveryStatus: null },
      _sum: { total: true },
      _count: true,
    });
    push("مبيعات انستاباي", +1, i._sum.total, i._count);
  }

  // ── shift lifecycle, delivery settlements, manual moves ────────────────────
  // Every one of these writes a Deposit or Withdrawal row alongside its balance
  // change, so the two tables cover them without needing per-feature rules.
  const dep = await prisma.deposit.aggregate({
    where: { treasuryId: id }, _sum: { amount: true }, _count: true,
  });
  push("إيداعات", +1, dep._sum.amount, dep._count);

  const wit = await prisma.withdrawal.aggregate({
    where: { treasuryId: id }, _sum: { amount: true }, _count: true,
  });
  push("مسحوبات", -1, wit._sum.amount, wit._count);

  // ── spending ───────────────────────────────────────────────────────────────
  // A purchase writes BOTH a Purchase row and a mirroring Expense of type
  // PURCHASE ("Purchase Invoice #1390"), while debiting the treasury once.
  // Counting both charged purchase #16 twice on 05/08/2026 and raised a false
  // 2,664 alarm against خزينة الإدارة — so exactly one of them is counted.
  //
  // It is the EXPENSE (type PURCHASE with a purchaseId), not purchase.paidAmount.
  // paidAmount is also raised by every later supplier payment applied to the
  // invoice (routes/supplierAccounts.js), and that payment is already counted
  // below as a SupplierPayment against the treasury that actually paid — so
  // paidAmount charged it twice, and on the wrong treasury when they differ.
  // The purchase's own expense row is written in the same transaction as the
  // debit, for exactly the debited amount (netTotal for CASH/CREDIT, the paid
  // part for MIXED), and is re-synced when the purchase is edited.
  const exp = await prisma.expense.aggregate({
    where: { treasuryId: id, NOT: { type: "PURCHASE" } },
    _sum: { amount: true },
    _count: true,
  });
  push("مصروفات", -1, exp._sum.amount, exp._count);

  const pur = await prisma.expense.aggregate({
    where: { treasuryId: id, type: "PURCHASE", purchaseId: { not: null } },
    _sum: { amount: true },
    _count: true,
  });
  push("مشتريات (المدفوع)", -1, pur._sum.amount, pur._count);

  // Purchase returns / cancellations credit the purchase's treasury with NO
  // Deposit row: the whole return for CASH/CREDIT, the paid share for MIXED,
  // nothing for DEFERRED (that reduces the supplier debt instead). Rebuilt from
  // the PurchaseReturn rows with the same rule routes/purchases.js applies.
  // The MIXED share uses today's paidAmount/netTotal, so a MIXED invoice paid
  // further AFTER its return can show a small residual here.
  const returns = await prisma.purchaseReturn.findMany({
    where: { purchase: { treasuryId: id } },
    select: {
      totalAmount: true,
      purchase: { select: { paymentMethod: true, paidAmount: true, netTotal: true } },
    },
  });
  let returnedToTreasury = 0;
  for (const r of returns) {
    returnedToTreasury += purchaseReturnTreasuryShare(r.purchase, r.totalAmount);
  }
  push("مرتجعات مشتريات", +1, returnedToTreasury, returns.length);

  // A NEGATIVE supplier payment is an opening-balance entry — "we already owed
  // this supplier when the system started" — not cash leaving a drawer. Same
  // convention the wholesale module uses for old customer debt. خزنة المصنع
  // carries four of them totalling 11,767,425 dated 29/07 00:00, the import
  // timestamp, against a treasury balance of zero.
  const sup = await prisma.supplierPayment.aggregate({
    where: { treasuryId: id, amount: { gt: 0 } }, _sum: { amount: true }, _count: true,
  });
  push("دفعات موردين", -1, sup._sum.amount, sup._count);

  const pay = await prisma.payroll.aggregate({
    where: { treasuryId: id }, _sum: { netSalary: true }, _count: true,
  });
  push("رواتب", -1, pay._sum.netSalary, pay._count);

  // Employee advances debit the BRANCH's treasury (routes/employees.js) and
  // write only an EmployeeTransaction — no Withdrawal, no Expense — so without
  // this term every advance ever paid read as unexplained cash missing.
  const adv = await prisma.employeeTransaction.aggregate({
    where: { type: "ADVANCE", branch: { treasuryId: id } },
    _sum: { amount: true },
    _count: true,
  });
  push("سلف موظفين", -1, adv._sum.amount, adv._count);

  // ── transfers between treasuries ───────────────────────────────────────────
  // The two sides move at DIFFERENT times (routes/treasuries.js):
  //   source       debited when the transfer is CREATED, so PENDING counts too;
  //                a rejection refunds it, so REJECTED nets to zero.
  //   destination  credited only on APPROVAL.
  // Counting the source as APPROVED-only read every in-transit transfer as a
  // shortage on the sending treasury.
  const tin = await prisma.cashTransfer.aggregate({
    where: { toTreasuryId: id, status: "APPROVED" }, _sum: { amount: true }, _count: true,
  });
  push("تحويلات واردة", +1, tin._sum.amount, tin._count);

  const tout = await prisma.cashTransfer.aggregate({
    where: { fromTreasuryId: id, status: { in: ["PENDING", "APPROVED"] } },
    _sum: { amount: true },
    _count: true,
  });
  push("تحويلات صادرة (معلقة + معتمدة)", -1, tout._sum.amount, tout._count);

  // ── wholesale ──────────────────────────────────────────────────────────────
  // Voided payments were reversed on the balance, so they are excluded here too.
  // CREDIT-method rows (old-debt entries) never touched a treasury.
  const bp = await prisma.bulkPayment.aggregate({
    where: { treasuryId: id, voidedAt: null, method: { in: CASH_METHODS } },
    _sum: { amount: true },
    _count: true,
  });
  push("تحصيلات الجملة", +1, bp._sum.amount, bp._count);

  const br = await prisma.bulkRefund.aggregate({
    where: { treasuryId: id }, _sum: { amount: true }, _count: true,
  });
  push("مرتجعات الجملة", -1, br._sum.amount, br._count);

  const expected = round2(lines.reduce((s, l) => s + l.amount, 0));
  const actual = round2(treasury.balance);
  const diff = round2(actual - expected);

  return { lines, expected, actual, diff };
}

/**
 * How much of a purchase return went back into the purchase's treasury, the
 * rest reducing the supplier's balance. Same rule routes/purchases.js applies:
 * all of it for CASH/CREDIT, the paid share for MIXED, none for DEFERRED.
 * Shared with lib/journal so the journal splits a return exactly like this.
 */
function purchaseReturnTreasuryShare(purchase, totalAmount) {
  const method = purchase?.paymentMethod;
  const amt = Number(totalAmount || 0);
  if (method === "CASH" || method === "CREDIT") return amt;
  if (method === "MIXED") {
    const net = Number(purchase.netTotal || 0);
    if (net > 0) return amt * (Number(purchase.paidAmount || 0) / net);
  }
  return 0;
}

module.exports = { rebuild, purchaseReturnTreasuryShare, CASH_METHODS, TOLERANCE, round2 };
