-- AlterTable: COGS snapshot on each bulk order line, mirroring sale_items.cost_price.
--
-- The general report now counts wholesale revenue in totalSales. Without a cost
-- snapshot that revenue would carry zero cost and inflate gross/net profit by
-- the full wholesale amount, so this column is a prerequisite, not an extra.
-- Appended rather than placed AFTER `line_total` on purpose: MySQL 8.0 can only
-- use ALGORITHM=INSTANT when the column goes last. Naming a position forces a
-- full table rebuild and takes a metadata lock, which is not worth paying on a
-- live database for cosmetic column order. Nothing reads columns positionally.
ALTER TABLE `bulk_order_items`
ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Backfill historical lines from the item's CURRENT cost. There is no cost
-- ledger to reconstruct what each item cost on the day its order was placed, so
-- pre-existing wholesale orders are valued at today's cost. New orders stamp the
-- real cost at creation time (see bulkOrder.controller.js validateLines).
UPDATE `bulk_order_items` `boi`
JOIN `items` `i` ON `i`.`id` = `boi`.`item_id`
SET `boi`.`cost_price` = `i`.`cost_price`
WHERE `boi`.`cost_price` = 0;
