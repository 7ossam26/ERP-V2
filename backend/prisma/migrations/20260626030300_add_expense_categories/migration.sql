-- CreateTable: expense_categories
CREATE TABLE `expense_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `expense_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default Arabic expense categories
INSERT INTO `expense_categories` (`name`, `is_active`, `created_at`, `updated_at`) VALUES
('كهرباء', true, NOW(), NOW()),
('مياه', true, NOW(), NOW()),
('غاز', true, NOW(), NOW()),
('إيجار', true, NOW(), NOW()),
('صيانة', true, NOW(), NOW()),
('مرتبات', true, NOW(), NOW()),
('نثريات', true, NOW(), NOW()),
('إنترنت', true, NOW(), NOW()),
('مشتريات', true, NOW(), NOW()),
('نقل وتوزيع', true, NOW(), NOW());

-- AlterTable: add category_id to expenses
ALTER TABLE `expenses`
ADD COLUMN `category_id` INTEGER NULL AFTER `shift_id`;

-- CreateIndex
CREATE INDEX `expenses_category_id_idx` ON `expenses`(`category_id`);

-- AddForeignKey
ALTER TABLE `expenses`
ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
