-- AlterTable
ALTER TABLE `sales` ADD COLUMN `warehouse_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
