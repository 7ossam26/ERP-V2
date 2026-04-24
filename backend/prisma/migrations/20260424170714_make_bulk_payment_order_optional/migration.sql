-- Make BulkPayment.order_id nullable to allow old-debt payments with no linked order.
ALTER TABLE `bulk_payments` MODIFY `order_id` INTEGER NULL;

-- Rename FK to Prisma's naming convention (fk_sales_discount_reason → sales_discount_reason_fkey).
-- Drop the manually-named FK first, then re-add under Prisma's name.
ALTER TABLE `sales` DROP FOREIGN KEY `fk_sales_discount_reason`;
ALTER TABLE `sales` ADD CONSTRAINT `sales_discount_reason_fkey`
  FOREIGN KEY (`discount_reason`) REFERENCES `discount_reasons`(`code`)
  ON DELETE SET NULL ON UPDATE CASCADE;
