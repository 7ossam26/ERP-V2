-- Treasury scope + Visa/Instapay split + CARD removal
-- Phase 1 of Visa/Instapay treasuries feature.

-- ============================================
-- 1. Add Treasury.scope column
-- ============================================
ALTER TABLE `treasuries`
  ADD COLUMN `scope` ENUM('BRANCH_CASH', 'GLOBAL_VISA', 'GLOBAL_INSTAPAY', 'MAIN')
  NOT NULL DEFAULT 'BRANCH_CASH';

-- ============================================
-- 2. Backfill scope for existing rows
-- ============================================

-- Branch-linked treasuries stay BRANCH_CASH (default already applied).

-- Main treasury (referenced by system_configuration.main_treasury_id)
UPDATE `treasuries` t
  INNER JOIN `system_configuration` sc ON sc.`main_treasury_id` = t.`id`
SET t.`scope` = 'MAIN';

-- Existing bank treasury (will be renamed to Visa treasury below)
UPDATE `treasuries` t
  INNER JOIN `system_configuration` sc ON sc.`bank_treasury_id` = t.`id`
SET t.`scope` = 'GLOBAL_VISA', t.`name` = 'خزينة فيزا';

-- ============================================
-- 3. Rename SystemConfiguration.bank_treasury_id -> visa_treasury_id
-- ============================================

-- Drop existing FK so we can rename the column cleanly
ALTER TABLE `system_configuration`
  DROP FOREIGN KEY `system_configuration_bank_treasury_id_fkey`;

ALTER TABLE `system_configuration`
  CHANGE COLUMN `bank_treasury_id` `visa_treasury_id` INTEGER NULL;

ALTER TABLE `system_configuration`
  ADD CONSTRAINT `system_configuration_visa_treasury_id_fkey`
  FOREIGN KEY (`visa_treasury_id`) REFERENCES `treasuries`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 4. Add SystemConfiguration.instapay_treasury_id
-- ============================================
ALTER TABLE `system_configuration`
  ADD COLUMN `instapay_treasury_id` INTEGER NULL;

ALTER TABLE `system_configuration`
  ADD CONSTRAINT `system_configuration_instapay_treasury_id_fkey`
  FOREIGN KEY (`instapay_treasury_id`) REFERENCES `treasuries`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 5. Seed Instapay treasury + wire it up
-- ============================================

-- Create Instapay treasury if it doesn't already exist
INSERT INTO `treasuries` (`name`, `balance`, `scope`, `is_active`, `created_at`, `updated_at`)
SELECT 'خزينة انستاباي', 0, 'GLOBAL_INSTAPAY', 1, NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `treasuries` WHERE `scope` = 'GLOBAL_INSTAPAY' AND `is_active` = 1
);

-- Point system_configuration.instapay_treasury_id at it
UPDATE `system_configuration` sc
  INNER JOIN `treasuries` t ON t.`scope` = 'GLOBAL_INSTAPAY' AND t.`is_active` = 1
SET sc.`instapay_treasury_id` = t.`id`
WHERE sc.`id` = 1 AND sc.`instapay_treasury_id` IS NULL;

-- ============================================
-- 6. Migrate SalePaymentMethod: CARD -> VISA, then drop CARD
-- ============================================

-- Widen enum temporarily (VISA already exists, CARD already exists; this is defensive)
ALTER TABLE `sales`
  MODIFY `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA', 'CARD') NOT NULL DEFAULT 'CASH';

-- Migrate data
UPDATE `sales` SET `payment_method` = 'VISA' WHERE `payment_method` = 'CARD';

-- Drop CARD from the enum
ALTER TABLE `sales`
  MODIFY `payment_method` ENUM('CASH', 'INSTAPAY', 'VISA') NOT NULL DEFAULT 'CASH';
