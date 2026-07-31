-- Allow a shift to be reopened AFTER approval, without losing the treasury
-- correction that approval posts.
--
-- WHY
-- ---
-- POST /shifts/approve posts a Deposit/Withdrawal (source=SHIFT_VARIANCE) and
-- moves treasury.balance. The previous UNIQUE(shift_id, source) allowed exactly
-- one such posting per shift for all time, which was correct while approval was
-- terminal. Now that a CLOSED shift can be reopened and approved again, that
-- index made the SECOND approval raise P2002 — the route translated it to a 409
-- "already approved" and the corrected variance never reached the treasury. Not
-- a double post: a silently MISSING one.
--
-- Widening the key to (shift_id, source, cycle) lets each approval cycle post
-- once, while still rejecting a replayed approve within the same cycle. Each
-- posting is a delta against the LIVE balance, so cycles supersede rather than
-- accumulate and no reversal is needed — see lib/shiftTreasury.js.
--
-- This is a NON-DESTRUCTIVE, ADD-ONLY migration. Every new column is NOT NULL
-- with a DEFAULT of 0, so existing rows backfill to cycle 0 / reopen_count 0.
-- The unique constraint is RELAXED, never tightened: any row set that satisfied
-- UNIQUE(shift_id, source) also satisfies UNIQUE(shift_id, source, cycle), so
-- the index rebuild cannot fail on existing data. No column is dropped,
-- renamed, retyped, or made nullable.

-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `reopen_count` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `deposits` ADD COLUMN `cycle` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `withdrawals` ADD COLUMN `cycle` INTEGER NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX `deposits_shift_id_source_key` ON `deposits`;

-- DropIndex
DROP INDEX `withdrawals_shift_id_source_key` ON `withdrawals`;

-- CreateIndex
CREATE UNIQUE INDEX `deposits_shift_id_source_cycle_key` ON `deposits`(`shift_id`, `source`, `cycle`);

-- CreateIndex
CREATE UNIQUE INDEX `withdrawals_shift_id_source_cycle_key` ON `withdrawals`(`shift_id`, `source`, `cycle`);
