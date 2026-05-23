-- AlterTable: add last_branch_id and last_zone_id to clients
ALTER TABLE `clients` ADD COLUMN `last_branch_id` INTEGER NULL;
ALTER TABLE `clients` ADD COLUMN `last_zone_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_last_branch_id_fkey` FOREIGN KEY (`last_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_last_zone_id_fkey` FOREIGN KEY (`last_zone_id`) REFERENCES `delivery_zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
