-- CreateTable: stock_writeoffs (إهلاك) — stock that left a warehouse without
-- being sold: consumed internally, damaged, expired, or lost to a count
-- variance.
--
-- WHY THIS TABLE EXISTS
-- Consumables (tissues, bags) are bought but never sold, so no sale_items or
-- bulk_order_items row ever carries their cost — and expenses of type PURCHASE
-- are excluded from operating expenses by design in routes/reports.js, because
-- a purchase's cost is meant to be recognised as COGS when the stock sells.
-- For a consumable that never happens, so its cost was recognised NOWHERE and
-- net profit was overstated by it forever. This table is where it is recognised.
--
-- WHY IT IS NOT AN `expenses` ROW
-- No cash moves when stock is written off. An expenses row would also land in
-- operatingExpenses (routes/reports.js filters `type != 'PURCHASE'`, a
-- deny-list) while being excluded from the branch page (routes/branches.js
-- admits only `type = 'MANUAL'`, an allow-list) — so the two screens would
-- silently disagree by exactly the write-off amount. It would additionally
-- invent a cashier shortage in routes/shifts.js, which sums every CASH expense
-- on a branch treasury inside the shift window.
--
-- ADDITIVE ONLY. Creates one new table; alters nothing and drops nothing. There
-- is no historical write-off data and no ledger to reconstruct one from, so
-- there is deliberately no backfill: past periods are left exactly as they are.
--
-- `quantity` is SIGNED. A reversal is a contra row carrying a negative quantity
-- and dated the day it happened — the same shape as a REFUND- sale row — so the
-- report's COGS term unwinds on its own and a reversal never rewrites the closed
-- month the original landed in. `reverses_id` is UNIQUE so a write-off can be
-- reversed at most once, enforced by the database rather than by an application
-- check that races.
CREATE TABLE `stock_writeoffs` (
    `id`           INTEGER        NOT NULL AUTO_INCREMENT,
    `item_id`      INTEGER        NOT NULL,
    `warehouse_id` INTEGER        NOT NULL,
    `quantity`     DECIMAL(18, 6) NOT NULL,
    `unit_cost`    DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `reason`       ENUM('INTERNAL_USE','DAMAGED','EXPIRED','COUNT_VARIANCE','OTHER') NOT NULL DEFAULT 'OTHER',
    `date`         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes`        TEXT           NULL,
    `user_id`      INTEGER        NOT NULL,
    `reverses_id`  INTEGER        NULL,
    `created_at`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_writeoffs_reverses_id_key`(`reverses_id`),
    INDEX `stock_writeoffs_date_warehouse_id_idx`(`date`, `warehouse_id`),
    INDEX `stock_writeoffs_item_id_date_idx`(`item_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ON DELETE RESTRICT on all four: an item or warehouse with write-off history
-- must stay undeletable, exactly as one with opening-inventory history is.
ALTER TABLE `stock_writeoffs` ADD CONSTRAINT `stock_writeoffs_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_writeoffs` ADD CONSTRAINT `stock_writeoffs_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_writeoffs` ADD CONSTRAINT `stock_writeoffs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_writeoffs` ADD CONSTRAINT `stock_writeoffs_reverses_id_fkey` FOREIGN KEY (`reverses_id`) REFERENCES `stock_writeoffs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
