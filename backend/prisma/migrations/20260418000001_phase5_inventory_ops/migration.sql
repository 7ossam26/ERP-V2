-- Phase 5: Inventory Ops — adjustments doc model, count numbers, fabric reconciliation
-- Evolves InventoryAdjustment from single-item to multi-item document
-- Adds InventoryAdjustmentItem, count numbers, COUNT_VARIANCE reason, direction

-- Step 1: Add COUNT_VARIANCE to AdjustmentReason enum
ALTER TABLE `inventory_adjustments` MODIFY `reason_code`
  ENUM('DAMAGE', 'THEFT', 'CORRECTION', 'RETURN', 'COUNT_VARIANCE', 'OTHER') NOT NULL;

-- Step 2: Add AdjustmentDirection enum via new column
ALTER TABLE `inventory_adjustments`
  ADD COLUMN `adjustment_number` VARCHAR(20) NULL AFTER `id`,
  ADD COLUMN `direction` ENUM('IN', 'OUT') NULL AFTER `warehouse_id`,
  ADD COLUMN `reason_note` TEXT NULL AFTER `reason_code`;

-- Step 3: Back-fill existing rows (from Phase 3 mark-damaged)
-- Existing adjustments are all damage records with negative quantityChange → direction=OUT
UPDATE `inventory_adjustments`
SET `direction` = 'OUT',
    `adjustment_number` = CONCAT('ADJ-LEGACY-', LPAD(id, 5, '0'))
WHERE `adjustment_number` IS NULL;

-- Step 4: Make adjustment_number and direction NOT NULL + unique
ALTER TABLE `inventory_adjustments`
  MODIFY `adjustment_number` VARCHAR(20) NOT NULL,
  MODIFY `direction` ENUM('IN', 'OUT') NOT NULL,
  ADD UNIQUE INDEX `inventory_adjustments_adjustment_number_key`(`adjustment_number`);

-- Step 5: Drop old item_id column (moved to items sub-table)
-- First drop the FK and index
ALTER TABLE `inventory_adjustments` DROP FOREIGN KEY `inventory_adjustments_item_id_fkey`;
ALTER TABLE `inventory_adjustments` DROP INDEX `inventory_adjustments_item_id_idx`;
ALTER TABLE `inventory_adjustments` DROP COLUMN `item_id`;

-- Step 6: Drop old quantity_change column (moved to items sub-table)
ALTER TABLE `inventory_adjustments` DROP COLUMN `quantity_change`;

-- Step 7: Create inventory_adjustment_items table
CREATE TABLE `inventory_adjustment_items` (
  `id`                INTEGER        NOT NULL AUTO_INCREMENT,
  `adjustment_id`     INTEGER        NOT NULL,
  `item_id`           INTEGER        NOT NULL,
  `quantity`          DECIMAL(10, 6) NOT NULL,
  `unit_cost_at_time` DECIMAL(10, 2) NOT NULL DEFAULT 0,

  INDEX `inventory_adjustment_items_adjustment_id_idx`(`adjustment_id`),
  INDEX `inventory_adjustment_items_item_id_idx`(`item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 8: FK for inventory_adjustment_items
ALTER TABLE `inventory_adjustment_items`
  ADD CONSTRAINT `inventory_adjustment_items_adjustment_id_fkey`
  FOREIGN KEY (`adjustment_id`) REFERENCES `inventory_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `inventory_adjustment_items`
  ADD CONSTRAINT `inventory_adjustment_items_item_id_fkey`
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 9: Migrate FabricRollCut FK from adjustment_id → adjustment_item_id
ALTER TABLE `fabric_roll_cuts` DROP FOREIGN KEY `fabric_roll_cuts_adjustment_id_fkey`;
ALTER TABLE `fabric_roll_cuts` CHANGE COLUMN `adjustment_id` `adjustment_item_id` INTEGER NULL;
ALTER TABLE `fabric_roll_cuts`
  ADD CONSTRAINT `fabric_roll_cuts_adjustment_item_id_fkey`
  FOREIGN KEY (`adjustment_item_id`) REFERENCES `inventory_adjustment_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 10: Add countNumber and adjustmentId to inventory_counts
ALTER TABLE `inventory_counts`
  ADD COLUMN `count_number` VARCHAR(20) NULL AFTER `id`,
  ADD COLUMN `adjustment_id` INTEGER NULL;

-- Back-fill existing count rows
UPDATE `inventory_counts`
SET `count_number` = CONCAT('CNT-LEGACY-', LPAD(id, 5, '0'))
WHERE `count_number` IS NULL;

ALTER TABLE `inventory_counts`
  MODIFY `count_number` VARCHAR(20) NOT NULL,
  ADD UNIQUE INDEX `inventory_counts_count_number_key`(`count_number`),
  ADD UNIQUE INDEX `inventory_counts_adjustment_id_key`(`adjustment_id`);

ALTER TABLE `inventory_counts`
  ADD CONSTRAINT `inventory_counts_adjustment_id_fkey`
  FOREIGN KEY (`adjustment_id`) REFERENCES `inventory_adjustments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 11: Create number_sequences table (generic, prefix-based)
CREATE TABLE `number_sequences` (
  `prefix`     VARCHAR(10) NOT NULL,
  `year_month` CHAR(6)     NOT NULL,
  `last_seq`   INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (`prefix`, `year_month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
