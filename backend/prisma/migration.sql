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
ALTER TABLE `_categorytoitem` DROP FOREIGN KEY `_CategoryToItem_A_fkey`;

-- DropForeignKey
ALTER TABLE `_categorytoitem` DROP FOREIGN KEY `_CategoryToItem_B_fkey`;

-- DropForeignKey
ALTER TABLE `_itemtosupplier` DROP FOREIGN KEY `_ItemToSupplier_A_fkey`;

-- DropForeignKey
ALTER TABLE `_itemtosupplier` DROP FOREIGN KEY `_ItemToSupplier_B_fkey`;

-- DropTable
DROP TABLE `_categorytoitem`;

-- DropTable
DROP TABLE `_itemtosupplier`;

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
    `date` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
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


-- Migration: 20260417000001_ramex_store_schema_extensions
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


-- Migration: 20260417000002_fabric_rolls_phase3
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


-- Migration: 20260417000003_phase4_purchases_landed_cost
-- Phase 4: Purchases — International + Landed Cost + Supplier Tax Number

-- Add clearance cost, landed cost enabled flag, and allocation method to purchases
ALTER TABLE `purchases`
  ADD COLUMN `clearance_cost` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `other_landing_costs`,
  ADD COLUMN `landed_cost_enabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `clearance_cost`,
  ADD COLUMN `landed_cost_allocation` ENUM('NONE','BY_VALUE','BY_QUANTITY','MANUAL') NOT NULL DEFAULT 'NONE' AFTER `landed_cost_enabled`;

-- Add per-line landed cost tracking to purchase_items
ALTER TABLE `purchase_items`
  ADD COLUMN `allocated_landed_cost` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `final_unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add supplier tax number
ALTER TABLE `suppliers`
  ADD COLUMN `tax_number` VARCHAR(191) NOT NULL DEFAULT '';

-- Feature flag for landed cost UI
ALTER TABLE `system_configuration`
  ADD COLUMN `landed_cost_feature_enabled` BOOLEAN NOT NULL DEFAULT FALSE;


-- Migration: 20260418000001_phase5_inventory_ops
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


-- Migration: 20260420000001_ramex_report_indexes
-- AddIndex for reporting queries
CREATE INDEX `sales_created_at_branch_id_idx` ON `sales`(`created_at`, `branch_id`);
CREATE INDEX `sale_items_item_id_sale_id_idx` ON `sale_items`(`item_id`, `sale_id`);
CREATE INDEX `purchase_items_item_id_purchase_id_idx` ON `purchase_items`(`item_id`, `purchase_id`);


-- Migration: 20260420000002_add_initial_inventory_module
-- AlterEnum: Add INITIAL_INVENTORY to Module enum in permissions table
ALTER TABLE `permissions` MODIFY COLUMN `module` ENUM(
  'HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS',
  'PURCHASES','SALES','REPORTS','TREASURIES','CASH_TRANSFER',
  'TRANSFER_MANAGEMENT','BRANCHES','EMPLOYEES','CLIENTS','SUPPLIERS',
  'SUPPLIER_ACCOUNTS','CATEGORIES','ITEMS','WAREHOUSES','SETTINGS',
  'EXPENSES','SHIFTS','DELIVERY_SETTLEMENT',
  'CREATES_WAREHOUSES','CREATES_EMPLOYEES','CREATES_SUPPLIERS',
  'CREATES_CLIENTS','CREATES_CATEGORIES','CREATES_ITEMS',
  'CREATES_TREASURIES','CREATES_BRANCHES',
  'DEPOSITS','CREATES_DEPOSITS','WITHDRAWALS','CREATES_WITHDRAWALS',
  'DELIVERY_MEN','CREATES_DELIVERY_MEN','DELIVERY_ZONES','CREATES_DELIVERY_ZONES',
  'CREATES_PRODUCTION','PRODUCTION',
  'FABRIC_ROLLS','CREATES_FABRIC_ROLLS','ADJUSTMENTS','COUNTS',
  'OWNER_DASHBOARD','INITIAL_INVENTORY'
) NOT NULL;


-- Migration: 20260421000001_phase8_settings_theme_audit
-- Alter permissions enum to include audit viewer access
ALTER TABLE `permissions`
    MODIFY `module` ENUM(
      'HR',
      'INVENTORY',
      'INVENTORY_COUNT',
      'STOCK_TRANSFER',
      'POS',
      'PURCHASES',
      'SALES',
      'REPORTS',
      'TREASURIES',
      'CASH_TRANSFER',
      'TRANSFER_MANAGEMENT',
      'BRANCHES',
      'EMPLOYEES',
      'CLIENTS',
      'SUPPLIERS',
      'SUPPLIER_ACCOUNTS',
      'CATEGORIES',
      'ITEMS',
      'WAREHOUSES',
      'SETTINGS',
      'EXPENSES',
      'SHIFTS',
      'DELIVERY_SETTLEMENT',
      'CREATES_WAREHOUSES',
      'CREATES_EMPLOYEES',
      'CREATES_SUPPLIERS',
      'CREATES_CLIENTS',
      'CREATES_CATEGORIES',
      'CREATES_ITEMS',
      'CREATES_TREASURIES',
      'CREATES_BRANCHES',
      'DEPOSITS',
      'CREATES_DEPOSITS',
      'WITHDRAWALS',
      'CREATES_WITHDRAWALS',
      'DELIVERY_MEN',
      'CREATES_DELIVERY_MEN',
      'DELIVERY_ZONES',
      'CREATES_DELIVERY_ZONES',
      'CREATES_PRODUCTION',
      'PRODUCTION',
      'FABRIC_ROLLS',
      'CREATES_FABRIC_ROLLS',
      'ADJUSTMENTS',
      'COUNTS',
      'OWNER_DASHBOARD',
      'INITIAL_INVENTORY',
      'AUDIT'
    ) NOT NULL;

ALTER TABLE `system_configuration`
    ADD COLUMN `company_name_english` VARCHAR(191) NOT NULL DEFAULT 'Ramex Store' AFTER `company_name`,
    ADD COLUMN `address` TEXT NOT NULL AFTER `tax_number`,
    ADD COLUMN `phone_number` VARCHAR(191) NOT NULL DEFAULT '' AFTER `address`,
    ADD COLUMN `logo_url` VARCHAR(191) NOT NULL DEFAULT '' AFTER `phone_number`,
    ADD COLUMN `theme_key` VARCHAR(191) NOT NULL DEFAULT 'ramex-store' AFTER `logo_url`,
    ADD COLUMN `tax_enabled_on_purchases` BOOLEAN NOT NULL DEFAULT false AFTER `tax_enabled_on_sales`,
    ADD COLUMN `tax_enabled_on_expenses` BOOLEAN NOT NULL DEFAULT false AFTER `tax_enabled_on_purchases`,
    ADD COLUMN `session_timeout_minutes` INTEGER NOT NULL DEFAULT 720 AFTER `evening_shift_end`,
    ADD COLUMN `password_min_length` INTEGER NOT NULL DEFAULT 8 AFTER `session_timeout_minutes`,
    ADD COLUMN `password_require_uppercase` BOOLEAN NOT NULL DEFAULT true AFTER `password_min_length`,
    ADD COLUMN `password_require_lowercase` BOOLEAN NOT NULL DEFAULT true AFTER `password_require_uppercase`,
    ADD COLUMN `password_require_number` BOOLEAN NOT NULL DEFAULT true AFTER `password_require_lowercase`,
    ADD COLUMN `password_require_special_char` BOOLEAN NOT NULL DEFAULT true AFTER `password_require_number`;


