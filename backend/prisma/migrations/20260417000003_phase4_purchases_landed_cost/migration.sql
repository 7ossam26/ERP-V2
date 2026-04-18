-- Phase 4: Purchases — International + Landed Cost + Supplier Tax Number

-- Add clearance cost, landed cost enabled flag, and allocation method to purchases
ALTER TABLE `purchases`
  ADD COLUMN `clearance_cost` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `other_landing_costs`,
  ADD COLUMN `landed_cost_enabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `clearance_cost`,
  ADD COLUMN `landed_cost_allocation` ENUM('NONE','BY_VALUE','BY_QUANTITY','MANUAL') NOT NULL DEFAULT 'NONE' AFTER `landed_cost_enabled`;

-- Add per-line landed cost tracking to purchase_items
ALTER TABLE `purchase_items`
  ADD COLUMN `allocated_landed_cost` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `final_unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add supplier tax number
ALTER TABLE `suppliers`
  ADD COLUMN `tax_number` VARCHAR(191) NOT NULL DEFAULT '';

-- Feature flag for landed cost UI
ALTER TABLE `system_configuration`
  ADD COLUMN `landed_cost_feature_enabled` BOOLEAN NOT NULL DEFAULT FALSE;
