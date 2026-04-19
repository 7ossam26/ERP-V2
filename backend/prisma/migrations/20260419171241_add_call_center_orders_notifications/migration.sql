-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION', 'INITIAL_INVENTORY', 'CALL_CENTER') NOT NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `paid_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sale_id` INTEGER NOT NULL,
    `channel` ENUM('POS', 'CALL_CENTER', 'WHATSAPP', 'WEB', 'AGGREGATOR') NOT NULL DEFAULT 'POS',
    `status` ENUM('NEW', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `branch_id` INTEGER NOT NULL,
    `created_by_id` INTEGER NOT NULL,
    `claimed_by_id` INTEGER NULL,
    `claimed_at` DATETIME(3) NULL,
    `ready_at` DATETIME(3) NULL,
    `dispatched_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_sale_id_key`(`sale_id`),
    INDEX `orders_channel_status_branch_id_idx`(`channel`, `status`, `branch_id`),
    INDEX `orders_created_by_id_created_at_idx`(`created_by_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NULL,
    `type` ENUM('NEW_CALL_CENTER_ORDER', 'ORDER_STATUS_CHANGED') NOT NULL,
    `payload` JSON NOT NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_created_at_idx`(`user_id`, `read_at`, `created_at`),
    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_claimed_by_id_fkey` FOREIGN KEY (`claimed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: create an Order row for every existing Sale at channel=POS, status=DELIVERED.
-- createdById falls back to sales.user_id where present, else sales.employee_id mapped via 1 (superadmin) as last resort.
INSERT INTO `orders` (`sale_id`, `channel`, `status`, `branch_id`, `created_by_id`, `delivered_at`, `created_at`, `updated_at`)
SELECT
  s.`id`,
  'POS',
  'DELIVERED',
  s.`branch_id`,
  COALESCE(s.`user_id`, 1),
  s.`created_at`,
  s.`created_at`,
  s.`created_at`
FROM `sales` s
WHERE NOT EXISTS (SELECT 1 FROM `orders` o WHERE o.`sale_id` = s.`id`);

-- Backfill paid_at for already-completed POS sales (non-delivery or already delivered)
UPDATE `sales`
SET `paid_at` = `created_at`
WHERE `paid_at` IS NULL
  AND (`delivery_status` IS NULL OR `delivery_status` = 'DELIVERED');
