# ERP-V2 System Map

## Application Targets
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health endpoint: `GET /api/health`
- Browser automation mode: Playwright CLI session `erp-v2-system`

## Roles In Scope
- `Superadmin`
- `Owner`
- `BranchManager`
- `Cashier`
- `WarehouseKeeper`
- `Accountant`

## Public Routes
- `/`
- `/change-password`
- `/forbidden`
- `/manual`
- `*`

## Superadmin Routes
- `/superadmin/users`
- `/superadmin/roles`
- `/superadmin/roles/:id/permissions`
- `/superadmin/audit-logs`
- `/superadmin/reset-database`

## Protected Business Routes
- `/dashboard`
- `/dashboard/owner`
- `/creates`
- `/data-import`
- `/import`
- `/import/:type`
- `/warehouses`
- `/employees`
- `/suppliers`
- `/clients`
- `/categories`
- `/items`
- `/treasuries`
- `/branches`
- `/delivery-men`
- `/delivery-zones`
- `/bom`
- `/bom/production-history`
- `/pos`
- `/purchases`
- `/supplier-accounts`
- `/stock-transfer`
- `/cashier-transfer`
- `/transfer-management`
- `/branches-sales`
- `/branches/balances`
- `/inventory`
- `/shifts`
- `/delivery-settlement`
- `/fabric-rolls`
- `/fabric-rolls/new`
- `/fabric-rolls/:id`
- `/fabric-rolls/:id/edit`
- `/inventory-adjustments`
- `/inventory-adjustments/new`
- `/inventory-adjustments/:id`
- `/inventory-counts`
- `/inventory-counts/new`
- `/inventory-counts/:id`
- `/inventory-counts/:id/session`
- `/inventory/alerts`
- `/inventory/dead-stock`
- `/expenses`
- `/deposits`
- `/hr`
- `/settings`
- `/audit`

## Report Routes
- `/reports`
- `/reports/general`
- `/reports/detailed`
- `/reports/analytics`
- `/reports/sales/daily`
- `/reports/sales/by-dimension`
- `/reports/margin-by-sku`
- `/reports/top-movers`
- `/reports/dead-stock`
- `/reports/fabric/remaining-meters`
- `/reports/fabric/rolls-by-age`
- `/reports/shift-reconciliation`
- `/reports/custom/advance-payments`
- `/reports/custom/cash-transfers`
- `/reports/custom/creations`
- `/reports/custom/daily-transactions`
- `/reports/custom/deductions`
- `/reports/custom/purchases`
- `/reports/custom/stock-transfers`

## Primary API Families
- `/api/auth/*`
- `/api/superadmin/*`
- `/api/users/*`
- `/api/branches/*`
- `/api/warehouses/*`
- `/api/treasuries/*`
- `/api/clients/*`
- `/api/suppliers/*`
- `/api/categories/*`
- `/api/items/*`
- `/api/employees/*`
- `/api/expenses/*`
- `/api/delivery-men/*`
- `/api/delivery-zones/*`
- `/api/bom/*`
- `/api/fabric-rolls/*`
- `/api/sales/*`
- `/api/purchases/*`
- `/api/shifts/*`
- `/api/stock-transfers/*`
- `/api/supplier-accounts/*`
- `/api/inventory/*`
- `/api/inventory-adjustments/*`
- `/api/inventory-counts/*`
- `/api/deposits/*`
- `/api/withdrawals/*`
- `/api/reports/*`
- `/api/audit/*`
- `/api/imports/*`
- `/api/import/*`

## High-Risk Workflow Areas
- Shift open, end, and approve.
- POS sale, refund, dispatch, and delivery completion.
- Purchase create, landed-cost allocation, return, and delete.
- Treasury transfer request, approval, and rejection.
- Delivery settlement.
- Inventory adjustments and inventory count finalization.
- Fabric roll cut, damage, and allocation.
- BOM execute and production-order edit.

## Current Coverage Notes
- Direct-route RBAC checks were executed with Playwright CLI `goto` to preserve authenticated browser state.
- Warehouse keeper route coverage now includes `/inventory-counts`, `/inventory-adjustments`, `/fabric-rolls`, `/pos`, and `/settings`.
- Workflow smoke coverage now includes `/shifts`, `/purchases`, `/transfer-management`, `/inventory-counts/new`, `/inventory-adjustments/new`, and `/fabric-rolls/new`.
- Warehouse-keeper purchase entry was re-verified after `BUG-003`; `/purchases` now loads in deferred-only mode without `/api/treasuries` requests or `403` console noise.

## Integrations
- MySQL through Prisma.
- Local upload storage exposed from `/uploads`.
- XLSX export generation.
- JWT-based auth.

## Environment-Dependent Behavior
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- Rate limiting and security middleware.
- Setup and reset endpoints vary by environment safety flags.

## Execution Notes
- Prisma was switched locally from binary engine to library engine so database-backed endpoints could run in this machine context.
- Existing-user reseeding now updates passwords, which fixed credential drift for the seeded `owner` account.
