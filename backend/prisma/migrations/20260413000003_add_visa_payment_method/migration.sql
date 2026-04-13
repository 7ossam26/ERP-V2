-- Migration: add_visa_payment_method
-- Add VISA as a new payment method for POS sales (routed to bank treasury like INSTAPAY)

-- Add VISA to the SalePaymentMethod enum
ALTER TABLE `sales` MODIFY COLUMN `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA') NOT NULL DEFAULT 'CASH';
