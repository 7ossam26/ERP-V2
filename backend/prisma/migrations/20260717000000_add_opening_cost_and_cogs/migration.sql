-- AlterTable: opening-inventory purchase cost (additive, nullable)
ALTER TABLE `initial_inventory`
ADD COLUMN `unit_cost` DECIMAL(10, 2) NULL AFTER `quantity`;

-- AlterTable: COGS snapshot on each sale line (additive, defaulted)
ALTER TABLE `sale_items`
ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total`;
