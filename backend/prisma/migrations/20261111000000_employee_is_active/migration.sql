-- Archive (Active/Inactive) flag for employees.
--
-- WHY
-- ---
-- The only way to drop someone who left the company was DELETE, which cascades
-- their employee_transactions away. An inactive employee is hidden from the
-- Employee Codes active list and from the HR page (except in months where they
-- still have transactions or a salary payment), while every record is kept.
--
-- NON-DESTRUCTIVE, ADD-ONLY. Every existing row defaults to active (1), so no
-- page shows anything different until someone is explicitly archived. Nothing
-- is dropped, renamed or retyped.

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
