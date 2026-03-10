-- AlterTable: Add RETURNED to PaymentStatus enum
ALTER TABLE `purchases` MODIFY COLUMN `payment_status` ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID', 'RETURNED') NOT NULL DEFAULT 'UNPAID';
