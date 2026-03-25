-- Migration: increase_quantity_precision_add_instapay
-- Increase quantity precision from DECIMAL(10,2) to DECIMAL(10,4) across all transaction tables
-- Also rename SalePaymentMethod CARD -> INSTAPAY to match business terminology

-- SaleItem.quantity: 10,2 → 10,4
ALTER TABLE `sale_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- PurchaseItem.quantity: 10,2 → 10,4
ALTER TABLE `purchase_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- PurchaseReturnItem.quantity: 10,2 → 10,4
ALTER TABLE `purchase_return_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- StockTransferItem.quantity: 10,2 → 10,4
ALTER TABLE `stock_transfer_items` MODIFY COLUMN `quantity` DECIMAL(10,4) NOT NULL;

-- ProductionOrder qty fields: 10,3 → 10,4
ALTER TABLE `production_orders` MODIFY COLUMN `target_output_qty` DECIMAL(10,4) NOT NULL;
ALTER TABLE `production_orders` MODIFY COLUMN `actual_output_qty` DECIMAL(10,4) NOT NULL;
ALTER TABLE `production_orders` MODIFY COLUMN `output_waste_qty` DECIMAL(10,4) NOT NULL DEFAULT 0;

-- SalePaymentMethod: rename CARD -> INSTAPAY
-- Step 1: Add INSTAPAY to the enum
ALTER TABLE `sales` MODIFY COLUMN `payment_method` ENUM('CASH', 'CARD', 'INSTAPAY') NOT NULL DEFAULT 'CASH';
-- Step 2: Migrate existing CARD records to INSTAPAY
UPDATE `sales` SET `payment_method` = 'INSTAPAY' WHERE `payment_method` = 'CARD';
-- Step 3: Remove CARD from the enum
ALTER TABLE `sales` MODIFY COLUMN `payment_method` ENUM('CASH', 'INSTAPAY') NOT NULL DEFAULT 'CASH';
