/*
  Warnings:

  - You are about to drop the column `branch` on the `employees` table. All the data in the column will be lost.
  - Added the required column `branch_id` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `employees` DROP COLUMN `branch`,
    ADD COLUMN `branch_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
