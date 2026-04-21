-- Phase 3: Shift reconciliation — persist expected Visa / Instapay totals
-- so digital payment reconciliation is auto-trusted and auditable.

ALTER TABLE `shifts`
  ADD COLUMN `expected_visa` DECIMAL(10, 2) NULL,
  ADD COLUMN `expected_instapay` DECIMAL(10, 2) NULL;
