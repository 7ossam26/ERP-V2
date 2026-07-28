-- AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
-- Run "npm run refresh-migration" to update this file.

-- Migration: 20260105001140_init
-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `branch` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `national_id` VARCHAR(191) NULL,
    `working_days_per_month` INTEGER NOT NULL DEFAULT 26,
    `working_hours_per_day` DECIMAL(4, 2) NOT NULL DEFAULT 8,
    `weekly_holiday` VARCHAR(191) NOT NULL DEFAULT 'Friday',
    `salary` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Migration: 20260106021714_add_warehouses
-- CreateTable
CREATE TABLE `warehouses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Migration: 20260106045150_add_treasuries
-- CreateTable
CREATE TABLE `treasuries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Migration: 20260106140527_add_branch_model
-- CreateTable
CREATE TABLE `branches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `treasury_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branches_warehouse_id_key`(`warehouse_id`),
    UNIQUE INDEX `branches_treasury_id_key`(`treasury_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260106150357_link_employee_to_branch
/*
  Warnings:

  - You are about to drop the column `branch` on the `employees` table. All the data in the column will be lost.
  - Added the required column `branch_id` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `employees` DROP COLUMN `branch`,
    ADD COLUMN `branch_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260106153206_add_client_model
-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Migration: 20260106155814_add_supplier_model
-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Migration: 20260106160135_remove_supplier_code
/*
  Warnings:

  - You are about to drop the column `code` on the `suppliers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `suppliers` DROP COLUMN `code`;


-- Migration: 20260106161944_add_category_model
-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Migration: 20260106164626_add_item_model_and_relations
-- CreateTable
CREATE TABLE `items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_CategoryToItem` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_CategoryToItem_AB_unique`(`A`, `B`),
    INDEX `_CategoryToItem_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ItemToSupplier` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ItemToSupplier_AB_unique`(`A`, `B`),
    INDEX `_ItemToSupplier_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_CategoryToItem` ADD CONSTRAINT `_CategoryToItem_A_fkey` FOREIGN KEY (`A`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CategoryToItem` ADD CONSTRAINT `_CategoryToItem_B_fkey` FOREIGN KEY (`B`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ItemToSupplier` ADD CONSTRAINT `_ItemToSupplier_A_fkey` FOREIGN KEY (`A`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ItemToSupplier` ADD CONSTRAINT `_ItemToSupplier_B_fkey` FOREIGN KEY (`B`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Migration: 20260106170729_explicit_item_relations
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


-- Migration: 20260107022431_add_purchase_models
-- CreateTable
CREATE TABLE `purchases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `treasury_id` INTEGER NULL,
    `warehouse_id` INTEGER NULL,
    `supplier_invoice_no` VARCHAR(191) NULL,
    `payment_method` ENUM('CASH', 'CREDIT', 'MIXED') NOT NULL DEFAULT 'CASH',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount_type` ENUM('PERCENTAGE', 'VALUE') NOT NULL DEFAULT 'PERCENTAGE',
    `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `net_total` DECIMAL(10, 2) NOT NULL,
    `paid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `remaining` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `purchase_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `purchase_price` DECIMAL(10, 2) NOT NULL,
    `sell_price` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`purchase_id`, `item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260107023605_make_treasury_warehouse_required_in_purchase
/*
  Warnings:

  - Made the column `treasury_id` on table `purchases` required. This step will fail if there are existing NULL values in that column.
  - Made the column `warehouse_id` on table `purchases` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `purchases` DROP FOREIGN KEY `purchases_treasury_id_fkey`;

-- DropForeignKey
ALTER TABLE `purchases` DROP FOREIGN KEY `purchases_warehouse_id_fkey`;

-- DropIndex
DROP INDEX `purchases_treasury_id_fkey` ON `purchases`;

-- DropIndex
DROP INDEX `purchases_warehouse_id_fkey` ON `purchases`;

-- AlterTable
ALTER TABLE `purchases` MODIFY `treasury_id` INTEGER NOT NULL,
    MODIFY `warehouse_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260108125741_add_auth_tables
-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `module` ENUM('HR', 'INVENTORY', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS') NOT NULL,
    `can_view` BOOLEAN NOT NULL DEFAULT false,
    `can_create` BOOLEAN NOT NULL DEFAULT false,
    `can_edit` BOOLEAN NOT NULL DEFAULT false,
    `can_delete` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `permissions_role_id_module_key`(`role_id`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `target_entity` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260108150642_add_pos_tables
-- CreateTable
CREATE TABLE `sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sale_number` VARCHAR(191) NOT NULL,
    `client_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `branch_id` INTEGER NOT NULL,
    `treasury_id` INTEGER NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `tax_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0.14,
    `tax_amount` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'CARD') NOT NULL DEFAULT 'CASH',
    `paid_amount` DECIMAL(10, 2) NOT NULL,
    `change_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('COMPLETED', 'HELD', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_sale_number_key`(`sale_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sale_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260108151225_remove_change_amount_from_sales
/*
  Warnings:

  - You are about to drop the column `change_amount` on the `sales` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sales` DROP COLUMN `change_amount`;


-- Migration: 20260108162622_add_treasury_balance
-- AlterTable
ALTER TABLE `sales` ADD COLUMN `change_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `treasuries` ADD COLUMN `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0;


-- Migration: 20260108182627_make_warehouse_id_optional
-- AlterTable
ALTER TABLE `sales` ADD COLUMN `warehouse_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260109211748_add_stock_transfers
-- AlterTable
ALTER TABLE `items` ADD COLUMN `reorder_point` INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE `inventory` (
    `item_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`item_id`, `warehouse_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `from_treasury_id` INTEGER NOT NULL,
    `to_treasury_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configuration` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `company_name` VARCHAR(191) NOT NULL DEFAULT 'ERP System',
    `main_warehouse_id` INTEGER NULL,
    `main_treasury_id` INTEGER NULL,
    `bank_treasury_id` INTEGER NULL,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 14.0,
    `salary_start_day` INTEGER NOT NULL DEFAULT 1,
    `salary_end_day` INTEGER NOT NULL DEFAULT 30,
    `shift_start_time` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `shift_end_time` VARCHAR(191) NOT NULL DEFAULT '17:00',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transfer_number` VARCHAR(191) NOT NULL,
    `from_warehouse_id` INTEGER NOT NULL,
    `to_warehouse_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_transfers_transfer_number_key`(`transfer_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_transfer_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_from_treasury_id_fkey` FOREIGN KEY (`from_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_to_treasury_id_fkey` FOREIGN KEY (`to_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration` ADD CONSTRAINT `system_configuration_main_warehouse_id_fkey` FOREIGN KEY (`main_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration` ADD CONSTRAINT `system_configuration_main_treasury_id_fkey` FOREIGN KEY (`main_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration` ADD CONSTRAINT `system_configuration_bank_treasury_id_fkey` FOREIGN KEY (`bank_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_warehouse_id_fkey` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_warehouse_id_fkey` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_stock_transfer_id_fkey` FOREIGN KEY (`stock_transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260111100515_add_user_branch_sales_relation
-- AlterTable
ALTER TABLE `sales` ADD COLUMN `user_id` INTEGER NULL,
    MODIFY `employee_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `branch_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260111125547_add_expenses
/*
  Warnings:

  - Made the column `branch_id` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_branch_id_fkey`;

-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES') NOT NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `branch_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `expenses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `description` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('MANUAL', 'PURCHASE') NOT NULL DEFAULT 'MANUAL',
    `treasury_id` INTEGER NOT NULL,
    `purchase_id` INTEGER NULL,
    `payment_method` ENUM('CASH', 'CARD') NOT NULL DEFAULT 'CASH',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expenses_purchase_id_key`(`purchase_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Migration: 20260111142641_add_shifts
-- AlterTable
ALTER TABLE `sales` ADD COLUMN `shift_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NOT NULL,
    `start_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `end_time` DATETIME(3) NULL,
    `start_cash` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `end_cash` DECIMAL(10, 2) NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260112125746_simplify_permissions_add_creates_modules
/*
  Warnings:

  - You are about to drop the column `can_create` on the `permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_delete` on the `permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_edit` on the `permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_view` on the `permissions` table. All the data in the column will be lost.
  - Added the required column `created_by_id` to the `cash_transfers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `branches` ADD COLUMN `is_all_branches` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `cash_transfers` ADD COLUMN `accepted_by_id` INTEGER NULL,
    ADD COLUMN `created_by_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `permissions` DROP COLUMN `can_create`,
    DROP COLUMN `can_delete`,
    DROP COLUMN `can_edit`,
    DROP COLUMN `can_view`,
    ADD COLUMN `can_access` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `module` ENUM('HR', 'INVENTORY', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES') NOT NULL;

-- CreateTable
CREATE TABLE `employee_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `type` ENUM('ADVANCE', 'DEDUCTION') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` TEXT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payrolls` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `base_salary` DECIMAL(10, 2) NOT NULL,
    `advances` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `deductions` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `net_salary` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `payment_date` DATETIME(3) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payrolls_employee_id_month_year_key`(`employee_id`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_transactions` ADD CONSTRAINT `employee_transactions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_transactions` ADD CONSTRAINT `employee_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_accepted_by_id_fkey` FOREIGN KEY (`accepted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260113155654_add_sensitive_access_to_users
-- AlterTable
ALTER TABLE `users`
ADD COLUMN `has_sensitive_access` BOOLEAN NOT NULL DEFAULT false;

-- Set default sensitive access based on role
UPDATE `users` u
INNER JOIN `roles` r ON u.role_id = r.id
SET
    u.has_sensitive_access = true
WHERE
    r.name IN (
        'Superadmin',
        'Admin',
        'Manager'
    );

-- Migration: 20260114030817_add_refresh_tokens
-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES') NOT NULL;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Migration: 20260114140951_add_supplier_accounts_and_payment_status
-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES') NOT NULL;

-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `payment_status` ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
    MODIFY `payment_method` ENUM('CASH', 'CREDIT', 'DEFERRED', 'MIXED') NOT NULL DEFAULT 'CASH';

-- CreateTable
CREATE TABLE `supplier_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `supplier_accounts_supplier_id_key`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_account_id` INTEGER NOT NULL,
    `purchase_id` INTEGER NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `treasury_id` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `payment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `supplier_accounts` ADD CONSTRAINT `supplier_accounts_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_account_id_fkey` FOREIGN KEY (`supplier_account_id`) REFERENCES `supplier_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260114235041_add_deposit_module
-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS') NOT NULL;

-- CreateTable
CREATE TABLE `deposits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `date` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `treasury_id` INTEGER NOT NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260125145848_add_unique_constraints
/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `items` will be added. If there are existing duplicate values, this will fail.

*/
-- NOTE: is_active columns already added by 20260306052139_add_is_active_columns
-- NOTE: deposits.date already modified by 20260306052139_add_is_active_columns

-- CreateIndex
CREATE UNIQUE INDEX `categories_name_key` ON `categories`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `items_name_key` ON `items`(`name`);


-- Migration: 20260131_add_shift_enhancements
-- AlterTable: User - Add reviewedShifts relation support
-- No actual column change needed, handled by Prisma relations

-- AlterTable: Shift - Add new shift management fields
ALTER TABLE `shifts`
ADD COLUMN `type` ENUM('MORNING', 'EVENING') NOT NULL DEFAULT 'MORNING' AFTER `branch_id`,
ADD COLUMN `system_expected_cash` DECIMAL(10, 2) NULL AFTER `end_cash`,
ADD COLUMN `actual_cash` DECIMAL(10, 2) NULL AFTER `system_expected_cash`,
ADD COLUMN `shortage` DECIMAL(10, 2) NULL AFTER `actual_cash`,
ADD COLUMN `reviewed_by_id` INTEGER NULL AFTER `status`,
ADD COLUMN `reviewed_at` DATETIME(3) NULL AFTER `reviewed_by_id`,
MODIFY COLUMN `status` ENUM(
    'OPEN',
    'PENDING_REVIEW',
    'CLOSED'
) NOT NULL DEFAULT 'OPEN';

-- CreateIndex: Add index for reviewed_by_id
CREATE INDEX `shifts_reviewed_by_id_idx` ON `shifts` (`reviewed_by_id`);

-- AddForeignKey: Link Shift to Manager (reviewer)
ALTER TABLE `shifts`
ADD CONSTRAINT `shifts_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SystemConfiguration - Add shift time configs
ALTER TABLE `system_configuration`
ADD COLUMN `morning_shift_start` VARCHAR(191) NOT NULL DEFAULT '09:00' AFTER `shift_end_time`,
ADD COLUMN `morning_shift_end` VARCHAR(191) NOT NULL DEFAULT '17:00' AFTER `morning_shift_start`,
ADD COLUMN `evening_shift_start` VARCHAR(191) NOT NULL DEFAULT '17:00' AFTER `morning_shift_end`,
ADD COLUMN `evening_shift_end` VARCHAR(191) NOT NULL DEFAULT '01:00' AFTER `evening_shift_start`;

-- AlterTable: Expense - Link to Shift
ALTER TABLE `expenses`
ADD COLUMN `shift_id` INTEGER NULL AFTER `purchase_id`;

-- CreateIndex: Add index for shift_id
CREATE INDEX `expenses_shift_id_idx` ON `expenses` (`shift_id`);

-- AddForeignKey: Link Expense to Shift
ALTER TABLE `expenses`
ADD CONSTRAINT `expenses_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Migration: 20260201120957_add_delivery_zones_and_address
-- AlterTable
ALTER TABLE `clients` ADD COLUMN `address` TEXT NULL;

-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES') NOT NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `delivery_address` TEXT NULL,
    ADD COLUMN `delivery_fee` DECIMAL(10, 2) NULL,
    ADD COLUMN `delivery_man_id` INTEGER NULL,
    ADD COLUMN `delivery_status` ENUM('PENDING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELED') NULL,
    ADD COLUMN `delivery_zone_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `delivery_men` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `national_id` VARCHAR(191) NULL,
    `vehicle_type` VARCHAR(191) NULL,
    `branch_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_zones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `fee` DECIMAL(10, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `delivery_zones_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_delivery_man_id_fkey` FOREIGN KEY (`delivery_man_id`) REFERENCES `delivery_men`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_delivery_zone_id_fkey` FOREIGN KEY (`delivery_zone_id`) REFERENCES `delivery_zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_men` ADD CONSTRAINT `delivery_men_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260203145056_add_delivery_wallet
/*
  Warnings:

  - A unique constraint covering the columns `[branch_id,name]` on the table `delivery_zones` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `delivery_zones_name_key` ON `delivery_zones`;

-- AlterTable
ALTER TABLE `delivery_men` ADD COLUMN `wallet_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `delivery_zones` ADD COLUMN `branch_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `delivery_man_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `delivery_man_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `delivery_zones_branch_id_name_key` ON `delivery_zones`(`branch_id`, `name`);

-- AddForeignKey
ALTER TABLE `delivery_man_transactions` ADD CONSTRAINT `delivery_man_transactions_delivery_man_id_fkey` FOREIGN KEY (`delivery_man_id`) REFERENCES `delivery_men`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_man_transactions` ADD CONSTRAINT `delivery_man_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_zones` ADD CONSTRAINT `delivery_zones_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Migration: 20260204113521_refactor_branch_access
/*
  Warnings:

  - You are about to drop the column `is_all_branches` on the `branches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `branches` DROP COLUMN `is_all_branches`;

-- AlterTable
ALTER TABLE `users` MODIFY `branch_id` INTEGER NULL;


-- Migration: 20260208171108_add_accessible_branches
-- CreateTable
CREATE TABLE `_AccessibleBranches` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_AccessibleBranches_AB_unique`(`A`, `B`),
    INDEX `_AccessibleBranches_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_AccessibleBranches` ADD CONSTRAINT `_AccessibleBranches_A_fkey` FOREIGN KEY (`A`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AccessibleBranches` ADD CONSTRAINT `_AccessibleBranches_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Migration: 20260209134254_add_driver_share
-- AlterTable
ALTER TABLE `delivery_zones` ADD COLUMN `driver_share` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `delivery_driver_share` DECIMAL(10, 2) NULL;


-- Migration: 20260209141636_add_delivery_settlement_module
-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES') NOT NULL;


-- Migration: 20260210095454_sync_schema
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


-- Migration: 20260210125534_add_item_cost_price
-- AlterTable
ALTER TABLE `items` ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0;


-- Migration: 20260215103756_add_withdrawals
-- AlterTable
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION') NOT NULL;

-- CreateTable
CREATE TABLE `withdrawals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `treasury_id` INTEGER NOT NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260306052139_add_is_active_columns
/*
  Warnings:

  - You are about to alter the column `date` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DateTime(3)` to `DateTime(0)`.

*/
-- AlterTable
ALTER TABLE `branches` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `deposits` MODIFY `date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `treasuries` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `warehouses` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;


-- Migration: 20260307000001_add_is_bom_to_items
-- AlterTable
ALTER TABLE `items` ADD COLUMN `is_bom` BOOLEAN NOT NULL DEFAULT false;


-- Migration: 20260307120000_enhance_audit_logs
-- Enhance audit_logs: add branch_id, row_hash, and performance indexes
ALTER TABLE `audit_logs`
  ADD COLUMN `branch_id` INTEGER NULL AFTER `ip_address`,
  ADD COLUMN `row_hash`  CHAR(64)     NULL AFTER `branch_id`,
  MODIFY COLUMN `action`        VARCHAR(20)  NOT NULL,
  MODIFY COLUMN `target_entity` VARCHAR(60)  NOT NULL,
  MODIFY COLUMN `target_id`     VARCHAR(40)  NULL,
  MODIFY COLUMN `ip_address`    VARCHAR(45)  NULL;

-- Indexes for viewer queries (no FK on branch_id to avoid cascade issues)
CREATE INDEX `audit_logs_created_at_idx`            ON `audit_logs`(`created_at`);
CREATE INDEX `audit_logs_user_id_created_at_idx`    ON `audit_logs`(`user_id`, `created_at`);
CREATE INDEX `audit_logs_target_entity_target_id_idx` ON `audit_logs`(`target_entity`, `target_id`(20));
CREATE INDEX `audit_logs_branch_id_created_at_idx`  ON `audit_logs`(`branch_id`, `created_at`);

-- Foreign key for branch_id
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260309000001_add_production_orders
-- Add PRODUCTION to permissions enum
ALTER TABLE `permissions` MODIFY `module` ENUM(
  'HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES',
  'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT',
  'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS',
  'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS',
  'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES',
  'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS',
  'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS',
  'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN',
  'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION'
) NOT NULL;

-- CreateTable production_orders
CREATE TABLE `production_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bom_id` INTEGER NOT NULL,
    `source_warehouse_id` INTEGER NOT NULL,
    `dest_warehouse_id` INTEGER NULL,
    `target_output_qty` DECIMAL(10, 3) NOT NULL,
    `actual_output_qty` DECIMAL(10, 3) NOT NULL,
    `output_waste_qty` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `total_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable production_order_items
CREATE TABLE `production_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `production_order_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity_used` DECIMAL(10, 6) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey production_orders -> bom
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_bom_id_fkey`
    FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey production_orders -> warehouses (source)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_source_warehouse_id_fkey`
    FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey production_orders -> warehouses (dest)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_dest_warehouse_id_fkey`
    FOREIGN KEY (`dest_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey production_orders -> users (created_by)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey production_order_items -> production_orders
ALTER TABLE `production_order_items` ADD CONSTRAINT `production_order_items_production_order_id_fkey`
    FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey production_order_items -> items
ALTER TABLE `production_order_items` ADD CONSTRAINT `production_order_items_item_id_fkey`
    FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260310000001_add_tax_number
-- Add tax_number to system_configuration
ALTER TABLE `system_configuration` ADD COLUMN `tax_number` VARCHAR(191) NOT NULL DEFAULT '';


-- Migration: 20260310000002_add_purchase_returns
-- CreateTable
CREATE TABLE `purchase_returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_id` INTEGER NOT NULL,
    `return_number` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(500) NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `purchase_returns_return_number_key`(`return_number`),
    INDEX `purchase_returns_purchase_id_fkey`(`purchase_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_return_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `purchase_price` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,

    INDEX `purchase_return_items_purchase_return_id_fkey`(`purchase_return_id`),
    INDEX `purchase_return_items_item_id_fkey`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_purchase_return_id_fkey` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260310000003_add_returned_payment_status
-- AlterTable: Add RETURNED to PaymentStatus enum
ALTER TABLE `purchases` MODIFY COLUMN `payment_status` ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID', 'RETURNED') NOT NULL DEFAULT 'UNPAID';


-- Migration: 20260310000004_audit_old_values
ALTER TABLE `audit_logs` ADD COLUMN `old_values` JSON NULL AFTER `details`;


-- Migration: 20260325000001_increase_quantity_precision_add_instapay
-- Migration: increase_quantity_precision_add_instapay
-- Increase quantity precision from DECIMAL(10,2) to DECIMAL(10,4) across all transaction tables
-- Also rename SalePaymentMethod CARD -> INSTAPAY to match business terminology

-- SaleItem.quantity: 10,2 → 10,4
ALTER TABLE `sale_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- PurchaseItem.quantity: 10,2 → 10,4
ALTER TABLE `purchase_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- PurchaseReturnItem.quantity: 10,2 → 10,4
ALTER TABLE `purchase_return_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- StockTransferItem.quantity: 10,2 → 10,4
ALTER TABLE `stock_transfer_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- ProductionOrder qty fields: 10,3 → 10,4
ALTER TABLE `production_orders` MODIFY COLUMN `target_output_qty` DECIMAL(10,4) NOT NULL;
ALTER TABLE `production_orders` MODIFY COLUMN `actual_output_qty` DECIMAL(10,4) NOT NULL;
ALTER TABLE `production_orders` MODIFY COLUMN `output_waste_qty` DECIMAL(10,4) NOT NULL DEFAULT 0;

-- SalePaymentMethod: rename CARD -> INSTAPAY
-- Step 1: Add INSTAPAY to the enum
ALTER TABLE `sales` MODIFY COLUMN `payment_method` ENUM('CASH', 'CARD', 'INSTAPAY') NOT NULL DEFAULT 'CASH';
-- Step 2: Migrate existing CARD records to INSTAPAY
UPDATE `sales` SET `payment_method` = 'INSTAPAY' WHERE `payment_method` = 'CARD';
-- Step 3: Remove CARD from the enum
ALTER TABLE `sales` MODIFY COLUMN `payment_method` ENUM('CASH', 'INSTAPAY') NOT NULL DEFAULT 'CASH';


-- Migration: 20260413000001_add_initial_inventory
-- AlterEnum
ALTER TABLE `permissions` MODIFY COLUMN `module` ENUM(
  'HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS','PURCHASES','SALES',
  'REPORTS','TREASURIES','CASH_TRANSFER','TRANSFER_MANAGEMENT','BRANCHES',
  'EMPLOYEES','CLIENTS','SUPPLIERS','SUPPLIER_ACCOUNTS','CATEGORIES','ITEMS',
  'WAREHOUSES','SETTINGS','EXPENSES','SHIFTS','DELIVERY_SETTLEMENT',
  'CREATES_WAREHOUSES','CREATES_EMPLOYEES','CREATES_SUPPLIERS','CREATES_CLIENTS',
  'CREATES_CATEGORIES','CREATES_ITEMS','CREATES_TREASURIES','CREATES_BRANCHES',
  'DEPOSITS','CREATES_DEPOSITS','WITHDRAWALS','CREATES_WITHDRAWALS',
  'DELIVERY_MEN','CREATES_DELIVERY_MEN','DELIVERY_ZONES','CREATES_DELIVERY_ZONES',
  'CREATES_PRODUCTION','PRODUCTION','INITIAL_INVENTORY'
) NOT NULL;

-- CreateTable
CREATE TABLE `initial_inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 6) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `initial_inventory` ADD CONSTRAINT `initial_inventory_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `initial_inventory` ADD CONSTRAINT `initial_inventory_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `initial_inventory` ADD CONSTRAINT `initial_inventory_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260413000002_add_production_order_status
-- Add status, cancellation tracking, and linked order to production_orders

ALTER TABLE `production_orders`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN `cancelled_by_id` INTEGER NULL,
  ADD COLUMN `cancelled_at` DATETIME(3) NULL,
  ADD COLUMN `linked_order_id` INTEGER NULL;

-- AddForeignKey production_orders -> users (cancelled_by)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_cancelled_by_id_fkey`
  FOREIGN KEY (`cancelled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey production_orders -> production_orders (linked_order self-relation)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_linked_order_id_fkey`
  FOREIGN KEY (`linked_order_id`) REFERENCES `production_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260413000003_add_visa_payment_method
-- Migration: add_visa_payment_method
-- Add VISA as a new payment method for POS sales (routed to bank treasury like INSTAPAY)

-- Add VISA to the SalePaymentMethod enum
ALTER TABLE `sales` MODIFY COLUMN `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA') NOT NULL DEFAULT 'CASH';


-- Migration: 20260418071621_add_card_to_sale_payment_method
/*
  Warnings:

  - You are about to alter the column `output_quantity` on the `bom` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `production_orders` DROP FOREIGN KEY `production_orders_dest_warehouse_id_fkey`;

-- DropForeignKey
ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `refresh_tokens_user_id_fkey`;

-- DropIndex
DROP INDEX `audit_logs_target_entity_target_id_idx` ON `audit_logs`;

-- AlterTable
ALTER TABLE `bom` MODIFY `output_quantity` DECIMAL(10, 4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `purchases` MODIFY `payment_status` ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE `sales` MODIFY `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA', 'CARD') NOT NULL DEFAULT 'CASH';

-- DropTable
DROP TABLE `refresh_tokens`;

-- CreateIndex
CREATE INDEX `audit_logs_target_entity_target_id_idx` ON `audit_logs`(`target_entity`, `target_id`);

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_dest_warehouse_id_fkey` FOREIGN KEY (`dest_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260419171241_add_call_center_orders_notifications
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


-- Migration: 20260420075643_add_order_cancellation_fields
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `cancellation_note` TEXT NULL,
    ADD COLUMN `cancellation_reason` ENUM('CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'WRONG_ADDRESS', 'NO_ANSWER', 'DUPLICATE', 'OTHER') NULL,
    ADD COLUMN `cancelled_by_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_cancelled_by_id_fkey` FOREIGN KEY (`cancelled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260420081752_add_sale_discount_fields
-- AlterTable
ALTER TABLE `sales` ADD COLUMN `discount_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `discount_type` ENUM('PERCENTAGE', 'VALUE') NULL,
    ADD COLUMN `discount_value` DECIMAL(10, 2) NULL;


-- Migration: 20260420090000_add_sale_discount_reason_and_applied_by
-- AlterTable
ALTER TABLE `sales`
  ADD COLUMN `discount_reason` VARCHAR(32) NULL,
  ADD COLUMN `discount_applied_by_user_id` INT NULL;

-- AddForeignKey
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_discount_applied_by_user_id_fkey`
  FOREIGN KEY (`discount_applied_by_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `sales_discount_reason_idx` ON `sales`(`discount_reason`);
CREATE INDEX `sales_discount_applied_by_user_id_idx` ON `sales`(`discount_applied_by_user_id`);


-- Migration: 20260420120000_add_bulk_pos_phase1
-- AlterTable: extend Module enum with BULK_* permissions
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION', 'INITIAL_INVENTORY', 'CALL_CENTER', 'BULK_POS', 'BULK_CUSTOMERS', 'BULK_PRICING', 'BULK_CREDIT', 'BULK_REPORTS') NOT NULL;

-- CreateTable
CREATE TABLE `bulk_customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(200) NOT NULL,
    `trade_name` VARCHAR(200) NULL,
    `tax_number` VARCHAR(50) NULL,
    `primary_contact_name` VARCHAR(120) NOT NULL,
    `primary_contact_phone` VARCHAR(40) NOT NULL,
    `primary_contact_email` VARCHAR(120) NULL,
    `shipping_address` TEXT NOT NULL,
    `credit_limit` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bulk_customers_tax_number_key`(`tax_number`),
    INDEX `bulk_customers_company_name_idx`(`company_name`),
    INDEX `bulk_customers_primary_contact_phone_idx`(`primary_contact_phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_customer_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(120) NULL,
    `role` VARCHAR(60) NULL,

    INDEX `bulk_customer_contacts_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_contract_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `created_by_user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bulk_contract_prices_customer_id_item_id_key`(`customer_id`, `item_id`),
    INDEX `bulk_contract_prices_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_number` VARCHAR(191) NULL,
    `customer_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'QUOTED', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'RETURNED') NOT NULL DEFAULT 'DRAFT',
    `subtotal_inclusive` DECIMAL(12, 2) NOT NULL,
    `tax_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0.14,
    `net_amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance_due` DECIMAL(12, 2) NOT NULL,
    `scheduled_pickup_date` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancelled_by_user_id` INTEGER NULL,
    `cancel_reason` TEXT NULL,
    `returned_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bulk_orders_order_number_key`(`order_number`),
    INDEX `bulk_orders_customer_id_status_idx`(`customer_id`, `status`),
    INDEX `bulk_orders_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `line_total` DECIMAL(12, 2) NOT NULL,

    INDEX `bulk_order_items_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `type` ENUM('PROFORMA', 'TAX_INVOICE', 'SALES_RECEIPT', 'CREDIT_NOTE') NOT NULL,
    `document_number` VARCHAR(191) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issued_by_user_id` INTEGER NOT NULL,
    `snapshot` JSON NULL,

    UNIQUE INDEX `bulk_documents_document_number_key`(`document_number`),
    INDEX `bulk_documents_order_id_type_idx`(`order_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_number_sequences` (
    `key` VARCHAR(191) NOT NULL,
    `next_value` INTEGER NOT NULL DEFAULT 1,
    `prefix` VARCHAR(20) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bulk_customers` ADD CONSTRAINT `bulk_customers_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_customer_contacts` ADD CONSTRAINT `bulk_customer_contacts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_cancelled_by_user_id_fkey` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_order_items` ADD CONSTRAINT `bulk_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_order_items` ADD CONSTRAINT `bulk_order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_documents` ADD CONSTRAINT `bulk_documents_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed numbering sequences
INSERT INTO `bulk_number_sequences` (`key`, `next_value`, `prefix`, `updated_at`) VALUES
  ('ORDER', 1, 'BULK-', NOW(3)),
  ('SALES_RECEIPT', 1, 'BULK-RCP-', NOW(3)),
  ('TAX_INVOICE', 1, 'BULK-TAX-', NOW(3)),
  ('CREDIT_NOTE', 1, 'BULK-CN-', NOW(3))
ON DUPLICATE KEY UPDATE `prefix` = VALUES(`prefix`);


-- Migration: 20260420183631_add_bulk_payments_refunds
-- DropIndex
DROP INDEX `sales_discount_reason_idx` ON `sales`;

-- CreateTable
CREATE TABLE `bulk_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `treasury_id` INTEGER NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_user_id` INTEGER NOT NULL,
    `bank_reference` VARCHAR(120) NULL,
    `cheque_number` VARCHAR(60) NULL,
    `cheque_due_date` DATETIME(3) NULL,
    `voided_at` DATETIME(3) NULL,
    `voided_by_user_id` INTEGER NULL,
    `void_reason` TEXT NULL,
    `notes` TEXT NULL,

    INDEX `bulk_payments_order_id_idx`(`order_id`),
    INDEX `bulk_payments_customer_id_received_at_idx`(`customer_id`, `received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_refunds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `method` ENUM('CASH_REFUND', 'CREDIT_NOTE') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` TEXT NULL,
    `treasury_id` INTEGER NULL,
    `credit_note_number` VARCHAR(191) NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bulk_refunds_credit_note_number_key`(`credit_note_number`),
    INDEX `bulk_refunds_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_voided_by_user_id_fkey` FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration: 20260421000000_treasury_scope_visa_instapay_split
-- Treasury scope + Visa/Instapay split + CARD removal
-- Phase 1 of Visa/Instapay treasuries feature.

-- ============================================
-- 1. Add Treasury.scope column
-- ============================================
ALTER TABLE `treasuries`
  ADD COLUMN `scope` ENUM('BRANCH_CASH', 'GLOBAL_VISA', 'GLOBAL_INSTAPAY', 'MAIN')
  NOT NULL DEFAULT 'BRANCH_CASH';

-- ============================================
-- 2. Backfill scope for existing rows
-- ============================================

-- Branch-linked treasuries stay BRANCH_CASH (default already applied).

-- Main treasury (referenced by system_configuration.main_treasury_id)
UPDATE `treasuries` t
  INNER JOIN `system_configuration` sc ON sc.`main_treasury_id` = t.`id`
SET t.`scope` = 'MAIN';

-- Existing bank treasury (will be renamed to Visa treasury below)
UPDATE `treasuries` t
  INNER JOIN `system_configuration` sc ON sc.`bank_treasury_id` = t.`id`
SET t.`scope` = 'GLOBAL_VISA', t.`name` = 'خزينة فيزا';

-- ============================================
-- 3. Rename SystemConfiguration.bank_treasury_id -> visa_treasury_id
-- ============================================

-- Drop existing FK so we can rename the column cleanly
ALTER TABLE `system_configuration`
  DROP FOREIGN KEY `system_configuration_bank_treasury_id_fkey`;

ALTER TABLE `system_configuration`
  CHANGE COLUMN `bank_treasury_id` `visa_treasury_id` INTEGER NULL;

ALTER TABLE `system_configuration`
  ADD CONSTRAINT `system_configuration_visa_treasury_id_fkey`
  FOREIGN KEY (`visa_treasury_id`) REFERENCES `treasuries`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 4. Add SystemConfiguration.instapay_treasury_id
-- ============================================
ALTER TABLE `system_configuration`
  ADD COLUMN `instapay_treasury_id` INTEGER NULL;

ALTER TABLE `system_configuration`
  ADD CONSTRAINT `system_configuration_instapay_treasury_id_fkey`
  FOREIGN KEY (`instapay_treasury_id`) REFERENCES `treasuries`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 5. Seed Instapay treasury + wire it up
-- ============================================

-- Create Instapay treasury if it doesn't already exist
INSERT INTO `treasuries` (`name`, `balance`, `scope`, `is_active`, `created_at`, `updated_at`)
SELECT 'خزينة انستاباي', 0, 'GLOBAL_INSTAPAY', 1, NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `treasuries` WHERE `scope` = 'GLOBAL_INSTAPAY' AND `is_active` = 1
);

-- Point system_configuration.instapay_treasury_id at it
UPDATE `system_configuration` sc
  INNER JOIN `treasuries` t ON t.`scope` = 'GLOBAL_INSTAPAY' AND t.`is_active` = 1
SET sc.`instapay_treasury_id` = t.`id`
WHERE sc.`id` = 1 AND sc.`instapay_treasury_id` IS NULL;

-- ============================================
-- 6. Migrate SalePaymentMethod: CARD -> VISA, then drop CARD
-- ============================================

-- Widen enum temporarily (VISA already exists, CARD already exists; this is defensive)
ALTER TABLE `sales`
  MODIFY `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA', 'CARD') NOT NULL DEFAULT 'CASH';

-- Migrate data
UPDATE `sales` SET `payment_method` = 'VISA' WHERE `payment_method` = 'CARD';

-- Drop CARD from the enum
ALTER TABLE `sales`
  MODIFY `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA') NOT NULL DEFAULT 'CASH';


-- Migration: 20260421100000_shift_expected_digital_totals
-- Phase 3: Shift reconciliation — persist expected Visa / Instapay totals
-- so digital payment reconciliation is auto-trusted and auditable.

ALTER TABLE `shifts`
  ADD COLUMN `expected_visa` DECIMAL(10, 2) NULL,
  ADD COLUMN `expected_instapay` DECIMAL(10, 2) NULL;


-- Migration: 20260422000000_add_proforma_sequence
-- Add PROFORMA row to bulk_number_sequences so proforma documents get
-- unique sequential numbers (prefix BULK-PRO-).
INSERT INTO `bulk_number_sequences` (`key`, `prefix`, `next_value`, `updated_at`)
VALUES ('PROFORMA', 'BULK-PRO-', 1, NOW(3))
ON DUPLICATE KEY UPDATE `key` = `key`;


-- Migration: 20260424000000_discount_reasons_lookup
-- C.4: Create discount_reasons lookup table and FK on sales.discount_reason
-- C.6: Add is_voided flag to sales

-- 1. Lookup table
CREATE TABLE `discount_reasons` (
  `code`              VARCHAR(32)  NOT NULL,
  `label_ar`          VARCHAR(128) NOT NULL,
  `customer_label_ar` VARCHAR(128) NOT NULL,
  `is_active`         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Seed with the canonical reason codes.
--    Any existing free-text discount_reason values MUST match one of these codes
--    (the backfill step below coerces unknowns to 'OTHER').
INSERT INTO `discount_reasons` (`code`, `label_ar`, `customer_label_ar`) VALUES
  ('STAFF_DISCOUNT', 'خصم موظف',      'خصم موظف'),
  ('LOYAL_CUSTOMER', 'عميل مميز',     'خصم عميل مميز'),
  ('DAMAGED_ITEM',   'منتج تالف',     'خصم منتج تالف'),
  ('MANAGER_COMP',   'مجاملة إدارة',  'خصم إداري'),
  ('PROMO',          'عرض ترويجي',    'عرض ترويجي'),
  ('OTHER',          'أخرى',          'خصم');

-- 3. Coerce any free-text discount_reason that isn't in the seed to 'OTHER'
--    so the FK constraint can be added without violating referential integrity.
UPDATE `sales`
SET    `discount_reason` = 'OTHER'
WHERE  `discount_reason` IS NOT NULL
  AND  `discount_reason` NOT IN (
         'STAFF_DISCOUNT', 'LOYAL_CUSTOMER', 'DAMAGED_ITEM',
         'MANAGER_COMP', 'PROMO', 'OTHER'
       );

-- 4. Add FK constraint (RESTRICT prevents deleting a reason that is in use)
ALTER TABLE `sales`
  ADD CONSTRAINT `fk_sales_discount_reason`
  FOREIGN KEY (`discount_reason`)
  REFERENCES `discount_reasons` (`code`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 5. Add is_voided column (C.6)
ALTER TABLE `sales`
  ADD COLUMN `is_voided` TINYINT(1) NOT NULL DEFAULT 0
  AFTER `discount_reason`;

-- 6. Index to speed up Z-report query (non-voided COMPLETED sales per shift)
CREATE INDEX `idx_sales_shift_voided`
  ON `sales` (`shift_id`, `status`, `is_voided`);


-- Migration: 20260424170714_make_bulk_payment_order_optional
-- Make BulkPayment.order_id nullable to allow old-debt payments with no linked order.
ALTER TABLE `bulk_payments` MODIFY `order_id` INTEGER NULL;

-- Rename FK to Prisma's naming convention (fk_sales_discount_reason → sales_discount_reason_fkey).
-- Drop the manually-named FK first, then re-add under Prisma's name.
ALTER TABLE `sales` DROP FOREIGN KEY `fk_sales_discount_reason`;
ALTER TABLE `sales` ADD CONSTRAINT `sales_discount_reason_fkey`
  FOREIGN KEY (`discount_reason`) REFERENCES `discount_reasons`(`code`)
  ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260523000001_add_client_last_branch_zone
-- AlterTable: add last_branch_id and last_zone_id to clients
ALTER TABLE `clients` ADD COLUMN `last_branch_id` INTEGER NULL;
ALTER TABLE `clients` ADD COLUMN `last_zone_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_last_branch_id_fkey` FOREIGN KEY (`last_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_last_zone_id_fkey` FOREIGN KEY (`last_zone_id`) REFERENCES `delivery_zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260617000000_add_enable_pos_delivery
-- AlterTable: add enable_pos_delivery toggle to system_configuration
ALTER TABLE `system_configuration` ADD COLUMN `enable_pos_delivery` BOOLEAN NOT NULL DEFAULT true;


-- Migration: 20260617120000_add_warehouse_transfer_management
-- AlterTable: extend Module enum with WAREHOUSE_TRANSFER_MANAGEMENT permission
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'WAREHOUSE_TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION', 'INITIAL_INVENTORY', 'CALL_CENTER', 'BULK_POS', 'BULK_CUSTOMERS', 'BULK_PRICING', 'BULK_CREDIT', 'BULK_REPORTS') NOT NULL;

-- AlterTable: add accepted_by_id to stock_transfers for approval tracking
ALTER TABLE `stock_transfers` ADD COLUMN `accepted_by_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_accepted_by_id_fkey` FOREIGN KEY (`accepted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260626030300_add_expense_categories
-- CreateTable: expense_categories
CREATE TABLE `expense_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `expense_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default Arabic expense categories
INSERT INTO `expense_categories` (`name`, `is_active`, `created_at`, `updated_at`) VALUES
('كهرباء', true, NOW(), NOW()),
('مياه', true, NOW(), NOW()),
('غاز', true, NOW(), NOW()),
('إيجار', true, NOW(), NOW()),
('صيانة', true, NOW(), NOW()),
('مرتبات', true, NOW(), NOW()),
('نثريات', true, NOW(), NOW()),
('إنترنت', true, NOW(), NOW()),
('مشتريات', true, NOW(), NOW()),
('نقل وتوزيع', true, NOW(), NOW());

-- AlterTable: add category_id to expenses
ALTER TABLE `expenses`
ADD COLUMN `category_id` INTEGER NULL AFTER `shift_id`;

-- CreateIndex
CREATE INDEX `expenses_category_id_idx` ON `expenses`(`category_id`);

-- AddForeignKey
ALTER TABLE `expenses`
ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260716000000_repair_permissions_module_enum
-- Repair the `permissions.module` ENUM on databases where an earlier boot-time
-- script had rewritten it to a stale list that omitted WAREHOUSE_TRANSFER_MANAGEMENT
-- (which caused a 500 on PUT /superadmin/roles/:id/permissions).
--
-- This is a NON-DESTRUCTIVE, superset-only MODIFY: enlarging a MySQL ENUM keeps
-- every existing row intact. It does not touch, delete, or drop any data. The
-- value list is generated from backend/config/modules.js (the single source of
-- truth) and is verified against prisma/schema.prisma by
-- tests/unit/moduleEnum.test.js.
ALTER TABLE `permissions` MODIFY `module` ENUM('HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS','PURCHASES','SALES','REPORTS','TREASURIES','CASH_TRANSFER','TRANSFER_MANAGEMENT','WAREHOUSE_TRANSFER_MANAGEMENT','BRANCHES','EMPLOYEES','CLIENTS','SUPPLIERS','SUPPLIER_ACCOUNTS','CATEGORIES','ITEMS','WAREHOUSES','SETTINGS','EXPENSES','SHIFTS','DELIVERY_SETTLEMENT','CREATES_WAREHOUSES','CREATES_EMPLOYEES','CREATES_SUPPLIERS','CREATES_CLIENTS','CREATES_CATEGORIES','CREATES_ITEMS','CREATES_TREASURIES','CREATES_BRANCHES','DEPOSITS','CREATES_DEPOSITS','WITHDRAWALS','CREATES_WITHDRAWALS','DELIVERY_MEN','CREATES_DELIVERY_MEN','DELIVERY_ZONES','CREATES_DELIVERY_ZONES','CREATES_PRODUCTION','PRODUCTION','INITIAL_INVENTORY','CALL_CENTER','BULK_POS','BULK_CUSTOMERS','BULK_PRICING','BULK_CREDIT','BULK_REPORTS') NOT NULL;


-- Migration: 20260717000000_add_opening_cost_and_cogs
-- AlterTable: opening-inventory purchase cost (additive, nullable)
ALTER TABLE `initial_inventory`
ADD COLUMN `unit_cost` DECIMAL(10, 2) NULL AFTER `quantity`;

-- AlterTable: COGS snapshot on each sale line (additive, defaulted)
ALTER TABLE `sale_items`
ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total`;


-- Migration: 20260723000000_add_returns_permission_modules
-- Add SALES_RETURNS and PURCHASE_RETURNS to the `permissions.module` ENUM.
--
-- Creating a return moves money out of a treasury and stock back into a
-- warehouse, so it is gated separately from POS/SALES/PURCHASES instead of
-- being implied by them.
--
-- This is a NON-DESTRUCTIVE, superset-only MODIFY: enlarging a MySQL ENUM keeps
-- every existing row intact. It does not touch, delete, or drop any data. The
-- value list is generated from backend/config/modules.js (the single source of
-- truth) and is verified against prisma/schema.prisma by
-- tests/unit/moduleEnum.test.js.
ALTER TABLE `permissions` MODIFY `module` ENUM('HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS','PURCHASES','SALES','REPORTS','TREASURIES','CASH_TRANSFER','TRANSFER_MANAGEMENT','WAREHOUSE_TRANSFER_MANAGEMENT','BRANCHES','EMPLOYEES','CLIENTS','SUPPLIERS','SUPPLIER_ACCOUNTS','CATEGORIES','ITEMS','WAREHOUSES','SETTINGS','EXPENSES','SHIFTS','DELIVERY_SETTLEMENT','CREATES_WAREHOUSES','CREATES_EMPLOYEES','CREATES_SUPPLIERS','CREATES_CLIENTS','CREATES_CATEGORIES','CREATES_ITEMS','CREATES_TREASURIES','CREATES_BRANCHES','DEPOSITS','CREATES_DEPOSITS','WITHDRAWALS','CREATES_WITHDRAWALS','DELIVERY_MEN','CREATES_DELIVERY_MEN','DELIVERY_ZONES','CREATES_DELIVERY_ZONES','CREATES_PRODUCTION','PRODUCTION','INITIAL_INVENTORY','CALL_CENTER','BULK_POS','BULK_CUSTOMERS','BULK_PRICING','BULK_CREDIT','BULK_REPORTS','SALES_RETURNS','PURCHASE_RETURNS') NOT NULL;


-- Migration: 20260724000000_add_hr_branch_treasury_shift
-- Add branch/shift attribution to HR operations and treasury/shift to payrolls.
--
-- Advances & deductions can now record the branch they belong to (defaulting to
-- the employee's branch) and the active shift they were entered under. Salary
-- payments record which treasury was debited and the shift in effect.
--
-- This is a NON-DESTRUCTIVE, ADD-ONLY migration: every new column is NULLABLE
-- and every foreign key is ON DELETE SET NULL. No existing column is dropped,
-- renamed, retyped, or made NOT NULL, and no table is dropped or recreated, so
-- all existing employee_transactions and payrolls rows are left fully intact.

-- AlterTable
ALTER TABLE `employee_transactions` ADD COLUMN `branch_id` INTEGER NULL,
    ADD COLUMN `shift_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `payrolls` ADD COLUMN `shift_id` INTEGER NULL,
    ADD COLUMN `treasury_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `employee_transactions` ADD CONSTRAINT `employee_transactions_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_transactions` ADD CONSTRAINT `employee_transactions_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Migration: 20260729000000_widen_quantity_decimal_precision
-- Widen quantity columns from DECIMAL(10, 6) (max 9,999.999999) to
-- DECIMAL(18, 6) (max 999,999,999,999.999999). The old precision only allowed
-- 4 integer digits, so any quantity >= 10,000 overflowed and MySQL rejected the
-- write (surfacing as a 500 on initial-inventory and production). Widening a
-- decimal column is non-destructive: existing values are preserved.

ALTER TABLE `inventory`
MODIFY COLUMN `quantity` DECIMAL(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE `initial_inventory`
MODIFY COLUMN `quantity` DECIMAL(18, 6) NOT NULL;

ALTER TABLE `production_order_items`
MODIFY COLUMN `quantity_used` DECIMAL(18, 6) NOT NULL;


