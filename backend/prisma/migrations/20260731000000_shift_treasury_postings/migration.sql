-- Reconcile shift opening/closing cash against the branch treasury.
--
-- Adds:
--   1. `source` + `shift_id` to deposits/withdrawals, so the drawer formula can
--      tell a manual cash movement from one the system generated for itself
--      (driver settlements already reach expected cash via the sale's
--      codDelivered term — counting their Deposit row too would double it).
--   2. A UNIQUE(shift_id, source) index on each, so a replayed /shifts/start or
--      /shifts/approve can never post the same money twice.
--   3. `closing_treasury_balance` + `treasury_variance` on shifts, the snapshot
--      captured at blind close and consumed at manager approval.
--
-- This is a NON-DESTRUCTIVE, ADD-ONLY migration: every new column is NULLABLE or
-- carries a DEFAULT, and both foreign keys are ON DELETE SET NULL. No existing
-- column is dropped, renamed, retyped, or made NOT NULL, so all existing
-- deposits, withdrawals and shifts rows are left fully intact.

-- AlterTable
ALTER TABLE `deposits` ADD COLUMN `source` ENUM('MANUAL', 'DRIVER_SETTLEMENT', 'DRIVER_DUES', 'SHIFT_OPENING', 'SHIFT_VARIANCE') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `shift_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `withdrawals` ADD COLUMN `source` ENUM('MANUAL', 'DRIVER_SETTLEMENT', 'DRIVER_DUES', 'SHIFT_OPENING', 'SHIFT_VARIANCE') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `shift_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `closing_treasury_balance` DECIMAL(10, 2) NULL,
    ADD COLUMN `treasury_variance` DECIMAL(10, 2) NULL;

-- Backfill: historical auto-generated rows predate the discriminator, so match
-- the fixed prefixes the delivery controller has always written. Anything else
-- keeps the MANUAL default, which is the correct reading for legacy data — the
-- only two automated writers of these tables were driver settlement and driver
-- dues payout.
UPDATE `deposits` SET `source` = 'DRIVER_SETTLEMENT' WHERE `description` LIKE 'تسوية دليفري%';
UPDATE `withdrawals` SET `source` = 'DRIVER_DUES' WHERE `description` LIKE 'صرف مستحق طيار%';

-- CreateIndex
CREATE UNIQUE INDEX `deposits_shift_id_source_key` ON `deposits`(`shift_id`, `source`);

-- CreateIndex
CREATE UNIQUE INDEX `withdrawals_shift_id_source_key` ON `withdrawals`(`shift_id`, `source`);

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
