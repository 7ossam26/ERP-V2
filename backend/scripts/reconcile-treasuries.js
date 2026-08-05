#!/usr/bin/env node
/**
 * Rebuild every treasury balance from the documents that are allowed to move it,
 * and report any treasury whose stored balance disagrees.
 *
 * WHY THIS EXISTS
 *
 * Treasury.balance is a stored number, not a derived one. Every code path that
 * moves money issues its own `balance: { increment/decrement }` and separately
 * writes whatever document represents it. Nothing forces the two to agree, and
 * no screen compares them — so when they diverge, the balance simply carries a
 * figure with no paper behind it and nobody sees it.
 *
 * That is not hypothetical. On 02/08/2026 a customer collection credited
 * خزينة الإدارة with 75,120 while writing payment rows worth 10,260. The 64,860
 * difference sat unnoticed for three days and was only found by rebuilding the
 * balance exactly the way this script does.
 *
 * WHAT "CLEAN" MEANS HERE
 *
 * A zero difference does NOT mean the cash is physically present — only that the
 * balance matches its own paperwork. A physical count is still the authority.
 * What this catches is the other failure: money in the number with no document,
 * or a document whose money never landed.
 *
 * USAGE
 *   node scripts/reconcile-treasuries.js            # table, exits 1 on any drift
 *   node scripts/reconcile-treasuries.js --json     # machine-readable
 *   node scripts/reconcile-treasuries.js --id 9     # one treasury, with detail
 *
 * Exit code 1 on any discrepancy, so a cron job or CI step can alert on it.
 */

const prisma = require("../config/database");

const CASH_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE"];
const TOLERANCE = 0.005; // half a piastre — below this is float noise, not drift

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const money = (n) => Number(n || 0).toFixed(2);

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
  // PURCHASE ("Purchase Invoice #1390"), while debiting the treasury once. The
  // Purchase is the source of truth because it carries paidAmount, which is what
  // actually left the drawer on a partly-paid invoice; the expense always shows
  // the invoice. Counting both charged purchase #16 twice on 05/08/2026 and
  // raised a false 2,664 alarm against خزينة الإدارة.
  const exp = await prisma.expense.aggregate({
    where: { treasuryId: id, NOT: { type: "PURCHASE" } },
    _sum: { amount: true },
    _count: true,
  });
  push("مصروفات", -1, exp._sum.amount, exp._count);

  const pur = await prisma.purchase.aggregate({
    where: { treasuryId: id }, _sum: { paidAmount: true }, _count: true,
  });
  push("مشتريات (المدفوع)", -1, pur._sum.paidAmount, pur._count);

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

  // ── transfers between treasuries ───────────────────────────────────────────
  // Pending and rejected transfers move nothing, so only APPROVED counts.
  const tin = await prisma.cashTransfer.aggregate({
    where: { toTreasuryId: id, status: "APPROVED" }, _sum: { amount: true }, _count: true,
  });
  push("تحويلات واردة", +1, tin._sum.amount, tin._count);

  const tout = await prisma.cashTransfer.aggregate({
    where: { fromTreasuryId: id, status: "APPROVED" }, _sum: { amount: true }, _count: true,
  });
  push("تحويلات صادرة", -1, tout._sum.amount, tout._count);

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

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const idFlag = args.indexOf("--id");
  const onlyId = idFlag !== -1 ? parseInt(args[idFlag + 1], 10) : null;

  const config = await prisma.systemConfiguration.findFirst({
    select: { visaTreasuryId: true, instapayTreasuryId: true },
  });

  const treasuries = await prisma.treasury.findMany({
    where: onlyId ? { id: onlyId } : {},
    select: { id: true, name: true, scope: true, balance: true },
    orderBy: { id: "asc" },
  });

  const results = [];
  for (const t of treasuries) {
    const r = await rebuild(t, config);
    results.push({ id: t.id, name: t.name, scope: t.scope, ...r });
  }

  const drifted = results.filter((r) => Math.abs(r.diff) > TOLERANCE);

  if (asJson) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results, drifted }, null, 2));
    process.exit(drifted.length ? 1 : 0);
  }

  const w = { name: 22, num: 15 };
  console.log("\nمطابقة أرصدة الخزائن بمستنداتها\n");
  console.log(
    "الخزينة".padEnd(w.name) +
    "من المستندات".padStart(w.num) +
    "في السيستم".padStart(w.num) +
    "الفرق".padStart(w.num),
  );
  console.log("─".repeat(w.name + w.num * 3));
  for (const r of results) {
    const flag = Math.abs(r.diff) > TOLERANCE ? "  ✕" : "";
    console.log(
      `${r.id}. ${r.name}`.padEnd(w.name) +
      money(r.expected).padStart(w.num) +
      money(r.actual).padStart(w.num) +
      money(r.diff).padStart(w.num) +
      flag,
    );
  }
  console.log("─".repeat(w.name + w.num * 3));

  // A single treasury gets its breakdown printed, since that is what you want
  // when you are chasing one number rather than scanning for problems.
  if (onlyId && results[0]) {
    console.log(`\nتفصيل ${results[0].name}:\n`);
    for (const l of results[0].lines) {
      if (!l.count) continue;
      console.log(`  ${l.label.padEnd(24)} ${String(l.count).padStart(5)} حركة ${money(l.amount).padStart(15)}`);
    }
  }

  if (drifted.length) {
    console.log(`\n✕ ${drifted.length} خزينة رصيدها لا يطابق مستنداتها:\n`);
    for (const r of drifted) {
      const dir = r.diff > 0 ? "زيادة بلا مستند" : "نقص بلا مستند";
      console.log(`   ${r.id}. ${r.name} — ${dir}: ${money(Math.abs(r.diff))}`);
    }
    console.log("\nالفرق الموجب معناه فلوس في الرصيد بلا ورق يثبتها.");
    console.log("الفرق السالب معناه ورق بفلوس لم تصل الرصيد.");
    console.log("في الحالتين، الجرد الفعلي هو الفيصل.\n");
    process.exit(1);
  }

  console.log("\n✓ كل الخزائن مطابقة لمستنداتها.");
  console.log("  ملاحظة: ده لا يعني أن النقدية موجودة فعليًا — الجرد وحده يثبت ذلك.\n");
  process.exit(0);
}

main()
  .catch((e) => {
    console.error("فشل الفحص:", e.message);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
