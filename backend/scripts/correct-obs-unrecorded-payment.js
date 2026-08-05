#!/usr/bin/env node
/**
 * Record the part of اوبس's 02/08/2026 collection that the system never wrote.
 *
 * WHAT HAPPENED
 *
 * At 00:16 on 02/08/2026, mohamed (user 2) recorded a 75,120 collection from
 * اوبس (customer 20) into خزينة الإدارة (treasury 9). Audit 39695 holds the
 * submitted body, audit 39696 the treasury moving 185,684 → 260,804 by the full
 * 75,120. But createCustomerPayment only wrote payment rows for what the OPEN
 * ORDERS could absorb — PAY-93, 10,260 against BULK-0016 — and dropped the rest,
 * because its fallback fired only when NO order matched at all.
 *
 * The 64,860 remainder was اوبس's opening balance, recorded 29/07 as PAY-74. It
 * is stored as a payment row rather than an order, so the distribution loop
 * could never see it however large it got. The customer has since confirmed
 * paying the full 75,120.
 *
 * WHAT THIS DOES
 *
 * Writes the missing payment row and NOTHING ELSE. Specifically it does NOT
 * touch treasury 9: the balance already took all 75,120 on the night, so
 * crediting it again would create the very error this is correcting, in reverse.
 *
 * The row is dated to the original collection because that is when the customer
 * paid — the statement should read 02/08, not the day of the correction. Who
 * added it, and when, is in the audit rows this writes.
 *
 * AFTER THIS RUNS
 *   treasury 9 balance    188,344.00  (unchanged)
 *   treasury 9 documents  123,484.00 → 188,344.00   reconciles to zero
 *   اوبس open balance      77,660.00 →  12,800.00   = BULK-0021 + BULK-0028
 *
 * A physical count is still worth doing, but it now answers a different
 * question: whether the cash اوبس handed over actually reached the safe. This
 * correction is right either way — it records that the customer paid.
 *
 * USAGE
 *   node scripts/correct-obs-unrecorded-payment.js           # dry run
 *   node scripts/correct-obs-unrecorded-payment.js --apply   # commit
 */

const prisma = require("../config/database");
const { writeAudit } = require("../utils/auditLogger");

const CUSTOMER_ID = 20;
const TREASURY_ID = 9;
const SOURCE_PAYMENT_ID = 93; // the row that was written, to date the new one
const COLLECTED = 75120;
const AUDIT_REF = 39695;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const money = (n) => Number(n || 0).toFixed(2);
const cairo = (d) =>
  new Date(+new Date(d) + 3 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");

async function openBalance(customerId) {
  const orders = await prisma.bulkOrder.findMany({
    where: { customerId, status: { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] } },
    select: { total: true },
  });
  const payments = await prisma.bulkPayment.findMany({
    where: { customerId, voidedAt: null },
    select: { amount: true },
  });
  const billed = orders.reduce((s, o) => s + Number(o.total), 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  return round2(billed - paid);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const customer = await prisma.bulkCustomer.findUnique({
    where: { id: CUSTOMER_ID },
    select: { id: true, companyName: true },
  });
  if (!customer) throw new Error(`Customer ${CUSTOMER_ID} not found`);

  const source = await prisma.bulkPayment.findUnique({
    where: { id: SOURCE_PAYMENT_ID },
    select: { id: true, amount: true, receivedAt: true, createdByUserId: true, customerId: true },
  });
  if (!source || source.customerId !== CUSTOMER_ID) {
    throw new Error(`PAY-${SOURCE_PAYMENT_ID} is not a payment of customer ${CUSTOMER_ID}`);
  }

  // Recompute the shortfall from the rows themselves rather than trusting the
  // constant: every payment written in that same second, against what the
  // treasury was told to take.
  const sameCollection = await prisma.bulkPayment.findMany({
    where: { customerId: CUSTOMER_ID, receivedAt: source.receivedAt, voidedAt: null },
    select: { id: true, amount: true },
  });
  const recorded = round2(sameCollection.reduce((s, p) => s + Number(p.amount), 0));
  const missing = round2(COLLECTED - recorded);

  const treasury = await prisma.treasury.findUnique({
    where: { id: TREASURY_ID },
    select: { id: true, name: true, balance: true },
  });
  const before = await openBalance(CUSTOMER_ID);

  console.log("\n═══ تصحيح تحصيل اوبس غير المسجل ═══\n");
  console.log(`  العميل            : ${customer.companyName} (id=${customer.id})`);
  console.log(`  التحصيل           : ${cairo(source.receivedAt)} (القاهرة)`);
  console.log(`  المبلغ المُدخل     : ${money(COLLECTED)}   [سجل التدقيق ${AUDIT_REF}]`);
  console.log(`  المسجَّل فعليًا     : ${money(recorded)}   [${sameCollection.map((p) => "PAY-" + p.id).join(", ")}]`);
  console.log(`  الناقص            : ${money(missing)}`);
  console.log(`\n  رصيد ${treasury.name}: ${money(treasury.balance)}  ← لن يُمس`);
  console.log(`  رصيد اوبس المستحق  : ${money(before)}  →  ${money(round2(before - missing))}`);

  if (missing <= 0) {
    console.log("\n✓ لا يوجد نقص. لا شيء ليُنفَّذ.\n");
    return;
  }

  // Idempotency: a correction row for this collection must exist at most once.
  const already = await prisma.bulkPayment.findFirst({
    where: {
      customerId: CUSTOMER_ID,
      orderId: null,
      amount: missing,
      notes: { contains: "[تصحيح]" },
    },
    select: { id: true, notes: true },
  });
  if (already) {
    console.log(`\n✓ التصحيح منفَّذ بالفعل — PAY-${already.id}. لن يتكرر.\n`);
    return;
  }

  if (!apply) {
    console.log("\n─── تشغيل تجريبي — لم يتغير شيء ───");
    console.log("  سيُضاف صف دفعة واحد:");
    console.log(`    العميل      : ${customer.companyName}`);
    console.log(`    المبلغ      : ${money(missing)}`);
    console.log(`    الطلب       : بدون — رصيد لحساب العميل`);
    console.log(`    الخزينة     : ${treasury.name} (مرجع فقط — الرصيد لن يتغير)`);
    console.log(`    التاريخ     : ${cairo(source.receivedAt)}`);
    console.log("\n  لن يُكتب أي تعديل على رصيد الخزينة.");
    console.log("\n  للتنفيذ: node scripts/correct-obs-unrecorded-payment.js --apply\n");
    return;
  }

  const created = await prisma.bulkPayment.create({
    data: {
      orderId: null,
      customerId: CUSTOMER_ID,
      treasuryId: TREASURY_ID,
      method: "CASH",
      amount: missing,
      receivedAt: source.receivedAt,
      createdByUserId: source.createdByUserId,
      notes:
        `[تصحيح] الجزء غير المسجل من تحصيل ${money(COLLECTED)} بتاريخ ` +
        `${cairo(source.receivedAt)} — الخزينة استلمته وقتها ولم يُسجَّل على الحساب. ` +
        `مرجع سجل التدقيق ${AUDIT_REF}. تأكيد العميل بالسداد.`,
    },
  });

  const after = await openBalance(CUSTOMER_ID);

  await writeAudit({
    action: "CREATE",
    targetEntity: "bulk_payment",
    targetId: created.id,
    userId: null,
    branchId: null,
    oldValues: null,
    newValues: {
      source: "correction_script",
      script: "correct-obs-unrecorded-payment.js",
      reason: "unrecorded_remainder_of_customer_payment",
      customerId: CUSTOMER_ID,
      amount: missing,
      collectedTotal: COLLECTED,
      recordedAtTheTime: recorded,
      treasuryId: TREASURY_ID,
      treasuryTouched: false,
      originalAuditRef: AUDIT_REF,
      customerOpenBalanceBefore: before,
      customerOpenBalanceAfter: after,
    },
    ipAddress: null,
  }).catch(() => {});

  console.log("\n═══ تم التنفيذ ═══\n");
  console.log(`  صف الدفعة الجديد   : PAY-${created.id}   ${money(created.amount)}`);
  console.log(`  رصيد الخزينة       : ${money(treasury.balance)}  (لم يتغير)`);
  console.log(`  رصيد اوبس المستحق  : ${money(before)}  →  ${money(after)}`);
  console.log("\n  راجع: node scripts/reconcile-treasuries.js\n");
}

main()
  .catch((e) => {
    console.error("\n✕ فشل:", e.message, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
