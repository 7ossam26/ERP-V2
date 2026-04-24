-- Ramex Store Schema Extensions
-- Phase 1: New enums, item type, purchase landed costs, fabric rolls, tier pricing, adjustments, counts

-- Step 1: Extend Module enum on permissions table
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
  'FABRIC_ROLLS', 'ADJUSTMENTS', 'COUNTS'
) NOT NULL;

-- Step 2: Add item_type column to items
ALTER TABLE `items`
  ADD COLUMN `item_type` ENUM('FABRIC', 'CLOTHES', 'ACCESSORY', 'GENERIC') NOT NULL DEFAULT 'GENERIC';

-- Step 3: Add landed cost columns to purchases
ALTER TABLE `purchases`
  ADD COLUMN `is_international` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `shipping_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `customs_duty` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `other_landing_costs` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Step 4: Create price_tiers table
CREATE TABLE `price_tiers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `item_id` INTEGER NOT NULL,
  `tier_name` VARCHAR(100) NOT NULL,
  `min_qty` DECIMAL(10, 4) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `price_tiers_item_id_tier_name_key`(`item_id`, `tier_name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 5: Create fabric_rolls table
CREATE TABLE `fabric_rolls` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `item_id` INTEGER NOT NULL,
  `roll_number` VARCHAR(50) NOT NULL,
  `length_meters` DECIMAL(10, 2) NOT NULL,
  `width_cm` DECIMAL(10, 2) NULL,
  `weight_kg` DECIMAL(10, 3) NULL,
  `color_code` VARCHAR(50) NULL,
  `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'DAMAGED', 'RETURNED') NOT NULL DEFAULT 'AVAILABLE',
  `warehouse_id` INTEGER NOT NULL,
  `purchase_item_id` INTEGER NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `fabric_rolls_roll_number_key`(`roll_number`),
  INDEX `fabric_rolls_item_id_idx`(`item_id`),
  INDEX `fabric_rolls_warehouse_id_idx`(`warehouse_id`),
  INDEX `fabric_rolls_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 6: Create inventory_adjustments table
CREATE TABLE `inventory_adjustments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `item_id` INTEGER NOT NULL,
  `warehouse_id` INTEGER NOT NULL,
  `quantity_change` DECIMAL(10, 6) NOT NULL,
  `reason_code` ENUM('DAMAGE', 'THEFT', 'CORRECTION', 'RETURN', 'OTHER') NOT NULL,
  `notes` TEXT NULL,
  `user_id` INTEGER NOT NULL,
  `branch_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `inventory_adjustments_item_id_idx`(`item_id`),
  INDEX `inventory_adjustments_warehouse_id_idx`(`warehouse_id`),
  INDEX `inventory_adjustments_branch_id_created_at_idx`(`branch_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 7: Create inventory_counts table
CREATE TABLE `inventory_counts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `warehouse_id` INTEGER NOT NULL,
  `status` ENUM('IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  `user_id` INTEGER NOT NULL,
  `branch_id` INTEGER NOT NULL,
  `count_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `inventory_counts_warehouse_id_idx`(`warehouse_id`),
  INDEX `inventory_counts_branch_id_count_date_idx`(`branch_id`, `count_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 8: Create inventory_count_items table
CREATE TABLE `inventory_count_items` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `inventory_count_id` INTEGER NOT NULL,
  `item_id` INTEGER NOT NULL,
  `expected_qty` DECIMAL(10, 6) NOT NULL,
  `actual_qty` DECIMAL(10, 6) NOT NULL,
  `difference` DECIMAL(10, 6) NOT NULL,

  UNIQUE INDEX `inventory_count_items_inventory_count_id_item_id_key`(`inventory_count_id`, `item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 9: Foreign keys for price_tiers
ALTER TABLE `price_tiers` ADD CONSTRAINT `price_tiers_item_id_fkey`
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Foreign keys for fabric_rolls
ALTER TABLE `fabric_rolls` ADD CONSTRAINT `fabric_rolls_item_id_fkey`
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fabric_rolls` ADD CONSTRAINT `fabric_rolls_warehouse_id_fkey`
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 11: Foreign keys for inventory_adjustments
ALTER TABLE `inventory_adjustments` ADD CONSTRAINT `inventory_adjustments_item_id_fkey`
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_adjustments` ADD CONSTRAINT `inventory_adjustments_warehouse_id_fkey`
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_adjustments` ADD CONSTRAINT `inventory_adjustments_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_adjustments` ADD CONSTRAINT `inventory_adjustments_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 12: Foreign keys for inventory_counts
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_warehouse_id_fkey`
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 13: Foreign keys for inventory_count_items
ALTER TABLE `inventory_count_items` ADD CONSTRAINT `inventory_count_items_inventory_count_id_fkey`
  FOREIGN KEY (`inventory_count_id`) REFERENCES `inventory_counts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `inventory_count_items` ADD CONSTRAINT `inventory_count_items_item_id_fkey`
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
