-- Widen quantity columns from DECIMAL(10, 6) (max 9,999.999999) to
-- DECIMAL(18, 6) (max 999,999,999,999.999999). The old precision only allowed
-- 4 integer digits, so any quantity >= 10,000 overflowed and MySQL rejected the
-- write (surfacing as a 500 on initial-inventory and production). Widening a
-- decimal column is non-destructive: existing values are preserved.

ALTER TABLE `inventory`
MODIFY COLUMN `quantity` DECIMAL(18, 6) NOT NULL DEFAULT 0;

ALTER TABLE `initial_inventory`
MODIFY COLUMN `quantity` DECIMAL(18, 6) NOT NULL;

ALTER TABLE `production_order_items`
MODIFY COLUMN `quantity_used` DECIMAL(18, 6) NOT NULL;
