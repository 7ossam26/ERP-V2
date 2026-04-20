-- DropIndex
DROP INDEX `sales_discount_reason_idx` ON `sales`;

-- CreateTable
CREATE TABLE `bulk_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `treasury_id` INTEGER NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_user_id` INTEGER NOT NULL,
    `bank_reference` VARCHAR(120) NULL,
    `cheque_number` VARCHAR(60) NULL,
    `cheque_due_date` DATETIME(3) NULL,
    `voided_at` DATETIME(3) NULL,
    `voided_by_user_id` INTEGER NULL,
    `void_reason` TEXT NULL,
    `notes` TEXT NULL,

    INDEX `bulk_payments_order_id_idx`(`order_id`),
    INDEX `bulk_payments_customer_id_received_at_idx`(`customer_id`, `received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_refunds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `method` ENUM('CASH_REFUND', 'CREDIT_NOTE') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` TEXT NULL,
    `treasury_id` INTEGER NULL,
    `credit_note_number` VARCHAR(191) NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bulk_refunds_credit_note_number_key`(`credit_note_number`),
    INDEX `bulk_refunds_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_voided_by_user_id_fkey` FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
