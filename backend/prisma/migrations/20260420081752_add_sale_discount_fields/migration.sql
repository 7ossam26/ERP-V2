-- AlterTable
ALTER TABLE `sales` ADD COLUMN `discount_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `discount_type` ENUM('PERCENTAGE', 'VALUE') NULL,
    ADD COLUMN `discount_value` DECIMAL(10, 2) NULL;
