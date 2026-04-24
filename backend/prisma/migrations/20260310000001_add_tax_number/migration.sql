-- Add tax_number to system_configuration
ALTER TABLE `system_configuration` ADD COLUMN `tax_number` VARCHAR(191) NOT NULL DEFAULT '';
