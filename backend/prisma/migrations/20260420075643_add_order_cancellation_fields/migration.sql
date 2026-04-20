-- AlterTable
ALTER TABLE `orders` ADD COLUMN `cancellation_note` TEXT NULL,
    ADD COLUMN `cancellation_reason` ENUM('CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'WRONG_ADDRESS', 'NO_ANSWER', 'DUPLICATE', 'OTHER') NULL,
    ADD COLUMN `cancelled_by_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_cancelled_by_id_fkey` FOREIGN KEY (`cancelled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
