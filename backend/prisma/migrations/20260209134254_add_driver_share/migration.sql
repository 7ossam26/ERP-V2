-- AlterTable
ALTER TABLE `delivery_zones` ADD COLUMN `driver_share` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `delivery_driver_share` DECIMAL(10, 2) NULL;
