-- Link a POS return (a negative REFUND- sale) to the invoice it returns.
--
-- WHY
-- ---
-- A return used to be booked to the ORIGINAL invoice's shift while its cash
-- left the drawer of the shift open at return time, so returning yesterday's
-- invoice showed up as an unexplained shortage today and rewrote yesterday's
-- closed report. Returns now land on the current open shift, and the close
-- report lists the ones whose invoice belongs to another shift
-- ("مرتجع فواتير سابقة"). That needs to know the original invoice, which until
-- now was only written into the free-text `notes`.
--
-- NON-DESTRUCTIVE, ADD-ONLY. The column is NULL on every existing row; no
-- backfill. Every refund made before this sits on its original invoice's
-- shift, so none of them is a previous-invoice return and no historical shift
-- figure changes. The FK is ON DELETE SET NULL. Nothing is dropped, renamed or
-- retyped.

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `refund_of_sale_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `sales_refund_of_sale_id_idx` ON `sales`(`refund_of_sale_id`);

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_refund_of_sale_id_fkey` FOREIGN KEY (`refund_of_sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
