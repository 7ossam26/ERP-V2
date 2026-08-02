/**
 * shiftTreasury.js — posting rules for the two shift↔treasury boundaries.
 *
 * ⚠️ NOT WIRED. routes/shifts.js no longer calls either function. Read this
 * before reconnecting them.
 *
 * The module is built on one premise — "a branch's Treasury.balance IS the
 * drawer" — and that premise is false for this business. A branch holds cash in
 * TWO places:
 *
 *     الدرج (drawer)  ──at handover──►  خزنة الفرع (branch safe)  ──►  الإدارة
 *
 * `Branch.treasuryId` is @unique, so only one of the two has an account, and it
 * is the SAFE: expenses, purchases, supplier payments and manager transfers all
 * post against it, and it accumulates takings across shifts.
 *
 * Treating it as the drawer made both postings wrong in the same direction:
 *
 *   postShiftOpening  — a float declared below the safe balance is the ordinary
 *                       handover, not cash leaving the company. Posting the
 *                       difference as a withdrawal booked 112,250 EGP out of
 *                       three branches over two days, arriving nowhere.
 *   postShiftVariance — forcing the safe onto a drawer count erases every pound
 *                       of earlier takings held in it.
 *
 * Reconnect only once a branch has a DRAWER account of its own; then the opening
 * delta becomes a transfer drawer ↔ safe (both real accounts) and the variance
 * reconciles the drawer, which the count actually measures.
 *
 * The invariant below is stated against whatever account the shift lifecycle
 * owns — true of a drawer account, never true of the safe:
 *
 *     treasury.balance === calculateSystemExpectedCash(shift).expected
 *
 * Cash sales credit the treasury at sale time (routes/sales.js), expenses debit
 * it at creation (routes/expenses.js), advances at payout (routes/employees.js).
 * Those postings already exist and are NOT repeated here. The only two facts the
 * treasury never learned about were the opening float and the counted variance —
 * that is all this module posts.
 *
 * WHY DELTAS, NOT AMOUNTS
 * -----------------------
 * Both postings are computed as `counted − live treasury balance`, never as an
 * absolute amount:
 *
 *     open:  delta = declaredStartCash − treasury.balance
 *     close: delta = countedActualCash  − treasury.balance
 *
 * Because each reconciles *to* a counted figure instead of accumulating a new
 * one, double-counting is structurally impossible. In the normal carry-forward
 * case (cashier accepts the prefilled figure) the delta is exactly 0 and nothing
 * is written at all — no row, no balance change.
 *
 * It also means a gap in calculateSystemExpectedCash can only mis-report
 * `shortage`; it can never corrupt the treasury. That is deliberate: the drawer
 * formula still misses some movements (cash transfers, payroll, supplier
 * payments), and this module must be safe in spite of that.
 *
 * IDEMPOTENCY, AND WHY THERE IS A CYCLE
 * -------------------------------------
 * Every row carries (shiftId, source, cycle) under a UNIQUE index, so a replayed
 * start or approve raises P2002 instead of posting twice. Callers translate that
 * to a 409. Manual deposits/withdrawals are never shift-stamped, so the index
 * does not constrain them — see the CashMovementSource comment in schema.prisma.
 *
 * `cycle` is the shift's `reopenCount` at posting time. A shift can be reopened
 * after approval, so approval is no longer once-per-shift: keying on
 * (shiftId, source) alone made the SECOND approval raise P2002, which the route
 * reported as "already approved" while the corrected variance silently never
 * reached the treasury. Per-cycle keying lets each approval post once and still
 * rejects a replay within one cycle.
 *
 * Successive cycles SUPERSEDE, they do not accumulate, and nothing is reversed
 * on reopen. Because each posting reconciles to a counted figure against the
 * live balance, approval #2's delta already absorbs approval #1's:
 *
 *     approve1: balance = B1 + (A1 − B1)          = A1
 *     reopen  : balance = A1        (untouched — the drawer really holds A1)
 *     approve2: balance = A1 + … + (A2 − …)       = A2
 *
 * Reversing posting #1 on reopen would be actively WRONG: it would set the books
 * back to B1 while the drawer physically holds A1, breaking the invariant above
 * for the whole reopened window.
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
 * `delta` is the shift's stored `treasuryVariance` (= actualCash − treasury
 * balance at the moment of counting), NOT `shortage`. Applying the stored delta
 * rather than recomputing against the live balance is what lets a deposit or
 * expense recorded during the PENDING_REVIEW window survive approval: the
 * intervening movement is preserved on top of the correction, whereas setting an
 * absolute balance would silently erase it.
 *
 * Called from POST /shifts/approve, never from POST /shifts/end. `cycle` must be
 * the shift's `reopenCount` as read inside the approving transaction. A shift
 * reopened after approval comes back for approval again, and each pass posts its
 * own correction; nothing posted on an earlier pass is reversed or amended — see
 * the IDEMPOTENCY note at the top of this file for why that is exactly right.
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
