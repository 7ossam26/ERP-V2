-- Add اضافي (OVERTIME) and مكافئة (BONUS) to the employee transaction type enum,
-- and give payrolls frozen snapshot columns for the two additive amounts.
--
-- This is a NON-DESTRUCTIVE, SUPERSET-ONLY + ADD-ONLY migration:
--
--   * The ENUM MODIFY only ENLARGES the value list. 'ADVANCE' and 'DEDUCTION'
--     keep their existing positions (1 and 2), and MySQL stores ENUM values by
--     ordinal — appending values at the END never renumbers or rewrites the
--     existing ones, so every employee_transactions row is left fully intact.
--     Values are NEVER inserted in the middle or reordered, for this reason.
--
--   * The two new payrolls columns are NOT NULL DEFAULT 0, so MySQL backfills
--     every historical payroll with 0. That keeps the reconciliation invariant
--         net_salary = base_salary - advances - deductions + overtime + bonuses
--     true for pre-existing rows exactly as it is for new ones.
--
-- Nothing is dropped, renamed, retyped, narrowed, or made NOT NULL without a
-- default. The value list is generated from config/employeeTransactionTypes.js
-- (the single source of truth) and is verified against prisma/schema.prisma by
-- tests/unit/employeeTransactionTypeEnum.test.js.
--
-- OVERTIME and BONUS are ACCRUALS ONLY: no cash moves when they are recorded,
-- they are settled together with the salary at payout. Nothing in the shift
-- drawer or treasury reconciliation reads them (those paths filter on ADVANCE).

-- AlterTable
ALTER TABLE `employee_transactions`
  MODIFY `type` ENUM('ADVANCE', 'DEDUCTION', 'OVERTIME', 'BONUS') NOT NULL;

-- AlterTable
ALTER TABLE `payrolls`
  ADD COLUMN `overtime` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `bonuses` DECIMAL(10, 2) NOT NULL DEFAULT 0;
