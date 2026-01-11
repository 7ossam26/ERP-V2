-- AlterTable
ALTER TABLE `sales` ADD COLUMN `user_id` INTEGER NULL,
    MODIFY `employee_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `branch_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
