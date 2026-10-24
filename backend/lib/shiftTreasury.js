/**
 * shiftTreasury.js — posting rules for the two shift↔treasury boundaries.
 *
 * postShiftVariance is WIRED (POST /shifts/approve). postShiftOpening is NOT.
 *
 * THE ACCOUNT
 * -----------
 * A branch holds cash in TWO places but has ONE account:
 *
 *     الدرج (drawer)  ──at handover──►  خزنة الفرع (branch safe)  ──►  الإدارة
 *
 * `Branch.treasuryId` is @unique, so the branch treasury is drawer + safe
 * combined: cash sales credit it while the money is still in the register,
 * expenses/advances/dues debit it as they are paid, transfers move it.
 *
 * VARIANCE (wired)
 * ----------------
 * Every movement calculateSystemExpectedCash counts was already posted to the
 * account as it happened, so at close the books believe the drawer holds
 * `systemExpectedCash`. The count says `actualCash`. The account is wrong by
 * exactly `shortage = actual − expected`, and that is the only delta posted:
 * a shortage books a Withdrawal, an overage a Deposit. It never touches the safe
 * part of the balance.
 *
 * The delta used to be `actual − treasury.balance` — "force the account onto
 * the drawer count" — which treated the whole account as the drawer and erased
 * every pound of earlier takings sitting in the safe. That is why posting was
 * switched off on 31/07/2026; shifts closed in between posted nothing.
 *
 * OPENING (not wired)
 * -------------------
 * postShiftOpening reconciles the account to the declared float. A float
 * declared below the previous count is the ordinary drawer → safe handover,
 * which does not change a drawer + safe account at all; posting it booked
 * 112,250 EGP out of three branches over two days, arriving nowhere. Leave it
 * unwired unless a branch gets a DRAWER account of its own; then the opening
 * delta becomes a transfer drawer ↔ safe between two real accounts.
 *
 * IDEMPOTENCY, AND WHY THERE IS A CYCLE
 * -------------------------------------
 * Every row carries (shiftId, source, cycle) under a UNIQUE index, so a replayed
 * approve raises P2002 instead of posting twice. Callers translate that to a
 * 409. Manual deposits/withdrawals are never shift-stamped, so the index does
 * not constrain them — see the CashMovementSource comment in schema.prisma.
 *
 * `cycle` is the shift's `reopenCount` at posting time. A shift can be reopened
 * after approval, so approval is not once-per-shift; per-cycle keying lets each
 * approval post once and still rejects a replay within one cycle.
 *
 * Successive cycles SUPERSEDE, they do not accumulate, and nothing is reversed
 * on reopen: POST /end stores `shortage − already posted by earlier cycles`, so
 *
 *     approve1: posts S1          net S1
 *     approve2: posts S2 − S1     net S2
 *
 * The drawer formula excludes every SHIFT_* row (it reads source=MANUAL only),
 * so a posting can never feed back into the next expected figure.
 */

const { roundMoney } = require("../utils/money");

// Below this, a delta is drawer dust, not a cash movement. Matches the 0.005
// tolerance used by scripts/reconcile-bulk-payments.js, rounded to piastres.
const POSTING_EPSILON = 0.01;

const SOURCE_SHIFT_OPENING = "SHIFT_OPENING";
const SOURCE_SHIFT_VARIANCE = "SHIFT_VARIANCE";

function insufficientBalanceError(kind) {
  const err = new Error(`Insufficient treasury balance for ${kind}`);
  err.status = 400;
  err.error = "INSUFFICIENT_TREASURY_BALANCE";
  err.message = "رصيد الخزينة غير كافي لتسجيل هذه الحركة";
  return err;
}

/**
 * Apply a signed delta to a treasury and record the matching audit row.
 *
 * Debits use the conditional compare-and-set pattern from routes/employees.js
 * (`updateMany` + `balance: { gte }`) rather than a plain decrement. Prisma's
 * findUnique takes no lock, so a read-then-write check lets two concurrent
 * requests both pass and drive the balance negative. This is the only
 * TOCTOU-safe debit shape in the codebase.
 *
 * @returns {null | { type: "DEPOSIT"|"WITHDRAWAL", amount: number, id: number }}
 *          null when the delta rounds to nothing.
 */
async function applyDelta(tx, { treasuryId, shiftId, source, cycle, delta, actorId, description }) {
  const signed = roundMoney(delta);

  if (Math.abs(signed) < POSTING_EPSILON) return null;

  if (signed > 0) {
    const deposit = await tx.deposit.create({
      data: {
        amount: signed,
        description,
        date: new Date(),
        treasuryId,
        createdById: actorId,
        source,
        shiftId,
        cycle,
      },
    });
    await tx.treasury.update({
      where: { id: treasuryId },
      data: { balance: { increment: signed } },
    });
    return { type: "DEPOSIT", amount: signed, id: deposit.id };
  }

  const amount = roundMoney(-signed);

  // Create the audit row BEFORE moving the balance, matching the deposit branch.
  // The row carries the UNIQUE(shift_id, source, cycle) guard, so on a replay the
  // index rejects it while the balance is still untouched. Debiting first would
  // move the money and lean on transaction rollback to undo it — correct in
  // practice, but it makes idempotency a property of the caller rather than of
  // this code.
  const withdrawal = await tx.withdrawal.create({
    data: {
      amount,
      description,
      date: new Date(),
      treasuryId,
      createdById: actorId,
      source,
      shiftId,
      cycle,
    },
  });

  const debit = await tx.treasury.updateMany({
    where: { id: treasuryId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (debit.count === 0) throw insufficientBalanceError(source);

  return { type: "WITHDRAWAL", amount, id: withdrawal.id };
}

/**
 * Reconcile the branch treasury to the cash the cashier declares in the drawer
 * at shift start.
 *
 * `declaredStartCash` equal to the current balance (the default the POS
 * prefills) posts nothing — that is the ordinary carry-forward from the previous
 * shift, and the money is already in the treasury.
 *
 * A positive delta is cash brought into the drawer from outside the system; a
 * negative delta is cash removed from it. Either way the treasury ends up
 * agreeing with the physical count, which is also how a legacy branch whose
 * float was never booked self-corrects on its first real count.
 *
 * Always cycle 0: the opening float is posted once, by POST /shifts/start, and
 * reopening never re-posts it. A reopen preserves `startCash` and moves no cash
 * — the float is already in the drawer — so there is nothing to reconcile.
 */
async function postShiftOpening(tx, { shift, treasuryId, declaredStartCash, currentBalance, actorId }) {
  return applyDelta(tx, {
    treasuryId,
    shiftId: shift.id,
    source: SOURCE_SHIFT_OPENING,
    cycle: 0,
    delta: roundMoney(declaredStartCash) - roundMoney(currentBalance),
    actorId,
    description: `عهدة بداية وردية #${shift.id}`,
  });
}

/**
 * Post the treasury correction captured at blind close.
 *
 * `delta` is the shift's stored `treasuryVariance` = shortage (actualCash −
 * systemExpectedCash) minus whatever earlier approval cycles already posted.
 * Applying the stored delta rather than recomputing at approval means a deposit
 * or expense recorded during the PENDING_REVIEW window is simply kept on top of
 * the correction.
 *
 * Called from POST /shifts/approve, never from POST /shifts/end. `cycle` must be
 * the shift's `reopenCount` as read inside the approving transaction.
 */
async function postShiftVariance(tx, { shift, treasuryId, cycle, delta, actorId }) {
  return applyDelta(tx, {
    treasuryId,
    shiftId: shift.id,
    source: SOURCE_SHIFT_VARIANCE,
    cycle,
    delta,
    actorId,
    description: `تسوية إغلاق وردية #${shift.id}`,
  });
}

module.exports = {
  postShiftOpening,
  postShiftVariance,
  POSTING_EPSILON,
  SOURCE_SHIFT_OPENING,
  SOURCE_SHIFT_VARIANCE,
};
