/**
 * One-off correction for shifts closed while the opening handover was being
 * subtracted from the drawer twice (fixed in routes/shifts.js — see the
 * `openingHandover` block in calculateSystemExpectedCash).
 *
 * Those shifts stored a `system_expected_cash` short by the handover and a
 * `shortage` over by the same amount, so a cashier who was 0.50 short printed as
 * 17,199.50 over. The fix makes every FUTURE read correct; the columns frozen at
 * close still hold the old figures, and this rewrites them.
 *
 * WHAT IT DOES NOT TOUCH
 * ----------------------
 * `closingTreasuryBalance` and `treasuryVariance` are left exactly as they are.
 * They are bookkeeping snapshots that were already POSTED to the treasury at
 * approval, and the money really did move — rewriting them would describe a
 * posting that never happened. Only the two accountability columns change.
 *
 * The offset is recomputed here from the same inputs the route uses rather than
 * passed in, so a shift that does not actually carry the double-count is skipped
 * instead of silently rewritten.
 *
 *   node scripts/correct-handover-shortage.js 210 212           # dry run
 *   node scripts/correct-handover-shortage.js 210 212 --apply   # write
 */

require("dotenv").config();
const prisma = require("../config/database");
const { writeAudit } = require("../utils/auditLogger");
const { roundMoney } = require("../utils/money");

const APPLY = process.argv.includes("--apply");
const IDS = process.argv
  .slice(2)
  .filter((a) => /^\d+$/.test(a))
  .map(Number);

const money = (n) => Number(n ?? 0).toFixed(2).padStart(12);

/**
 * The handover that startCash already excludes, and how much of the window's
 * transfers-out it absorbs. Mirrors calculateSystemExpectedCash.
 */
async function handoverOffset(shift) {
  const treasuryId = shift.branch?.treasuryId;
  if (!treasuryId) return { handover: 0, transfersOut: 0, offset: 0 };

  const startCash = Number(shift.startCash) || 0;

  const posted = await prisma.withdrawal.aggregate({
    where: { shiftId: shift.id, source: "SHIFT_OPENING" },
    _sum: { amount: true },
  });

  let handover = Number(posted._sum.amount || 0);
  if (!handover) {
    const previous = await prisma.shift.findFirst({
      where: {
        branchId: shift.branchId,
        id: { not: shift.id },
        endTime: { lt: shift.startTime },
      },
      orderBy: { endTime: "desc" },
      select: { actualCash: true, endCash: true },
    });
    const counted = previous
      ? Number(previous.actualCash ?? previous.endCash ?? 0)
      : 0;
    handover = Math.max(0, roundMoney(counted - startCash));
  }

  const out = await prisma.cashTransfer.aggregate({
    where: {
      fromTreasuryId: treasuryId,
      status: { in: ["PENDING", "APPROVED"] },
      createdAt: { gte: shift.startTime, lte: shift.endTime || new Date() },
    },
    _sum: { amount: true },
  });
  const transfersOut = Number(out._sum.amount || 0);

  return { handover, transfersOut, offset: Math.min(transfersOut, handover) };
}

(async () => {
  if (!IDS.length) {
    console.error("usage: node scripts/correct-handover-shortage.js <shiftId...> [--apply]");
    process.exit(1);
  }

  console.log(APPLY ? "APPLYING corrections\n" : "DRY RUN — nothing will be written\n");

  for (const id of IDS) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { branch: { select: { name: true, treasuryId: true } } },
    });

    if (!shift) {
      console.log(`#${id}  not found — skipped`);
      continue;
    }
    if (shift.systemExpectedCash === null || shift.actualCash === null) {
      console.log(`#${id}  never closed — skipped`);
      continue;
    }

    const { handover, transfersOut, offset } = await handoverOffset(shift);
    if (offset <= 0) {
      console.log(`#${id}  no double-counted handover — skipped`);
      continue;
    }

    const oldExpected = Number(shift.systemExpectedCash);
    const oldShortage = Number(shift.shortage);
    const actual = Number(shift.actualCash);
    const newExpected = roundMoney(oldExpected + offset);
    const newShortage = roundMoney(actual - newExpected);

    console.log(`#${id}  ${shift.branch?.name}`);
    console.log(`   handover ${money(handover)}   transfersOut ${money(transfersOut)}   offset ${money(offset)}`);
    console.log(`   expected ${money(oldExpected)} -> ${money(newExpected)}`);
    console.log(`   shortage ${money(oldShortage)} -> ${money(newShortage)}`);

    if (!APPLY) {
      console.log("   (dry run)\n");
      continue;
    }

    await prisma.shift.update({
      where: { id },
      data: { systemExpectedCash: newExpected, shortage: newShortage },
    });

    // The corrected row on its own would look like the cashier was never blamed.
    // The audit entry is the only record that the printed 17,199.50 ever existed.
    await writeAudit({
      action: "UPDATE",
      targetEntity: "shift",
      targetId: id,
      userId: null,
      branchId: shift.branchId,
      oldValues: { systemExpectedCash: oldExpected, shortage: oldShortage },
      newValues: {
        systemExpectedCash: newExpected,
        shortage: newShortage,
        reason: "opening handover double-counted in transfersOut",
        openingHandover: handover,
        openingHandoverOffset: offset,
        script: "scripts/correct-handover-shortage.js",
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
