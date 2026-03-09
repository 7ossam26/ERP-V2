/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `items` will be added. If there are existing duplicate values, this will fail.

*/
-- NOTE: is_active columns already added by 20260306052139_add_is_active_columns
-- NOTE: deposits.date already modified by 20260306052139_add_is_active_columns

-- CreateIndex
CREATE UNIQUE INDEX `categories_name_key` ON `categories`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `items_name_key` ON `items`(`name`);
