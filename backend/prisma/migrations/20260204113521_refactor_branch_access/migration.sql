/*
  Warnings:

  - You are about to drop the column `is_all_branches` on the `branches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `branches` DROP COLUMN `is_all_branches`;

-- AlterTable
ALTER TABLE `users` MODIFY `branch_id` INTEGER NULL;
