-- Add status, cancellation tracking, and linked order to production_orders

ALTER TABLE `production_orders`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN `cancelled_by_id` INTEGER NULL,
  ADD COLUMN `cancelled_at` DATETIME(3) NULL,
  ADD COLUMN `linked_order_id` INTEGER NULL;

-- AddForeignKey production_orders -> users (cancelled_by)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_cancelled_by_id_fkey`
  FOREIGN KEY (`cancelled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey production_orders -> production_orders (linked_order self-relation)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_linked_order_id_fkey`
  FOREIGN KEY (`linked_order_id`) REFERENCES `production_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
