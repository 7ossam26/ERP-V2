/**
 * Gives back the cash that POST /shifts/start took out of the branch safes.
 *
 * While `lib/shiftTreasury.js` was wired in, every shift start posted
 * `declaredStartCash − treasury.balance` as a SHIFT_OPENING **withdrawal**. That
 * premise — "the branch treasury IS the drawer" — is false here: the treasury is
 * the branch SAFE (خزنة الفرع), and the drawer→safe handover is a move between
 * two containers of the same branch, not cash leaving the company. Eight of those
 * postings booked 112,250 EGP out of three branches over two days, arriving
 * nowhere: HQ never received a piastre of it.
 *
 * routes/shifts.js no longer makes the posting (see the NOT WIRED header on
 * lib/shiftTreasury.js). This puts back what the ones already made took.
 *
 * REVERSED WITH A DEPOSIT, NOT A DELETE
 * ------------------------------------
 * The withdrawal rows stay. They are the only record that the system did this,
 * and `calculateSystemExpectedCash` reads them (`openingHandover`) to cancel the
 * matching CashTransfer — delete them and that offset falls back to a
 * reconstruction, which is a guess where the row is exact. A compensating
 * deposit restores the balance and leaves both intact.
 *
 * WHY THE DEPOSIT CARRIES source=SHIFT_OPENING
 * --------------------------------------------
 * NOT cosmetic. The drawer formula folds in deposits whose source is MANUAL, by
 * treasury + shift time window. Three of these branches have a shift OPEN right
 * now, so a MANUAL reversal deposit would land inside its window and inflate that
 * cashier's expected drawer cash by up to 18,550 — a phantom shortage of exactly
 * the size of the bug we are undoing. SHIFT_OPENING is outside that aggregate
 * (`source: "MANUAL"`), and outside `openingHandover` too (that one reads the
 * WITHDRAWAL table). So it moves the balance and nothing else.
 *
 * It also makes the script idempotent for free: UNIQUE(shift_id, source, cycle)
 * on `deposits` means a second run raises P2002 instead of paying twice.
 *
 * WHAT IT DOES NOT TOUCH
 * ----------------------
 * SHIFT_VARIANCE rows, posted at approval. They are wrong in the same way, but
 * they net +7,014.49 IN FAVOUR of the branches, and one of them (D#261) happens
 * to paper over a genuine pre-existing hole — branch 4's first shift declared a
 * 1,365 float that was never booked. Reversing them re-opens that hole. They are
 * small, they are a separate decision, and this script leaves them alone.
 *
 *   node scripts/reverse-shift-opening-postings.js           # dry run
 *   node scripts/reverse-shift-opening-postings.js --apply   # write
 *   node scripts/reverse-shift-opening-postings.js --apply --actor 3
 */

require("dotenv").config();
const prisma = require("../config/database");
const { writeAudit } = require("../utils/auditLogger");
const { roundMoney } = require("../utils/money");

const APPLY = process.argv.includes("--apply");
const ACTOR_FLAG = process.argv.indexOf("--actor");
const ACTOR_ID =
  ACTOR_FLAG !== -1 ? parseInt(process.argv[ACTOR_FLAG + 1], 10) : null;

const SCRIPT_TAG = "scripts/reverse-shift-opening-postings.js";
const SOURCE = "SHIFT_OPENING";

const money = (n) => Number(n ?? 0).toFixed(2).padStart(13);

/**
 * Who to attribute the correction to. `created_by_id` is NOT nullable, and
 * pinning it on the cashier whose shift start triggered the bad posting would
 * read as though they made the correction. An admin is the honest choice.
 */
async function resolveActor() {
  if (ACTOR_ID) {
    const u = await prisma.user.findUnique({
      where: { id: ACTOR_ID },
      select: { id: true, name: true, role: { select: { name: true } } },
    });
    if (!u) throw new Error(`--actor ${ACTOR_ID}: no such user`);
    return { id: u.id, name: u.name, role: u.role?.name };
  }
  // `User.role` is a relation to a free-text Role.name, not an enum, so match
  // on the name rather than assuming a fixed set.
  const admin = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: { name: { contains: "admin" } },
    },
    orderBy: { id: "asc" },
    select: { id: true, name: true, role: { select: { name: true } } },
  });
  if (!admin) {
    const roles = await prisma.role.findMany({ select: { id: true, name: true } });
    throw new Error(
      `no admin user found — pass --actor <userId>. Roles: ${roles
        .map((r) => r.name)
        .join(", ")}`,
    );
  }
  return { id: admin.id, name: admin.name, role: admin.role?.name };
}

(async () => {
  const actor = await resolveActor();

  console.log(
    APPLY ? "APPLYING reversals\n" : "DRY RUN — nothing will be written\n",
  );
  console.log(`actor: #${actor.id} ${actor.name} (${actor.role})\n`);

  const withdrawals = await prisma.withdrawal.findMany({
    where: { source: SOURCE },
    select: {
      id: true,
      amount: true,
      shiftId: true,
      cycle: true,
      treasuryId: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });

  if (!withdrawals.length) {
    console.log("no SHIFT_OPENING withdrawals exist — nothing to reverse");
    await prisma.$disconnect();
    return;
  }

  // Every reversal already made, so a re-run reports "done" instead of throwing.
  const existing = await prisma.deposit.findMany({
    where: { source: SOURCE },
    select: { id: true, shiftId: true, cycle: true, amount: true },
  });
  const doneKey = new Set(existing.map((d) => `${d.shiftId}:${d.cycle}`));

  const treasuries = await prisma.treasury.findMany({
    select: {
      id: true,
      name: true,
      balance: true,
      branch: { select: { id: true, name: true } },
    },
  });
  const byId = new Map(treasuries.map((t) => [t.id, t]));
  const label = (tid) => byId.get(tid)?.branch?.name || byId.get(tid)?.name || `treasury#${tid}`;

  const perTreasury = new Map();
  let totalToReturn = 0;
  let skipped = 0;

  for (const w of withdrawals) {
    const key = `${w.shiftId}:${w.cycle}`;
    const amount = roundMoney(Number(w.amount));

    if (doneKey.has(key)) {
      console.log(
        `W#${String(w.id).padEnd(5)} ${label(w.treasuryId).padEnd(14)} shift ${String(w.shiftId).padEnd(5)} ${money(amount)}   already reversed — skipped`,
      );
      skipped++;
      continue;
    }

    console.log(
      `W#${String(w.id).padEnd(5)} ${label(w.treasuryId).padEnd(14)} shift ${String(w.shiftId).padEnd(5)} ${money(amount)}   -> deposit back`,
    );

    totalToReturn = roundMoney(totalToReturn + amount);
    perTreasury.set(
      w.treasuryId,
      roundMoney((perTreasury.get(w.treasuryId) || 0) + amount),
    );

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      await tx.deposit.create({
        data: {
          amount,
          description: `تصحيح: عكس سحب عهدة بداية وردية #${w.shiftId} — قيد آلي خاطئ، الفلوس لم تغادر الفرع`,
          date: new Date(),
          treasuryId: w.treasuryId,
          createdById: actor.id,
          source: SOURCE,
          shiftId: w.shiftId,
          cycle: w.cycle,
        },
      });
      await tx.treasury.update({
        where: { id: w.treasuryId },
        data: { balance: { increment: amount } },
      });
    });

    await writeAudit({
      action: "UPDATE",
      targetEntity: "treasury",
      targetId: w.treasuryId,
      userId: actor.id,
      branchId: byId.get(w.treasuryId)?.branch?.id ?? null,
      oldValues: { balance: Number(byId.get(w.treasuryId)?.balance ?? 0) },
      newValues: {
        creditedBack: amount,
        reason:
          "SHIFT_OPENING withdrawal reversed — the drawer→safe handover never left the branch",
        reversedWithdrawalId: w.id,
        shiftId: w.shiftId,
        script: SCRIPT_TAG,
      },
    });
  }

  console.log("\n=== PER BRANCH ===");
  for (const [tid, amount] of perTreasury) {
    const before = roundMoney(Number(byId.get(tid)?.balance ?? 0));
    // In --apply the row above already moved; `before` is the pre-run snapshot
    // read before any write, so this stays the true before/after either way.
    console.log(
      label(tid).padEnd(14),
      "before",
      money(before),
      "  +",
      money(amount),
      "  after",
      money(roundMoney(before + amount)),
    );
  }

  console.log(
    `\ntotal ${APPLY ? "returned" : "to return"}: ${money(totalToReturn)}` +
      (skipped ? `   (${skipped} already done)` : ""),
  );
  if (!APPLY) console.log("\n(dry run — re-run with --apply to write)");

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error("FAILED:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
