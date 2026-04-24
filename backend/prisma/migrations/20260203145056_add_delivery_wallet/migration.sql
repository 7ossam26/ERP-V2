/*
  Warnings:

  - A unique constraint covering the columns `[branch_id,name]` on the table `delivery_zones` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `delivery_zones_name_key` ON `delivery_zones`;

-- AlterTable
ALTER TABLE `delivery_men` ADD COLUMN `wallet_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `delivery_zones` ADD COLUMN `branch_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `delivery_man_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `delivery_man_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `delivery_zones_branch_id_name_key` ON `delivery_zones`(`branch_id`, `name`);

-- AddForeignKey
ALTER TABLE `delivery_man_transactions` ADD CONSTRAINT `delivery_man_transactions_delivery_man_id_fkey` FOREIGN KEY (`delivery_man_id`) REFERENCES `delivery_men`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_man_transactions` ADD CONSTRAINT `delivery_man_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_zones` ADD CONSTRAINT `delivery_zones_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
