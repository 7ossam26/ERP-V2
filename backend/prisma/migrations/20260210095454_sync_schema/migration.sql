/*
  Warnings:

  - You are about to alter the column `quantity` on the `inventory` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,6)`.

*/
-- AlterTable
ALTER TABLE `categories` ADD COLUMN `show_in_pos` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `inventory` MODIFY `quantity` DECIMAL(10, 6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `items` ADD COLUMN `show_in_pos` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION') NOT NULL;

-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `bom_id` INTEGER NULL,
    MODIFY `item_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `bom_categories` (
    `bom_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,

    PRIMARY KEY (`bom_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `output_item_id` INTEGER NULL,
    `output_quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'piece',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bom_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bom_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 4) NOT NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `bom_items_bom_id_item_id_key`(`bom_id`, `item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bom_categories` ADD CONSTRAINT `bom_categories_bom_id_fkey` FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_categories` ADD CONSTRAINT `bom_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_bom_id_fkey` FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom` ADD CONSTRAINT `bom_output_item_id_fkey` FOREIGN KEY (`output_item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_bom_id_fkey` FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
