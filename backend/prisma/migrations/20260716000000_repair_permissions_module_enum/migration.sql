-- Repair the `permissions.module` ENUM on databases where an earlier boot-time
-- script had rewritten it to a stale list that omitted WAREHOUSE_TRANSFER_MANAGEMENT
-- (which caused a 500 on PUT /superadmin/roles/:id/permissions).
--
-- This is a NON-DESTRUCTIVE, superset-only MODIFY: enlarging a MySQL ENUM keeps
-- every existing row intact. It does not touch, delete, or drop any data. The
-- value list is generated from backend/config/modules.js (the single source of
-- truth) and is verified against prisma/schema.prisma by
-- tests/unit/moduleEnum.test.js.
ALTER TABLE `permissions` MODIFY `module` ENUM('HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS','PURCHASES','SALES','REPORTS','TREASURIES','CASH_TRANSFER','TRANSFER_MANAGEMENT','WAREHOUSE_TRANSFER_MANAGEMENT','BRANCHES','EMPLOYEES','CLIENTS','SUPPLIERS','SUPPLIER_ACCOUNTS','CATEGORIES','ITEMS','WAREHOUSES','SETTINGS','EXPENSES','SHIFTS','DELIVERY_SETTLEMENT','CREATES_WAREHOUSES','CREATES_EMPLOYEES','CREATES_SUPPLIERS','CREATES_CLIENTS','CREATES_CATEGORIES','CREATES_ITEMS','CREATES_TREASURIES','CREATES_BRANCHES','DEPOSITS','CREATES_DEPOSITS','WITHDRAWALS','CREATES_WITHDRAWALS','DELIVERY_MEN','CREATES_DELIVERY_MEN','DELIVERY_ZONES','CREATES_DELIVERY_ZONES','CREATES_PRODUCTION','PRODUCTION','INITIAL_INVENTORY','CALL_CENTER','BULK_POS','BULK_CUSTOMERS','BULK_PRICING','BULK_CREDIT','BULK_REPORTS') NOT NULL;
