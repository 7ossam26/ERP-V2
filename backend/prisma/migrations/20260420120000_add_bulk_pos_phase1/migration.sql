-- AlterTable: extend Module enum with BULK_* permissions
ALTER TABLE `permissions` MODIFY `module` ENUM('HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS', 'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS', 'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES', 'SHIFTS', 'DELIVERY_SETTLEMENT', 'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS', 'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES', 'DEPOSITS', 'CREATES_DEPOSITS', 'WITHDRAWALS', 'CREATES_WITHDRAWALS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN', 'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION', 'PRODUCTION', 'INITIAL_INVENTORY', 'CALL_CENTER', 'BULK_POS', 'BULK_CUSTOMERS', 'BULK_PRICING', 'BULK_CREDIT', 'BULK_REPORTS') NOT NULL;

-- CreateTable
CREATE TABLE `bulk_customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(200) NOT NULL,
    `trade_name` VARCHAR(200) NULL,
    `tax_number` VARCHAR(50) NULL,
    `primary_contact_name` VARCHAR(120) NOT NULL,
    `primary_contact_phone` VARCHAR(40) NOT NULL,
    `primary_contact_email` VARCHAR(120) NULL,
    `shipping_address` TEXT NOT NULL,
    `credit_limit` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bulk_customers_tax_number_key`(`tax_number`),
    INDEX `bulk_customers_company_name_idx`(`company_name`),
    INDEX `bulk_customers_primary_contact_phone_idx`(`primary_contact_phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_customer_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(120) NULL,
    `role` VARCHAR(60) NULL,

    INDEX `bulk_customer_contacts_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_contract_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `created_by_user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bulk_contract_prices_customer_id_item_id_key`(`customer_id`, `item_id`),
    INDEX `bulk_contract_prices_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_number` VARCHAR(191) NULL,
    `customer_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'QUOTED', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'RETURNED') NOT NULL DEFAULT 'DRAFT',
    `subtotal_inclusive` DECIMAL(12, 2) NOT NULL,
    `tax_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0.14,
    `net_amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance_due` DECIMAL(12, 2) NOT NULL,
    `scheduled_pickup_date` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancelled_by_user_id` INTEGER NULL,
    `cancel_reason` TEXT NULL,
    `returned_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bulk_orders_order_number_key`(`order_number`),
    INDEX `bulk_orders_customer_id_status_idx`(`customer_id`, `status`),
    INDEX `bulk_orders_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `line_total` DECIMAL(12, 2) NOT NULL,

    INDEX `bulk_order_items_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `type` ENUM('PROFORMA', 'TAX_INVOICE', 'SALES_RECEIPT', 'CREDIT_NOTE') NOT NULL,
    `document_number` VARCHAR(191) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issued_by_user_id` INTEGER NOT NULL,
    `snapshot` JSON NULL,

    UNIQUE INDEX `bulk_documents_document_number_key`(`document_number`),
    INDEX `bulk_documents_order_id_type_idx`(`order_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulk_number_sequences` (
    `key` VARCHAR(191) NOT NULL,
    `next_value` INTEGER NOT NULL DEFAULT 1,
    `prefix` VARCHAR(20) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bulk_customers` ADD CONSTRAINT `bulk_customers_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_customer_contacts` ADD CONSTRAINT `bulk_customer_contacts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_cancelled_by_user_id_fkey` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_order_items` ADD CONSTRAINT `bulk_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_order_items` ADD CONSTRAINT `bulk_order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulk_documents` ADD CONSTRAINT `bulk_documents_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed numbering sequences
INSERT INTO `bulk_number_sequences` (`key`, `next_value`, `prefix`, `updated_at`) VALUES
  ('ORDER', 1, 'BULK-', NOW(3)),
  ('SALES_RECEIPT', 1, 'BULK-RCP-', NOW(3)),
  ('TAX_INVOICE', 1, 'BULK-TAX-', NOW(3)),
  ('CREDIT_NOTE', 1, 'BULK-CN-', NOW(3))
ON DUPLICATE KEY UPDATE `prefix` = VALUES(`prefix`);
