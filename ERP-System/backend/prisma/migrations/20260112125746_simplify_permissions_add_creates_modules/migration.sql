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
