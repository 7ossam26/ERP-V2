-- AlterTable: add enable_pos_delivery toggle to system_configuration
ALTER TABLE `system_configuration` ADD COLUMN `enable_pos_delivery` BOOLEAN NOT NULL DEFAULT true;
