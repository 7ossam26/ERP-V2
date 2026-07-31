/**
 * Shift ↔ branch-treasury postings — lib/shiftTreasury.js.
 *
 * The branch treasury IS the drawer (Branch.treasuryId is @unique; there is no
 * separate safe). Cash sales, expenses and advances already post to it as they
 * happen. The only two facts it never learned were the opening float and the
 * counted variance, and these are the rules that post them.
 *
 * The property every test here defends is that BOTH postings are deltas against
 * the live balance — `counted − treasury.balance` — never absolute amounts:
 *
 *   1. NO DOUBLE COUNTING. Accepting the carried-forward figure yields a delta of
 *      exactly zero, so no row is written and no balance moves. This is the
 *      ordinary case and it must stay free.
 *   2. NO REPLAY. UNIQUE(shift_id, source, cycle) means a retried start or
 *      approve raises P2002 rather than moving the money twice.
 *   3. NO SILENT ERASURE. A deposit recorded during the PENDING_REVIEW window
 *      survives approval, because approval applies the delta captured at close
 *      rather than setting an absolute balance from a stale count.
 *   4. NO NEGATIVE DRAWER. Debits use compare-and-set, so a debit that would
 *      overdraw fails instead of racing another request to a negative balance.
 *   5. CYCLES SUPERSEDE. A shift reopened after approval is approved again, and
 *      each approval posts under its own `cycle`. Successive deltas reconcile to
 *      the latest count against the live balance, so nothing has to be reversed
 *      and nothing accumulates.
 */

const {
  postShiftOpening,
  postShiftVariance,
  POSTING_EPSILON,
} = require("../../lib/shiftTreasury");

const TREASURY_ID = 7;
const SHIFT = { id: 42 };
const ACTOR_ID = 3;

// ---------------------------------------------------------------------------
// A stateful stand-in for the slice of the Prisma client these functions touch.
// Rows are really written and the balance really moves, so a test can assert on
// the resulting state rather than on mock arguments. The unique index is
// enforced here too — it is the load-bearing guard, so a fake that ignored it
// would make the replay tests meaningless.
// ---------------------------------------------------------------------------
function makeTx(initialBalance) {
  const state = {
    balance: initialBalance,
    deposits: [],
    withdrawals: [],
    nextId: 1,
  };

  const enforceUnique = (rows, shiftId, source, cycle) => {
    // MySQL treats NULLs as distinct, so only shift-stamped rows collide.
    if (shiftId == null) return;
    // Keyed on cycle too: a shift reopened after approval posts again under the
    // next cycle, and that must NOT collide with the previous cycle's row.
    if (
      rows.some(
        (r) =>
          r.shiftId === shiftId && r.source === source && r.cycle === cycle,
      )
    ) {
      const err = new Error(
        "Unique constraint failed on the fields: (`shift_id`,`source`,`cycle`)",
      );
      err.code = "P2002";
      throw err;
    }
  };

  const tx = {
    _state: state,
    deposit: {
      create: jest.fn(async ({ data }) => {
        enforceUnique(state.deposits, data.shiftId, data.source, data.cycle);
        const row = { id: state.nextId++, ...data };
        state.deposits.push(row);
        return row;
      }),
    },
    withdrawal: {
      create: jest.fn(async ({ data }) => {
        enforceUnique(state.withdrawals, data.shiftId, data.source, data.cycle);
        const row = { id: state.nextId++, ...data };
        state.withdrawals.push(row);
        return row;
      }),
    },
    treasury: {
      update: jest.fn(async ({ data }) => {
        if (data.balance?.increment !== undefined) {
          state.balance += data.balance.increment;
        }
        if (data.balance?.decrement !== undefined) {
          state.balance -= data.balance.decrement;
        }
        return { id: TREASURY_ID, balance: state.balance };
      }),
      // Mirrors the compare-and-set debit: updates 0 rows when the guard fails.
      updateMany: jest.fn(async ({ where, data }) => {
        const floor = where.balance?.gte;
        if (floor !== undefined && state.balance < floor) return { count: 0 };
        if (data.balance?.decrement !== undefined) {
          state.balance -= data.balance.decrement;
        }
        return { count: 1 };
      }),
    },
  };

  return tx;
}

const openWith = (tx, declared, balance) =>
  postShiftOpening(tx, {
    shift: SHIFT,
    treasuryId: TREASURY_ID,
    declaredStartCash: declared,
    currentBalance: balance,
    actorId: ACTOR_ID,
  });

const closeWith = (tx, delta, cycle = 0) =>
  postShiftVariance(tx, {
    shift: SHIFT,
    treasuryId: TREASURY_ID,
    cycle,
    delta,
    actorId: ACTOR_ID,
  });

describe("opening cash", () => {
  test("accepting the carried-forward balance posts nothing at all", async () => {
    // THE case that must stay free. The cashier opens on the previous shift's
    // counted cash, which the treasury already holds — booking it again would be
    // the double-count this whole design exists to prevent.
    const tx = makeTx(1500);

    const result = await openWith(tx, 1500, 1500);

    expect(result).toBeNull();
    expect(tx.deposit.create).not.toHaveBeenCalled();
    expect(tx.withdrawal.create).not.toHaveBeenCalled();
    expect(tx.treasury.update).not.toHaveBeenCalled();
    expect(tx.treasury.updateMany).not.toHaveBeenCalled();
    expect(tx._state.balance).toBe(1500);
  });

  test("counting MORE than the books posts a deposit for the difference only", async () => {
    const tx = makeTx(1500);

    const result = await openWith(tx, 1700, 1500);

    expect(result).toMatchObject({ type: "DEPOSIT", amount: 200 });
    expect(tx._state.balance).toBe(1700);
    expect(tx._state.deposits).toHaveLength(1);
    // Not 1700 — only the injection is new money.
    expect(tx._state.deposits[0]).toMatchObject({
      amount: 200,
      source: "SHIFT_OPENING",
      shiftId: SHIFT.id,
      treasuryId: TREASURY_ID,
    });
  });

  test("counting LESS than the books posts a withdrawal for the difference only", async () => {
    const tx = makeTx(1500);

    const result = await openWith(tx, 1200, 1500);

    expect(result).toMatchObject({ type: "WITHDRAWAL", amount: 300 });
    expect(tx._state.balance).toBe(1200);
    expect(tx._state.withdrawals[0]).toMatchObject({
      amount: 300,
      source: "SHIFT_OPENING",
      shiftId: SHIFT.id,
    });
  });

  test("a legacy treasury missing its float self-corrects on the first real count", async () => {
    // Before this feature the opening float lived only in shifts.start_cash and
    // never reached the treasury. The first genuine count after the change books
    // the whole gap as one auditable deposit — no backfill script needed.
    const tx = makeTx(0);

    await openWith(tx, 500, 0);

    expect(tx._state.balance).toBe(500);
    expect(tx._state.deposits[0].amount).toBe(500);
  });

  test("drift below half a piastre is not a cash movement", async () => {
    // Rounding to storable precision happens BEFORE the epsilon check, so a
    // 0.005 delta legitimately becomes a 1-piastre posting. Only what rounds to
    // nothing is skipped.
    const tx = makeTx(1500);

    const result = await openWith(tx, 1500.004, 1500);

    expect(result).toBeNull();
    expect(tx._state.deposits).toHaveLength(0);
    expect(tx._state.withdrawals).toHaveLength(0);
    expect(POSTING_EPSILON).toBe(0.01);
  });

  test("a debit that would overdraw the treasury is refused", async () => {
    const tx = makeTx(100);

    await expect(openWith(tx, 0, 500)).rejects.toMatchObject({
      status: 400,
      error: "INSUFFICIENT_TREASURY_BALANCE",
    });

    // The money never moved. The audit row written just before the failed debit
    // is rolled back by the enclosing $transaction in POST /shifts/start — which
    // also discards the shift itself, rather than leaving one open on a
    // treasury it just overdrew.
    expect(tx._state.balance).toBe(100);
  });

  test("a replayed start cannot post the opening twice", async () => {
    const tx = makeTx(1500);

    await openWith(tx, 1700, 1500);
    // Second attempt sees the balance already corrected, so the real handler
    // would compute a zero delta. Force the same delta to prove the index — not
    // just the arithmetic — is what stops a double post.
    await expect(openWith(tx, 1700, 1500)).rejects.toMatchObject({
      code: "P2002",
    });

    expect(tx._state.deposits).toHaveLength(1);
  });
});

describe("closing variance", () => {
  test("a drawer that matches the books posts nothing", async () => {
    const tx = makeTx(2200);

    expect(await closeWith(tx, 0)).toBeNull();
    expect(tx._state.balance).toBe(2200);
    expect(tx._state.deposits).toHaveLength(0);
    expect(tx._state.withdrawals).toHaveLength(0);
  });

  test("a shortage withdraws, leaving the treasury on the counted cash", async () => {
    const tx = makeTx(2200);

    const result = await closeWith(tx, -20);

    expect(result).toMatchObject({ type: "WITHDRAWAL", amount: 20 });
    expect(tx._state.balance).toBe(2180);
    expect(tx._state.withdrawals[0]).toMatchObject({
      source: "SHIFT_VARIANCE",
      shiftId: SHIFT.id,
    });
  });

  test("an overage deposits, leaving the treasury on the counted cash", async () => {
    const tx = makeTx(2200);

    const result = await closeWith(tx, 35);

    expect(result).toMatchObject({ type: "DEPOSIT", amount: 35 });
    expect(tx._state.balance).toBe(2235);
    expect(tx._state.deposits[0].source).toBe("SHIFT_VARIANCE");
  });

  test("a replayed approve cannot post the variance twice within a cycle", async () => {
    const tx = makeTx(2200);

    await closeWith(tx, -20, 0);
    await expect(closeWith(tx, -20, 0)).rejects.toMatchObject({
      code: "P2002",
    });

    // The money moved exactly once; the caller turns P2002 into a 409.
    expect(tx._state.balance).toBe(2180);
    expect(tx._state.withdrawals).toHaveLength(1);
  });

  test("a later cycle may post again — the reopen case", async () => {
    // Approval is no longer once-per-shift: a CLOSED shift can be reopened and
    // approved again. Keyed on (shiftId, source) alone this second posting
    // raised P2002 and the corrected variance silently never reached the
    // treasury. The cycle is what makes it land.
    const tx = makeTx(2200);

    await closeWith(tx, -20, 0); // approval #1: balance → 2180
    tx._state.balance += 150; // cashier sells 150 more after the reopen
    const second = await closeWith(tx, 10, 1); // approval #2

    expect(second).toMatchObject({ type: "DEPOSIT", amount: 10 });
    expect(tx._state.balance).toBe(2340);
    expect(tx._state.withdrawals).toHaveLength(1); // cycle 0, untouched
    expect(tx._state.deposits).toHaveLength(1); // cycle 1
    expect(tx._state.deposits[0].cycle).toBe(1);
  });

  test("cycles supersede rather than accumulate", async () => {
    // Each posting reconciles the treasury TO the latest count, so the net moved
    // across N cycles is (final count − opening balance) — never the sum of the
    // individual variances, and never a reversal of an earlier one.
    const tx = makeTx(1000);

    // Cycle 0: books 1000, counted 980.
    await closeWith(tx, 980 - 1000, 0);
    expect(tx._state.balance).toBe(980);

    // Reopen (nothing posted, nothing reversed), sell 200 → books 1180.
    tx._state.balance += 200;

    // Cycle 1: counted 1175.
    await closeWith(tx, 1175 - 1180, 1);
    expect(tx._state.balance).toBe(1175);

    // Reopen again, sell 25 → books 1200.
    tx._state.balance += 25;

    // Cycle 2: counted 1200, drawer agrees, nothing to post.
    expect(await closeWith(tx, 0, 2)).toBeNull();
    expect(tx._state.balance).toBe(1200);

    // Three cycles, two rows, and the treasury sits on the final count.
    expect(
      tx._state.deposits.length + tx._state.withdrawals.length,
    ).toBe(2);
  });

  test("an earlier cycle's row is never rewritten or reversed", async () => {
    const tx = makeTx(500);

    await closeWith(tx, -40, 0);
    const firstRow = { ...tx._state.withdrawals[0] };

    await closeWith(tx, -15, 1);

    // The cycle-0 row still says exactly what it said when it was posted.
    expect(tx._state.withdrawals[0]).toEqual(firstRow);
    expect(tx._state.withdrawals[0].cycle).toBe(0);
    expect(tx._state.withdrawals[1].cycle).toBe(1);
  });

  test("a movement during PENDING_REVIEW survives approval", async () => {
    // Why approval applies the delta captured at close instead of setting an
    // absolute balance: a manager recording a deposit between /end and /approve
    // would otherwise have it silently erased.
    const tx = makeTx(2200);
    const varianceAtClose = -20; // counted 2180 against books of 2200

    tx._state.balance += 500; // manager deposits 500 while awaiting review

    await closeWith(tx, varianceAtClose);

    // 2180 (counted) + 500 (intervening), not 2180.
    expect(tx._state.balance).toBe(2680);
  });

  test("opening and variance rows coexist for one shift", async () => {
    // Different sources, so the unique index permits both — one of each.
    const tx = makeTx(1500);

    await openWith(tx, 1700, 1500);
    await closeWith(tx, -20);

    expect(tx._state.deposits).toHaveLength(1);
    expect(tx._state.withdrawals).toHaveLength(1);
    expect(tx._state.balance).toBe(1680);
  });

  test("the opening float is always cycle 0 and is never re-posted", async () => {
    // Reopening preserves startCash and moves no cash — the float is already in
    // the drawer — so only the variance advances a cycle.
    const tx = makeTx(1500);

    await openWith(tx, 1700, 1500);

    expect(tx._state.deposits[0]).toMatchObject({
      source: "SHIFT_OPENING",
      cycle: 0,
    });
  });
});

describe("rounding", () => {
  test("deltas are stored in whole piastres", async () => {
    const tx = makeTx(0);

    // 0.1 + 0.2 style drift must not reach a DECIMAL(10,2) column.
    await openWith(tx, 100.005, 0.1 + 0.2);

    expect(tx._state.deposits[0].amount).toBe(99.71);
    expect(Number.isInteger(Math.round(tx._state.balance * 100))).toBe(true);
  });
});
