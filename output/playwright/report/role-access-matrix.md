# ERP-V2 Role And Access Matrix

| Role | Can Access | Cannot Access | Elevated Actions | Restrictions |
| --- | --- | --- | --- | --- |
| `Superadmin` | All business routes and `/superadmin/*` | None by design | Manage users, roles, permissions, audit logs, and database reset | Destructive actions still require explicit confirmation |
| `Owner` | All business modules including settings, audit, owner dashboard, and cross-branch reporting | `/superadmin/*` | Global settings changes and sensitive edits or deletes | No superadmin console |
| `BranchManager` | Branch operations, POS, sales, purchases, shifts, delivery, inventory, reports, and finance within granted modules | `/superadmin/*`, owner-only settings, branch or warehouse creation areas not granted by permission set | Sensitive edits or deletes and branch workflow approvals | Branch-scoped access only |
| `Cashier` | POS, sales, clients, items, categories, inventory view, and shifts | Purchases, treasury administration, reports, settings, superadmin | Open and end own shifts, create sales, create clients | No sensitive access, no destructive admin actions |
| `WarehouseKeeper` | Inventory, counts, adjustments, stock transfer, items, categories, suppliers, warehouses, fabric rolls, and deferred purchase entry | POS, treasury admin, settings, superadmin | Inventory write actions, count finalization, fabric roll actions | Purchase entry no longer requests treasury admin APIs; treasury-backed payment choices remain unavailable without `TREASURIES` |
| `Accountant` | Reports, treasuries, expenses, deposits, withdrawals, supplier accounts, cash transfer, transfer management, audit | POS, settings, superadmin | Financial approvals and treasury transfer handling | No sensitive access for master-data destructive actions |

## Test Personas
- `superadmin` - `Superadmin`, global scope, full access.
- `owner` - `Owner`, global scope, settings and audit access.
- `manager.gasr` - `BranchManager`, Branch 1, sensitive access enabled.
- `manager.ramo` - `BranchManager`, Branch 2, sensitive access enabled.
- `cashier.gasr` - `Cashier`, Branch 1, no sensitive access.
- `cashier.ramo` - `Cashier`, Branch 2, no sensitive access.
- `warehouse.keeper` - `WarehouseKeeper`, Branch 1, inventory-focused.
- `accountant` - `Accountant`, finance and audit coverage.

## Verified Current-Cycle Notes
- `Cashier`, `BranchManager`, and `Accountant` no longer trigger avoidable `/api/settings` or `/api/settings/themes` requests on tested routes after the `SETTINGS`-permission gating fix.
- `WarehouseKeeper` successfully accessed `/inventory-counts`, `/inventory-adjustments`, and `/fabric-rolls`, and was denied `/pos` and `/settings` as expected.
- `WarehouseKeeper` now accesses `/purchases` without `/api/treasuries` requests or treasury-permission console noise. The page defaults to deferred purchase entry for this role.

## Known Risk Flags
- Legacy role-name checks still reference `Manager`, `Branch Manager`, and `General Manager` in some approval paths.
- Sensitive edit and delete controls require explicit validation per role because access is split between module permissions and `hasSensitiveAccess`.
