# Phase 7 — Reports + Excel Import Design
**Date:** 2026-04-20
**Branch:** `ramex-store`
**Database:** `mysql://root:@localhost:3306/ramex_store` (local only — never El-Ghonemy production)

---

## Overview

Three independent tracks delivered in order:

| Track | Scope | DB migration? |
|-------|-------|---------------|
| 1 — Owner Dashboard | 1 new API endpoint + 1 new frontend page | No |
| 2 — Reports + xlsx export | 8 new report endpoints + 8 frontend pages + shared chart components | Yes (indexes) |
| 3 — Import Refactor | Full rewrite of `dataImport.js` + new module + frontend wizard | Yes (INITIAL_INVENTORY enum) |

---

## Track 1 — Owner Dashboard

### Backend

**File:** `backend/routes/reports.js` (append at bottom)

**Endpoint:** `GET /api/reports/dashboard/owner`
**Guard:** `requirePermission("OWNER_DASHBOARD")` (module already in schema enum)
**Cache:** Simple in-module `let ownerCache = { data: null, expiry: 0 }` — returns cached data if `Date.now() < expiry`, else fetches and sets `expiry = Date.now() + 60_000`.

**Response shape:**
```json
{
  "today": {
    "total": 0,
    "perBranch": [{ "branchId": 1, "branchName": "فرع القاهرة", "total": 0, "invoiceCount": 0 }]
  },
  "mtd": {
    "total": 0,
    "perBranch": [{ "branchId": 1, "branchName": "فرع القاهرة", "total": 0, "invoiceCount": 0 }]
  },
  "trend30d": {
    "labels": ["2026-03-21", "..."],
    "perBranch": [{ "branchId": 1, "branchName": "", "data": [0, ...] }]
  },
  "top5Items": [{ "itemName": "", "revenue": 0, "quantity": 0 }],
  "treasuries": [{ "id": 1, "name": "", "balance": 0 }],
  "reorderAlertCount": 0,
  "pendingShiftReviews": 0
}
```

**Queries used:**
- `Sale` filtered by `status=COMPLETED`, `createdAt` between today-start/now → today totals
- `Sale` filtered by `createdAt` between first-of-month/now → MTD totals
- `Sale` filtered by last 30 days, grouped by day+branch → trend data
- `SaleItem` grouped by `itemId`, ordered by total desc, limit 5 → top items
- `Treasury.findMany()` → balances
- `Inventory` where `quantity <= item.reorderPoint` → reorder count
- `Shift` where `status=PENDING_REVIEW` → count

### Frontend

**New file:** `frontend/src/pages/reports/OwnerDashboard.jsx`
**Route:** `/dashboard/owner`

**Layout:**
- Top row: 5 `KPICard` components (اليوم, الشهر, خزائن, تنبيهات, ورديات معلقة)
- Main: 30-day line chart (`ArabicLineChart`) with one series per branch
- Bottom row: top-5 items table (right) + per-branch mini panels (left)

**Login redirect:** `frontend/src/pages/LoginPage.jsx` — after successful login, check if `user.permissions` includes `OWNER_DASHBOARD`; if yes, redirect to `/dashboard/owner` instead of `/dashboard`.

**Nav link:** In `MainLayout.jsx`, if user has `OWNER_DASHBOARD` permission, render a "لوحة المالك" nav item linking to `/dashboard/owner`.

**modules.js entry:**
```js
{
  id: "owner_dashboard",
  code: "OWNER_DASHBOARD",
  label: "لوحة المالك",
  description: "لوحة تحكم خاصة بالمالك",
  icon: "dashboard_customize",
  path: "/dashboard/owner",
  category: "MANAGEMENT",
}
```

---

## Track 2 — Reports + xlsx Export

### Migration: `ramex_report_indexes`

Add `@@index` decorators in `schema.prisma`:
- `Sale`: `@@index([createdAt, branchId])`
- `SaleItem`: `@@index([itemId, saleId])`
- `PurchaseItem`: `@@index([itemId, purchaseId])`

Run `npx prisma migrate dev --name ramex_report_indexes`.

### Backend

**File:** `backend/routes/reports.js`

**Shared helpers (top of file):**
```js
// buildXlsxBuffer(sheetName, headers, rows) → Buffer
// sendXlsx(res, filename, sheetName, headers, rows)
// parseDateRange(from, to) → { start: Date, end: Date }
// buildBranchFilter(branchId, accessibleBranchIds) → Prisma where clause
```

All endpoints:
- Accept `?branchId=` validated against `getUserBranchFilter` (auth middleware)
- Require `requirePermission("REPORTS")` except Owner Dashboard which uses `OWNER_DASHBOARD`
- Have a sibling `GET .../export.xlsx` route with identical logic, returns xlsx

#### 2.1 Daily Sales
`GET /api/reports/sales/daily?from=&to=&branchId=&groupBy=day|week|month`

Groups completed sales by the chosen bucket. Returns:
```json
{ "labels": ["2026-04-01"], "data": [15000.00], "total": 15000.00 }
```

#### 2.2 Sales by Dimension
`GET /api/reports/sales/by-dimension?dimension=branch|tier|category|paymentMethod|item&from=&to=&branchId=`

Groups by the chosen dimension. For `tier` groups by `client.tier`. For `category` joins `ItemCategory`. Returns:
```json
{ "labels": ["RETAIL", "WHOLESALE"], "data": [8000, 7000] }
```

#### 2.3 Margin by SKU
`GET /api/reports/margin-by-sku?from=&to=&branchId=`

For each item sold in range: cost = latest `PurchaseItem.finalUnitCost` × qty sold (pragmatic; comment in code noting moving-average is a future enhancement). Returns:
```json
{ "items": [{ "itemName": "", "revenue": 0, "cost": 0, "margin": 0, "marginPct": 0 }] }
```
Items with no purchase history: `cost = item.costPrice × qty` (fallback).

#### 2.4 Top Movers
`GET /api/reports/top-movers?metric=revenue|quantity&limit=10&from=&to=&branchId=`

Returns top N items by chosen metric:
```json
{ "items": [{ "itemName": "", "value": 0 }] }
```

#### 2.5 Dead Stock
`GET /api/reports/dead-stock?days=90&branchId=`

Delegates to same logic as `GET /api/inventory/dead-stock` but accepts `branchId` and returns xlsx export variant. Internally duplicates the N+1 query from `inventory.js` with a `branchId` filter added. (Future: extract to shared service.)

#### 2.6 Fabric Remaining Meters
`GET /api/reports/fabric/remaining-meters?branchId=`

Groups `FabricRoll` by `itemId`, status in `[AVAILABLE, PARTIALLY_CUT]`, optionally filtered by warehouse via branch→warehouseId. Returns:
```json
{ "rows": [{ "itemName": "", "totalRemaining": 0.0, "rollCount": 0 }] }
```

#### 2.7 Fabric Rolls by Age
`GET /api/reports/fabric/rolls-by-age?branchId=`

Buckets by `createdAt`: `<30d`, `30–90d`, `>90d`. Only counts AVAILABLE + PARTIALLY_CUT rolls. Returns:
```json
{ "buckets": [{ "label": "<30 يوم", "count": 0, "totalMeters": 0.0 }] }
```

#### 2.8 Shift Reconciliation
`GET /api/reports/shift-reconciliation?from=&to=&branchId=`

Returns closed shifts with variance. Returns:
```json
{ "shifts": [{ "shiftId": 1, "branchName": "", "type": "MORNING", "date": "", "startCash": 0, "systemExpectedCash": 0, "actualCash": 0, "shortage": 0 }] }
```

### Frontend

**Shared components** in `frontend/src/components/reports/`:

| File | Purpose |
|------|---------|
| `KPICard.jsx` | Stat card: icon + label + value + optional trend badge |
| `ReportFilterBar.jsx` | Date-range inputs + branch `<select>` (fetches branches from `/api/branches`) + optional dimension/metric selectors; calls `onChange(filters)` |
| `ArabicLineChart.jsx` | `react-chartjs-2` Line; registers required Chart.js components; `locale: 'ar-EG'` on tooltip number formatter; RTL layout |
| `ArabicBarChart.jsx` | Same pattern, Bar type |
| `ArabicPieChart.jsx` | Same pattern, Doughnut type |

All chart components accept `{ labels, datasets, title }` props and handle empty state.

**Currency rule:** Display `ج.م` suffix in UI tooltips/cells. xlsx column headers say `EGP`. Numbers use ASCII digits throughout (`Intl.NumberFormat('en-US')` or plain `.toLocaleString('en-US')`).

**Report pages** in `frontend/src/pages/reports/`:

| File | Route | Chart type |
|------|-------|------------|
| `ReportsIndexPage.jsx` | `/reports` | Grouped tile menu (replaces current stub) |
| `DailySalesReport.jsx` | `/reports/sales/daily` | `ArabicLineChart` + summary table |
| `SalesByDimensionReport.jsx` | `/reports/sales/by-dimension` | `ArabicPieChart` + table |
| `MarginBySKUReport.jsx` | `/reports/margin-by-sku` | `ArabicBarChart` (margin %) + table |
| `TopMoversReport.jsx` | `/reports/top-movers` | `ArabicBarChart` + table |
| `DeadStockReport.jsx` | `/reports/dead-stock` | Table only (links to Phase 5 page) + export |
| `FabricRemainingMetersReport.jsx` | `/reports/fabric/remaining-meters` | `ArabicBarChart` + table |
| `FabricRollsByAgeReport.jsx` | `/reports/fabric/rolls-by-age` | `ArabicPieChart` (3 slices) |
| `ShiftReconciliationReport.jsx` | `/reports/shift-reconciliation` | Table only |

**ReportsIndexPage groups:**
- المبيعات: Daily, By Dimension, Margin, Top Movers
- المخزون: Dead Stock
- الأقمشة: Remaining Meters, Rolls by Age
- الورديات: Shift Reconciliation
- لوحة المالك: link to `/dashboard/owner` (only rendered if user has `OWNER_DASHBOARD` permission)

Each report page has an "تصدير Excel" button that triggers `GET .../export.xlsx`.

---

## Track 3 — Import Refactor

### Migration: `add_initial_inventory_module`

Add `INITIAL_INVENTORY` to `Module` enum in `schema.prisma`:
```prisma
INITIAL_INVENTORY
```

Run `npx prisma migrate dev --name add_initial_inventory_module`.

**modules.js entry:**
```js
{
  id: "initial_inventory",
  code: "INITIAL_INVENTORY",
  label: "استيراد بيانات",
  description: "استيراد البيانات بالجملة من Excel",
  icon: "upload",
  path: "/import",
  category: "MANAGEMENT",
}
```

### Backend: Full rewrite of `backend/routes/dataImport.js`

**URL prefix change:** `index.js` changes mount from `/api/import` to `/api/imports`. Old `/api/import` is kept as a deprecated alias (simple re-mount of same router) for one release cycle.

**multer config:** 5MB limit (down from 10MB), xlsx/xls/csv only.

**Permission guard:** All import endpoints use `requirePermission("INITIAL_INVENTORY")`.

**Standard response shape** (dry-run and commit both return same shape):
```json
{
  "dryRun": true,
  "totalRows": 10,
  "validRows": 8,
  "invalidRows": 2,
  "errors": [{ "row": 3, "column": "price", "message": "سعر البيع غير صالح" }],
  "preview": [ ...first 5 valid rows as plain objects ]
}
```

**On commit:** if `invalidRows > 0` → do NOT commit, return response with Arabic message appended:
```json
{ ..., "committed": false, "message": "يحتوي الملف على أخطاء — قم بإصلاحها قبل الاستيراد" }
```
If `invalidRows === 0` and `?dryRun` not set → wrap all creates in `prisma.$transaction([...])` → return `{ ..., "committed": true }`.

**Shared helpers:**
```js
parseFile(buffer, filename)        // existing — keep
validateRows(type, rows, lookups)  // new — returns { errors, validRows }
commitRows(type, validRows, lookups, prisma)  // new — returns array of Prisma operations for $transaction
```

#### Template Definitions

All templates have 3 sheets: **Data** (Arabic header row 1, English field names row 2, example row 3), **قاموس** (value mappings like tier values), **تعليمات** (usage guide).

| Type | Arabic label | Fields | itemType |
|------|-------------|--------|----------|
| `fabric-items` | أقمشة | name\*, price\*, unit\*, costPrice, reorderPoint, showInPos | FABRIC |
| `clothes-items` | ملابس | same | CLOTHES |
| `accessories` | إكسسوار | same | ACCESSORY |
| `generic-items` | أصناف عامة | same | GENERIC |
| `clients` | عملاء | name\*, phoneNumber\*, address, الشريحة (تجزئة→RETAIL/جملة→WHOLESALE) | — |
| `suppliers` | موردون | name\*, phoneNumber\*, الرقم الضريبي | — |
| `initial-inventory` | مخزون افتتاحي | itemName\*, warehouseName\*, quantity\* | — |
| `fabric-rolls` | لفات أقمشة | itemName\*, originalLength\*, unit\*, colorCode, barcode, rollNumber | — |
| `employees` | موظفون | (unchanged from current) | — |
| `treasury` | خزائن | (unchanged from current) | — |

**Item importers (fabric-items / clothes-items / accessories / generic-items):**
Validates: name required, price ≥ 0 and numeric, unit required.
Creates: `Item` with appropriate `itemType`, `costPrice` (default 0), `reorderPoint` (default 10), `showInPos` (default true).
Unique conflict on `name` → error row: `الصنف "{name}" موجود مسبقاً`.

**Clients importer:**
New `tier` field: maps `تجزئة` → `RETAIL`, `جملة` → `WHOLESALE`, blank/other → `RETAIL` (default).
Template's قاموس sheet lists valid tier values.

**Suppliers importer:**
New optional `taxNumber` field maps to `Supplier.tax_number` — this column already exists in the schema (`String @default("")`), no migration needed.

**Initial-inventory importer:**
Matches item by `name` (Items have no barcode — the spec's "barcode first" does not apply here; match by name only).
For each valid row:
1. Upsert `Inventory` record (`itemId` + `warehouseId`)
2. Create `InventoryAdjustment` with `reason=OTHER`, `note="استيراد الرصيد الابتدائي"`, `branchId` from warehouse's branch
Entire file is one transaction.

**Fabric-rolls importer:**
Fields: `itemName*`, `originalLength*`, `unit*`, `colorCode` (optional), `barcode` (optional), `rollNumber` (auto-generated via `rollNumberService.js` if blank).
Validates: `itemId` exists, `originalLength > 0`, `barcode` unique within file + DB, `rollNumber` unique within file + DB.
Creates: `FabricRoll` records in batch.
After commit: updates `Inventory.quantity` for each item+warehouse by adding sum of `originalLength` for that item.
Entire file is one transaction.

**Backfill endpoint:**
`POST /api/imports/backfill-item-types`
Guard: inline check — `if (!["Superadmin","Admin","Owner"].includes(req.user.role)) return res.status(403).json({error:"غير مصرح"})`. No module permission needed (Owner always has this).
Logic: For each Item where `itemType = GENERIC` (skip already-typed items):
- If item has any `FabricRoll` records → set `itemType = FABRIC`
- Otherwise → leave as GENERIC (no change)
Idempotent: running twice produces same result.
Returns: `{ updated: N, skipped: N }`.

### Frontend: Import Pages

**Files:**
- `frontend/src/pages/import/ImportHomePage.jsx` — tile grid, one tile per import type
- `frontend/src/pages/import/ImportWizardPage.jsx` — 4-step wizard, driven by `:type` URL param

**Tile config** (same structure as current `ENTITIES` array, expanded):
```js
const IMPORT_TYPES = [
  { key: "fabric-items",      label: "أقمشة",           icon: "texture",        group: "أصناف" },
  { key: "clothes-items",     label: "ملابس",            icon: "checkroom",       group: "أصناف" },
  { key: "accessories",       label: "إكسسوار",          icon: "diamond",         group: "أصناف" },
  { key: "generic-items",     label: "أصناف عامة",       icon: "inventory_2",     group: "أصناف" },
  { key: "clients",           label: "عملاء",            icon: "people",          group: "سجلات" },
  { key: "suppliers",         label: "موردون",           icon: "local_shipping",  group: "سجلات" },
  { key: "employees",         label: "موظفون",           icon: "badge",           group: "سجلات" },
  { key: "initial-inventory", label: "مخزون افتتاحي",   icon: "warehouse",       group: "مخزون" },
  { key: "fabric-rolls",      label: "لفات أقمشة",       icon: "bolt",            group: "مخزون" },
  { key: "treasury",          label: "خزائن",            icon: "account_balance", group: "مالية" },
]
```

**ImportWizardPage steps:**
1. **رفع الملف** — drag-drop zone; "تحميل القالب" button; on file select → auto-trigger dry-run
2. **مراجعة البيانات** — shows error table (row / column / message) if errors; shows preview table of first 5 valid rows if no errors; "تصحيح وإعادة الرفع" button if errors; "تأكيد الاستيراد" button if clean
3. **تأكيد** — confirmation dialog with `validRows` count; on confirm → `POST /api/imports/:type` (no dryRun)
4. **النتيجة** — success message with count; "استيراد آخر" + "العودة" buttons

**Routing:**
```jsx
<Route path="/import"       element={<ImportHomePage />} />
<Route path="/import/:type" element={<ImportWizardPage />} />
<Route path="/data-import"  element={<Navigate to="/import" replace />} />
```

Old `DataImportPage.jsx` is deleted; its route replaced by the redirect above.

### Guide Document

`docs/data-import-guide.md` (Arabic) — order of operations:
1. خزائن (treasuries)
2. موردون (suppliers)
3. عملاء (clients)
4. أصناف (fabric-items / clothes-items / accessories / generic-items)
5. مخزون افتتاحي (initial-inventory) — requires items to exist first
6. لفات أقمشة (fabric-rolls) — requires items of type FABRIC to exist first
7. موظفون (employees)

Common errors + template download URLs.

---

## Permissions Matrix

| Action | Superadmin | Admin | Owner | BranchManager | Cashier |
|--------|-----------|-------|-------|---------------|---------|
| All report endpoints | ✓ | ✓ | via REPORTS permission | via REPORTS permission | — |
| Owner Dashboard | ✓ | ✓ | via OWNER_DASHBOARD | — | — |
| Import endpoints | ✓ | ✓ | via INITIAL_INVENTORY | via INITIAL_INVENTORY | — |
| Backfill item types | ✓ | ✓ | ✓ (role check) | — | — |

Superadmin and Admin bypass permission checks (existing middleware behavior).

---

## Migrations Summary

| Name | Change |
|------|--------|
| `ramex_report_indexes` | Add @@index on Sale(createdAt,branchId), SaleItem(itemId,saleId), PurchaseItem(itemId,purchaseId) |
| `add_initial_inventory_module` | Add INITIAL_INVENTORY to Module enum |

`Supplier.taxNumber` (`tax_number`) already exists in the schema — no third migration needed.

---

## Tests

### Track 2 — Reports
- `sales/daily`: aggregation across multi-day range, groupBy=week, empty range returns zeros
- `sales/by-dimension`: each dimension type, branch filter respected
- `margin-by-sku`: item with purchase history vs. fallback to costPrice
- `top-movers`: revenue vs. quantity metric
- `dashboard/owner`: returns 401 without OWNER_DASHBOARD permission; cache returns stale data within 60s; fresh fetch after TTL
- All xlsx endpoints: response content-type = `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Track 3 — Imports
- Each type: happy path (all rows valid, committed=true)
- Validation errors: one bad row → committed=false, correct row/column in error
- Dry-run: valid file with dryRun=true → committed=false, preview present
- Arabic round-trip: Arabic text survives xlsx → parse → DB → response intact
- `initial-inventory`: InventoryAdjustment created, Inventory upserted
- `fabric-rolls`: roll numbers auto-generated, Inventory quantity updated, duplicate barcode rejected
- Backfill idempotency: run twice → same `updated` count
- Permission: `INITIAL_INVENTORY` required; 403 without it

---

## Commit Message
```
phase(07): reports-import — owner dashboard + reports + Excel importers + backfill
```
