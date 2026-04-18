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
