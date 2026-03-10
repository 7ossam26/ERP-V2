ALTER TABLE `audit_logs` ADD COLUMN `old_values` JSON NULL AFTER `details`;
