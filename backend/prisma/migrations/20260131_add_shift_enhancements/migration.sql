-- AlterTable: User - Add reviewedShifts relation support
-- No actual column change needed, handled by Prisma relations

-- AlterTable: Shift - Add new shift management fields
ALTER TABLE `shifts`
ADD COLUMN `type` ENUM('MORNING', 'EVENING') NOT NULL DEFAULT 'MORNING' AFTER `branch_id`,
ADD COLUMN `system_expected_cash` DECIMAL(10, 2) NULL AFTER `end_cash`,
ADD COLUMN `actual_cash` DECIMAL(10, 2) NULL AFTER `system_expected_cash`,
ADD COLUMN `shortage` DECIMAL(10, 2) NULL AFTER `actual_cash`,
ADD COLUMN `reviewed_by_id` INTEGER NULL AFTER `status`,
ADD COLUMN `reviewed_at` DATETIME(3) NULL AFTER `reviewed_by_id`,
MODIFY COLUMN `status` ENUM(
    'OPEN',
    'PENDING_REVIEW',
    'CLOSED'
) NOT NULL DEFAULT 'OPEN';

-- CreateIndex: Add index for reviewed_by_id
CREATE INDEX `shifts_reviewed_by_id_idx` ON `shifts` (`reviewed_by_id`);

-- AddForeignKey: Link Shift to Manager (reviewer)
ALTER TABLE `shifts`
ADD CONSTRAINT `shifts_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SystemConfiguration - Add shift time configs
ALTER TABLE `system_configuration`
ADD COLUMN `morning_shift_start` VARCHAR(191) NOT NULL DEFAULT '09:00' AFTER `shift_end_time`,
ADD COLUMN `morning_shift_end` VARCHAR(191) NOT NULL DEFAULT '17:00' AFTER `morning_shift_start`,
ADD COLUMN `evening_shift_start` VARCHAR(191) NOT NULL DEFAULT '17:00' AFTER `morning_shift_end`,
ADD COLUMN `evening_shift_end` VARCHAR(191) NOT NULL DEFAULT '01:00' AFTER `evening_shift_start`;

-- AlterTable: Expense - Link to Shift
ALTER TABLE `expenses`
ADD COLUMN `shift_id` INTEGER NULL AFTER `purchase_id`;

-- CreateIndex: Add index for shift_id
CREATE INDEX `expenses_shift_id_idx` ON `expenses` (`shift_id`);

-- AddForeignKey: Link Expense to Shift
ALTER TABLE `expenses`
ADD CONSTRAINT `expenses_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;