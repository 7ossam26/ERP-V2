/**
 * branchCash.js — split a branch treasury's ONE balance into the two physical
 * containers it actually covers.
 *
 *     الدرج (drawer)  ──at handover──►  خزنة الفرع (branch safe)
 *
 * `Branch.treasuryId` is @unique, so a branch has exactly one account and it
 * holds drawer + safe combined (cash sales credit it while the money is still in
 * the register). The drawer half is derivable — it is the figure a shift close
 * is measured against — and the safe is whatever the balance holds beyond it.
 *
 *   OPEN shift            drawer = calculateSystemExpectedCash(shift).expected
 *                         safe   = balance − drawer
 *   PENDING_REVIEW shift  drawer = the blind count (actualCash)
 *                         safe   = balance − systemExpectedCash (frozen at close)
 *                         The two differ from the balance by `pendingVariance`
 *                         (= shortage) until approval posts it.
 *   no live shift         split unknown: the register still holds a float for
 *                         the next shift and no count says how much. Both null;
 *                         the next shift's declared float is the next count.
 *
 * Shared by routes/branches.js (balances page) and routes/treasuries.js (the
 * transfer screen's per-container limits), so the two can never disagree.
 */

const { roundMoney } = require("../utils/money");

const LIVE_SHIFT_STATUSES = ["OPEN", "PENDING_REVIEW"];

/**
 * Pure split, given a balance, the branch's live shift (or null) and — for an
 * OPEN shift — its live expected drawer.
 */
function splitBranchCash({ balance, shift, liveExpected }) {
  const total = roundMoney(balance);
  if (!shift) {
    return { balance: total, drawerCash: null, safeCash: null, pendingVariance: null };
  }
  if (shift.status === "PENDING_REVIEW") {
    const counted = shift.actualCash != null ? roundMoney(shift.actualCash) : null;
    const expectedAtClose =
      shift.systemExpectedCash != null ? roundMoney(shift.systemExpectedCash) : null;
    return {
      balance: total,
      drawerCash: counted,
      safeCash: expectedAtClose != null ? roundMoney(total - expectedAtClose) : null,
      pendingVariance: shift.shortage != null ? roundMoney(shift.shortage) : null,
    };
  }
  if (liveExpected == null) {
    return { balance: total, drawerCash: null, safeCash: null, pendingVariance: null };
  }
  const drawer = roundMoney(liveExpected);
  return {
    balance: total,
    drawerCash: drawer,
    safeCash: roundMoney(total - drawer),
    pendingVariance: null,
  };
}

/**
 * The live split for one treasury. Non-branch treasuries (MAIN / VISA /
 * INSTAPAY) have no drawer: `branchId` and `shift` come back null.
 *
 * `db` may be a transaction client; the drawer figure itself is always read
 * through calculateSystemExpectedCash's own client, which is fine because it is
 * called before the caller writes anything.
 */
async function getTreasuryCashSplit(treasuryId, db) {
  const treasury = await db.treasury.findUnique({
    where: { id: treasuryId },
    select: {
      id: true,
      name: true,
      balance: true,
      scope: true,
      branch: { select: { id: true, name: true } },
    },
  });
  if (!treasury) return null;

  const base = {
    treasuryId: treasury.id,
    treasuryName: treasury.name,
    scope: treasury.scope,
    branchId: treasury.branch?.id ?? null,
    branchName: treasury.branch?.name ?? null,
  };

  if (!treasury.branch) {
    return {
      ...base,
      shift: null,
      ...splitBranchCash({ balance: treasury.balance, shift: null }),
    };
  }

  const shift = await db.shift.findFirst({
    where: { branchId: treasury.branch.id, status: { in: LIVE_SHIFT_STATUSES } },
    orderBy: { startTime: "desc" },
    select: {
      id: true,
      status: true,
      userId: true,
      startTime: true,
      actualCash: true,
      systemExpectedCash: true,
      shortage: true,
      user: { select: { name: true } },
    },
  });

  let liveExpected = null;
  if (shift?.status === "OPEN") {
    // Lazy require: routes/shifts.js is a router module that itself requires
    // half the app; loading it at the top would make this lib order-sensitive.
    const { calculateSystemExpectedCash } = require("../routes/shifts");
    ({ expected: liveExpected } = await calculateSystemExpectedCash(shift.id));
  }

  return {
    ...base,
    shift: shift
      ? {
          id: shift.id,
          status: shift.status,
          userId: shift.userId,
          userName: shift.user?.name ?? null,
          startTime: shift.startTime,
        }
      : null,
    ...splitBranchCash({ balance: treasury.balance, shift, liveExpected }),
  };
}

module.exports = { splitBranchCash, getTreasuryCashSplit, LIVE_SHIFT_STATUSES };
