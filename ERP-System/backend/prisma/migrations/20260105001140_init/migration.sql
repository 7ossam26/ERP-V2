-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `branch` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `national_id` VARCHAR(191) NULL,
    `working_days_per_month` INTEGER NOT NULL DEFAULT 26,
    `working_hours_per_day` DECIMAL(4, 2) NOT NULL DEFAULT 8,
    `weekly_holiday` VARCHAR(191) NOT NULL DEFAULT 'Friday',
    `salary` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
