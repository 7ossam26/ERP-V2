-- Add PROFORMA row to bulk_number_sequences so proforma documents get
-- unique sequential numbers (prefix BULK-PRO-).
INSERT INTO `bulk_number_sequences` (`key`, `prefix`, `next_value`)
VALUES ('PROFORMA', 'BULK-PRO-', 1)
ON DUPLICATE KEY UPDATE `key` = `key`;
