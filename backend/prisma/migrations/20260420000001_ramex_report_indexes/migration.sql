-- AddIndex for reporting queries
CREATE INDEX `sales_created_at_branch_id_idx` ON `sales`(`created_at`, `branch_id`);
CREATE INDEX `sale_items_item_id_sale_id_idx` ON `sale_items`(`item_id`, `sale_id`);
CREATE INDEX `purchase_items_item_id_purchase_id_idx` ON `purchase_items`(`item_id`, `purchase_id`);
