-- AlterTable
ALTER TABLE `sales`
  ADD COLUMN `discount_reason` VARCHAR(32) NULL,
  ADD COLUMN `discount_applied_by_user_id` INT NULL;

-- AddForeignKey
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_discount_applied_by_user_id_fkey`
  FOREIGN KEY (`discount_applied_by_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `sales_discount_reason_idx` ON `sales`(`discount_reason`);
CREATE INDEX `sales_discount_applied_by_user_id_idx` ON `sales`(`discount_applied_by_user_id`);
