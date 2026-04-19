-- Phase 3: Fabric Rolls — per-roll tracking with originalLength, remainingLength, cuts, barcode
-- Extends the existing fabric_rolls table and adds fabric_roll_cuts + roll_number_sequences

-- Step 1: Extend FabricRollStatus enum to include PARTIALLY_CUT and DEPLETED
ALTER TABLE `fabric_rolls` MODIFY `status`
  ENUM('AVAILABLE', 'PARTIALLY_CUT', 'DEPLETED', 'DAMAGED', 'RESERVED', 'SOLD', 'RETURNED')
  NOT NULL DEFAULT 'AVAILABLE';

-- Step 2: Add new columns to fabric_rolls
ALTER TABLE `fabric_rolls`
  ADD COLUMN `original_length`  DECIMAL(10, 4) NULL AFTER `length_meters`,
  ADD COLUMN `remaining_length` DECIMAL(10, 4) NULL AFTER `original_length`,
  ADD COLUMN `unit_cost`        DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `remaining_length`,
  ADD COLUMN `barcode`          VARCHAR(100)   NULL AFTER `color_code`,
  ADD COLUMN `last_cut_at`      DATETIME(3)    NULL;

-- Step 3: Back-fill original_length and remaining_length from length_meters for existing rows
UPDATE `fabric_rolls`
SET `original_length`  = `length_meters`,
    `remaining_length` = `length_meters`
WHERE `original_length` IS NULL;

-- Step 4: Make original_length and remaining_length NOT NULL now that they're filled
ALTER TABLE `fabric_rolls`
  MODIFY `original_length`  DECIMAL(10, 4) NOT NULL,
  MODIFY `remaining_length` DECIMAL(10, 4) NOT NULL;

-- Step 5: Add unique index on barcode (sparse — NULL values allowed, only non-NULL must be unique)
ALTER TABLE `fabric_rolls`
  ADD UNIQUE INDEX `fabric_rolls_barcode_key`(`barcode`);

-- Step 6: Create roll_number_sequences table (race-safe sequence per YYYYMM)
CREATE TABLE `roll_number_sequences` (
  `year_month` CHAR(6)      NOT NULL,
  `last_seq`   INTEGER      NOT NULL DEFAULT 0,
  PRIMARY KEY (`year_month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 7: Create fabric_roll_cuts table
CREATE TABLE `fabric_roll_cuts` (
  `id`               INTEGER      NOT NULL AUTO_INCREMENT,
  `fabric_roll_id`   INTEGER      NOT NULL,
  `length_cut`       DECIMAL(10, 4) NOT NULL,
  `sale_item_id`     INTEGER      NULL,
  `adjustment_id`    INTEGER      NULL,
  `notes`            TEXT         NULL,
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `fabric_roll_cuts_fabric_roll_id_idx`(`fabric_roll_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 8: Foreign key from fabric_roll_cuts → fabric_rolls
ALTER TABLE `fabric_roll_cuts`
  ADD CONSTRAINT `fabric_roll_cuts_fabric_roll_id_fkey`
  FOREIGN KEY (`fabric_roll_id`) REFERENCES `fabric_rolls`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Foreign key from fabric_roll_cuts → sale_items (nullable)
ALTER TABLE `fabric_roll_cuts`
  ADD CONSTRAINT `fabric_roll_cuts_sale_item_id_fkey`
  FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 10: Foreign key from fabric_roll_cuts → inventory_adjustments (nullable)
ALTER TABLE `fabric_roll_cuts`
  ADD CONSTRAINT `fabric_roll_cuts_adjustment_id_fkey`
  FOREIGN KEY (`adjustment_id`) REFERENCES `inventory_adjustments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 11: Extend Module enum to include CREATES_FABRIC_ROLLS
ALTER TABLE `permissions` MODIFY `module` ENUM(
  'HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES',
  'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT',
  'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS',
  'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS',
  'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES',
  'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS',
  'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS',
  'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN',
  'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION',
  'FABRIC_ROLLS', 'CREATES_FABRIC_ROLLS', 'ADJUSTMENTS', 'COUNTS',
  'OWNER_DASHBOARD'
) NOT NULL;
