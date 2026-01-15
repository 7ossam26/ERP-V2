-- AlterTable
ALTER TABLE `items` ADD COLUMN `reorder_point` INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE `inventory` (
    `item_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`item_id`, `warehouse_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `from_treasury_id` INTEGER NOT NULL,
    `to_treasury_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configuration` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `company_name` VARCHAR(191) NOT NULL DEFAULT 'ERP System',
    `main_warehouse_id` INTEGER NULL,
    `main_treasury_id` INTEGER NULL,
    `bank_treasury_id` INTEGER NULL,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 14.0,
    `salary_start_day` INTEGER NOT NULL DEFAULT 1,
    `salary_end_day` INTEGER NOT NULL DEFAULT 30,
    `shift_start_time` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `shift_end_time` VARCHAR(191) NOT NULL DEFAULT '17:00',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transfer_number` VARCHAR(191) NOT NULL,
    `from_warehouse_id` INTEGER NOT NULL,
    `to_warehouse_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_transfers_transfer_number_key`(`transfer_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_transfer_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_from_treasury_id_fkey` FOREIGN KEY (`from_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_to_treasury_id_fkey` FOREIGN KEY (`to_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration` ADD CONSTRAINT `system_configuration_main_warehouse_id_fkey` FOREIGN KEY (`main_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration` ADD CONSTRAINT `system_configuration_main_treasury_id_fkey` FOREIGN KEY (`main_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration` ADD CONSTRAINT `system_configuration_bank_treasury_id_fkey` FOREIGN KEY (`bank_treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_warehouse_id_fkey` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_warehouse_id_fkey` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_stock_transfer_id_fkey` FOREIGN KEY (`stock_transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
