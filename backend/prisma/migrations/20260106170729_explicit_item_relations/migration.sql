/*
  Warnings:

  - You are about to drop the `_categorytoitem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_itemtosupplier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `_CategoryToItem` DROP FOREIGN KEY `_CategoryToItem_A_fkey`;

-- DropForeignKey
ALTER TABLE `_CategoryToItem` DROP FOREIGN KEY `_CategoryToItem_B_fkey`;

-- DropForeignKey
ALTER TABLE `_ItemToSupplier` DROP FOREIGN KEY `_ItemToSupplier_A_fkey`;

-- DropForeignKey
ALTER TABLE `_ItemToSupplier` DROP FOREIGN KEY `_ItemToSupplier_B_fkey`;

-- DropTable
DROP TABLE `_CategoryToItem`;

-- DropTable
DROP TABLE `_ItemToSupplier`;

-- CreateTable
CREATE TABLE `item_suppliers` (
    `item_id` INTEGER NOT NULL,
    `supplier_id` INTEGER NOT NULL,

    PRIMARY KEY (`item_id`, `supplier_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_categories` (
    `item_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,

    PRIMARY KEY (`item_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_suppliers` ADD CONSTRAINT `item_suppliers_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_suppliers` ADD CONSTRAINT `item_suppliers_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_categories` ADD CONSTRAINT `item_categories_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_categories` ADD CONSTRAINT `item_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
