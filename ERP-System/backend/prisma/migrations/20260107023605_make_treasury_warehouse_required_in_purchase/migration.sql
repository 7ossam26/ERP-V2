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
