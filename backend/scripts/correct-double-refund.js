/**
 * Reverses the cash half of a return that was made on top of an already-voided
 * payment, taking the same money out of a treasury twice.
 *
 * BULK-0025 (order 95, حراز, 03/08/2026) is the case this was written for:
 *
 *   13:10  alaa kamal  payment 11,800 CASH            خزينة الإدارة  +11,800
 *   21:38  mohamed     VOIDS that payment              خزينة الإدارة  −11,800
 *   21:41  mohamed     RETURNS the order, CASH_REFUND  خزينة الإدارة  −11,800
 *   21:45  mohamed     re-issues as BULK-0031, paid    خزينة الإدارة  +11,800
 *
 * The customer paid once and never took cash back — four minutes later the same
 * money was applied to the corrected order. The void alone had already reversed
 * the credit, so the refund reversed it a second time and the treasury ended
 * 11,800 short. Stock is NOT affected: voidPayment never touches inventory, the
 * return credited it exactly once, and the net movement across both orders is
 * precisely the items of BULK-0031.
 *
 * WHAT THIS DOES
 * --------------
 *   1. Detaches the refund from its treasury (treasuryId → null) and records it
 *      as a CREDIT_NOTE. The goods really did come back; the cash did not move.
 *      Keeping the row is what holds the customer ledger at zero — the refund
 *      credit is what offsets the returned order's debit.
 *   2. Credits the treasury back by the refund amount.
 *
 * Idempotent: a refund already detached from its treasury is skipped, so a
 * second run cannot credit the money twice.
 *
 *   node scripts/correct-double-refund.js 1           # dry run
 *   node scripts/correct-double-refund.js 1 --apply   # write
 */

require("dotenv").config();
const prisma = require("../config/database");
const { writeAudit } = require("../utils/auditLogger");
const { roundMoney } = require("../utils/money");

const APPLY = process.argv.includes("--apply");
const IDS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const SCRIPT_TAG = "scripts/correct-double-refund.js";

const money = (n) => Number(n ?? 0).toFixed(2).padStart(13);

(async () => {
  if (!IDS.length) {
    console.error("usage: node scripts/correct-double-refund.js <refundId...> [--apply]");
    process.exit(1);
  }

  console.log(APPLY ? "APPLYING corrections\n" : "DRY RUN — nothing will be written\n");

  for (const id of IDS) {
    const refund = await prisma.bulkRefund.findUnique({
      where: { id },
      include: {
        treasury: { select: { id: true, name: true, balance: true } },
        order: {
          select: {
            id: true, orderNumber: true, status: true, customerId: true,
            payments: { select: { id: true, amount: true, voidedAt: true } },
            refunds: { select: { id: true, amount: true, method: true } },
          },
        },
      },
    });

    if (!refund) {
      console.log(`REF-${id}  not found — skipped`);
      continue;
    }
    if (!refund.treasuryId) {
      console.log(`REF-${id}  already detached from a treasury — skipped`);
      continue;
    }

    const o = refund.order;
    const livePaid = o.payments
      .filter((p) => !p.voidedAt)
      .reduce((s, p) => s + Number(p.amount), 0);
    const otherCashRefunds = o.refunds
      .filter((r) => r.id !== refund.id && r.method === "CASH_REFUND")
      .reduce((s, r) => s + Number(r.amount), 0);
    const refundable = roundMoney(livePaid - otherCashRefunds);
    const amount = roundMoney(Number(refund.amount));

    // Recomputed here rather than trusted from the caller, so a refund that IS
    // backed by a live payment is refused instead of silently reversed.
    if (amount <= refundable + 0.005) {
      console.log(
        `REF-${id}  backed by a live payment (refundable ${refundable.toFixed(2)}) — skipped`,
      );
      continue;
    }

    const before = roundMoney(Number(refund.treasury.balance));
    const after = roundMoney(before + amount);

    console.log(`REF-${id}  ${o.orderNumber || "#" + o.id}  (${o.status})`);
    console.log(`   المدفوع الساري على الطلب ${money(livePaid)}`);
    console.log(`   مبلغ المرتجع            ${money(amount)}   ← أكبر من المدفوع، يبقى خصم مكرر`);
    console.log(`   ${refund.treasury.name}: ${money(before)} -> ${money(after)}`);
    console.log(`   المرتجع: CASH_REFUND -> CREDIT_NOTE، وربط الخزنة يتشال`);

    if (!APPLY) {
      console.log("   (dry run)\n");
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.bulkRefund.update({
        where: { id },
        data: { treasuryId: null, method: "CREDIT_NOTE" },
      });
      await tx.treasury.update({
        where: { id: refund.treasuryId },
        data: { balance: { increment: amount } },
      });
    });

    await writeAudit({
      action: "UPDATE",
      targetEntity: "treasury",
      targetId: refund.treasuryId,
      userId: null,
      branchId: null,
      oldValues: { balance: before },
      newValues: {
        balance: after,
        delta: amount,
        reason:
          "cash refund reversed — the payment it refunded had already been voided, so the treasury paid the same money out twice",
        refundId: refund.id,
        orderId: o.id,
        orderNumber: o.orderNumber,
        livePaidOnOrder: livePaid,
        script: SCRIPT_TAG,
      },
    });

    await writeAudit({
      action: "UPDATE",
      targetEntity: "bulk_refund",
      targetId: refund.id,
      userId: null,
      branchId: null,
      oldValues: { method: "CASH_REFUND", treasuryId: refund.treasuryId },
      newValues: {
        method: "CREDIT_NOTE",
        treasuryId: null,
        reason: "the goods came back, the cash never left — see the treasury audit row",
        script: SCRIPT_TAG,
      },
    });

    console.log("   written + audited\n");
  }

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error("FAILED:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
