-- Add branch/shift attribution to HR operations and treasury/shift to payrolls.
--
-- Advances & deductions can now record the branch they belong to (defaulting to
-- the employee's branch) and the active shift they were entered under. Salary
-- payments record which treasury was debited and the shift in effect.
--
-- This is a NON-DESTRUCTIVE, ADD-ONLY migration: every new column is NULLABLE
-- and every foreign key is ON DELETE SET NULL. No existing column is dropped,
-- renamed, retyped, or made NOT NULL, and no table is dropped or recreated, so
-- all existing employee_transactions and payrolls rows are left fully intact.

-- AlterTable
ALTER TABLE `employee_transactions` ADD COLUMN `branch_id` INTEGER NULL,
    ADD COLUMN `shift_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `payrolls` ADD COLUMN `shift_id` INTEGER NULL,
    ADD COLUMN `treasury_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `employee_transactions` ADD CONSTRAINT `employee_transactions_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_transactions` ADD CONSTRAINT `employee_transactions_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
