-- C.4: Create discount_reasons lookup table and FK on sales.discount_reason
-- C.6: Add is_voided flag to sales

-- 1. Lookup table
CREATE TABLE `discount_reasons` (
  `code`              VARCHAR(32)  NOT NULL,
  `label_ar`          VARCHAR(128) NOT NULL,
  `customer_label_ar` VARCHAR(128) NOT NULL,
  `is_active`         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Seed with the canonical reason codes.
--    Any existing free-text discount_reason values MUST match one of these codes
--    (the backfill step below coerces unknowns to 'OTHER').
INSERT INTO `discount_reasons` (`code`, `label_ar`, `customer_label_ar`) VALUES
  ('STAFF_DISCOUNT', 'خصم موظف',      'خصم موظف'),
  ('LOYAL_CUSTOMER', 'عميل مميز',     'خصم عميل مميز'),
  ('DAMAGED_ITEM',   'منتج تالف',     'خصم منتج تالف'),
  ('MANAGER_COMP',   'مجاملة إدارة',  'خصم إداري'),
  ('PROMO',          'عرض ترويجي',    'عرض ترويجي'),
  ('OTHER',          'أخرى',          'خصم');

-- 3. Coerce any free-text discount_reason that isn't in the seed to 'OTHER'
--    so the FK constraint can be added without violating referential integrity.
UPDATE `sales`
SET    `discount_reason` = 'OTHER'
WHERE  `discount_reason` IS NOT NULL
  AND  `discount_reason` NOT IN (
         'STAFF_DISCOUNT', 'LOYAL_CUSTOMER', 'DAMAGED_ITEM',
         'MANAGER_COMP', 'PROMO', 'OTHER'
       );

-- 4. Add FK constraint (RESTRICT prevents deleting a reason that is in use)
ALTER TABLE `sales`
  ADD CONSTRAINT `fk_sales_discount_reason`
  FOREIGN KEY (`discount_reason`)
  REFERENCES `discount_reasons` (`code`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 5. Add is_voided column (C.6)
ALTER TABLE `sales`
  ADD COLUMN `is_voided` TINYINT(1) NOT NULL DEFAULT 0
  AFTER `discount_reason`;

-- 6. Index to speed up Z-report query (non-voided COMPLETED sales per shift)
CREATE INDEX `idx_sales_shift_voided`
  ON `sales` (`shift_id`, `status`, `is_voided`);
