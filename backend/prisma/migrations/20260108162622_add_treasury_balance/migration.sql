-- AlterTable
ALTER TABLE `sales` ADD COLUMN `change_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `treasuries` ADD COLUMN `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0;
