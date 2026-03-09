-- Add PRODUCTION to permissions enum
ALTER TABLE `permissions` MODIFY `module` ENUM(
  'HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES',
  'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT',
  'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS',
  'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS',
  'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES',
  'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS',
  'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS',
  'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN',
  'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION'
) NOT NULL;

-- CreateTable production_orders
CREATE TABLE `production_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bom_id` INTEGER NOT NULL,
    `source_warehouse_id` INTEGER NOT NULL,
    `dest_warehouse_id` INTEGER NULL,
    `target_output_qty` DECIMAL(10, 3) NOT NULL,
    `actual_output_qty` DECIMAL(10, 3) NOT NULL,
    `output_waste_qty` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `total_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable production_order_items
CREATE TABLE `production_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `production_order_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity_used` DECIMAL(10, 6) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey production_orders -> bom
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_bom_id_fkey`
    FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey production_orders -> warehouses (source)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_source_warehouse_id_fkey`
    FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey production_orders -> warehouses (dest)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_dest_warehouse_id_fkey`
    FOREIGN KEY (`dest_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey production_orders -> users (created_by)
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey production_order_items -> production_orders
ALTER TABLE `production_order_items` ADD CONSTRAINT `production_order_items_production_order_id_fkey`
    FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey production_order_items -> items
ALTER TABLE `production_order_items` ADD CONSTRAINT `production_order_items_item_id_fkey`
    FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
