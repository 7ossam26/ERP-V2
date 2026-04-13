# Initial/Old Inventory Quantities Module — Design Plan

## Understanding Summary

- **What:** A new tab within the existing Inventory page to manually add and track initial/old stock quantities for products
- **Why:** To record pre-ERP stock that existed before the system was in use, separate from purchase/sale transactions
- **Who:** Users with a dedicated `INITIAL_INVENTORY` permission (configured in superadmin permissions table); only admin/superadmin can delete entries
- **UI Pattern:** List-detail layout (like Supplier Accounts page) — product list on the left, product details + "add initial quantity" button + history on the right
- **Quantity Behavior:** Initial quantities **add to** existing stock (increment, not replace)
- **Tracking:** Per warehouse, with full audit history (date, quantity, warehouse, notes, user)
- **Non-goals:** Not a replacement for the Excel import feature; this is a manual, per-product entry mechanism with history

---

## Assumptions

1. A new permission `INITIAL_INVENTORY` will be added to the `Module` enum in Prisma schema
2. Adding initial quantity creates a real inventory change (increments `Inventory.quantity`)
3. Deleting an entry (admin/superadmin only) reverses the quantity (decrements it back)
4. History log stores: quantity, warehouse, date, notes, userId, createdAt
5. No limit on how many initial quantity entries per product per warehouse
6. The new tab appears inside the existing Inventory page (not a separate route)

---

## Decision Log

| # | Decision | Alternatives Considered | Why Chosen |
|---|----------|------------------------|------------|
| 1 | Dedicated tab inside Inventory page | Separate page, link from inventory page | Keeps inventory features centralized, less navigation |
| 2 | Initial quantity **adds to** existing stock | Replace/overwrite, separate tracked field | Simpler model; real inventory increment like purchases do |
| 3 | Per-warehouse tracking | Global (single warehouse) | Matches existing inventory model (`Inventory` is per item+warehouse) |
| 4 | Full history log with audit trail | No history (direct update) | Accountability and traceability for pre-ERP data |
| 5 | List-detail layout (Supplier Accounts pattern) | Per-row action button with modal | User preference; provides better overview and history visibility |
| 6 | New permission in superadmin permissions table | Same as inventory permissions | Dedicated control over who can modify initial stock |
| 7 | Only admin/superadmin can delete entries | Anyone can delete, or permanent (no delete) | Balance between audit integrity and error correction |

---

## Technical Design

### 1. Database Changes

#### New Model: `InitialInventory`

```prisma
model InitialInventory {
  id          Int      @id @default(autoincrement())
  itemId      Int      @map("item_id")
  warehouseId Int      @map("warehouse_id")
  quantity    Decimal  @db.Decimal(10, 6)
  date        DateTime @default(now())
  notes       String?  @db.Text
  userId      Int      @map("user_id")
  createdAt   DateTime @default(now()) @map("created_at")

  // Relations
  item      Item      @relation(fields: [itemId], references: [id], onDelete: Restrict)
  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  user      User      @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@map("initial_inventory")
}
```

#### Schema Changes Required:
- Add `INITIAL_INVENTORY` to `Module` enum
- Add `initialInventoryEntries InitialInventory[]` relation to `Item` model
- Add `initialInventoryEntries InitialInventory[]` relation to `Warehouse` model
- Add `initialInventoryEntries InitialInventory[]` relation to `User` model

### 2. Backend — New Route File: `routes/initialInventory.js`

#### Endpoints:

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/initial-inventory` | List all items with their initial inventory summary | `INITIAL_INVENTORY` |
| `GET` | `/api/initial-inventory/:itemId` | Get initial inventory history for a specific item | `INITIAL_INVENTORY` |
| `POST` | `/api/initial-inventory` | Add initial quantity entry for an item+warehouse | `INITIAL_INVENTORY` |
| `DELETE` | `/api/initial-inventory/:id` | Delete an entry (reverses quantity) | `INITIAL_INVENTORY` + admin/superadmin check |

#### POST `/api/initial-inventory` — Add Entry

**Request Body:**
```json
{
  "itemId": 12,
  "warehouseId": 1,
  "quantity": 100,
  "date": "2026-04-01",
  "notes": "كمية قديمة قبل النظام"
}
```

**Logic (in a Prisma transaction):**
1. Validate item exists
2. Validate warehouse exists
3. Validate quantity > 0
4. Create `InitialInventory` record (with `userId` from auth)
5. Upsert `Inventory` record: increment `quantity` by the given amount
6. Return created entry

#### DELETE `/api/initial-inventory/:id` — Delete Entry

**Logic (in a Prisma transaction):**
1. Verify user is admin/superadmin
2. Find the `InitialInventory` record
3. Decrement `Inventory.quantity` by the entry's quantity
4. Delete the `InitialInventory` record
5. Return success

### 3. Frontend Changes

#### 3a. Inventory Page — Add Tab

**File:** `frontend/src/pages/inventory/InventoryPage.jsx`

Add a tab switcher at the top:
- **"المخزون"** (current inventory view — default)
- **"المخزون الافتتاحي"** (initial inventory — new tab)

When "المخزون الافتتاحي" tab is active, render the new `InitialInventoryTab` component.

#### 3b. New Component: `InitialInventoryTab.jsx`

**Location:** `frontend/src/pages/inventory/InitialInventoryTab.jsx`

**Layout (following Supplier Accounts pattern):**

```
┌─────────────────────────────────────────────────────────┐
│  [Tab: المخزون] [Tab: المخزون الافتتاحي]                │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Product     │  Product Name + Details                  │
│  List        │                                          │
│  (clickable) │  [إضافة كمية افتتاحية] Button            │
│              │                                          │
│  - Search    │  ┌─ History Table ─────────────────────┐  │
│  - Filter    │  │ Date | Warehouse | Qty | Notes | ✕ │  │
│              │  │ ...  | ...       | ... | ...   | ✕ │  │
│              │  └────────────────────────────────────┘  │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Left Panel — Product List:**
- Search by name/code
- Show item name, code, total current quantity
- Click to select and show details on the right

**Right Panel — Selected Product Details:**
- Product name, current total quantity, unit
- **"إضافة كمية افتتاحية"** button (opens modal)
- History table of all initial inventory entries for this product:
  - Date
  - Warehouse name
  - Quantity added
  - Notes
  - Delete button (visible only for admin/superadmin)

#### 3c. New Modal: Add Initial Quantity

**Fields:**
- Warehouse (dropdown — required)
- Quantity (number — required, > 0)
- Date (date picker — defaults to today)
- Notes (textarea — optional)

**On submit:** POST to `/api/initial-inventory`, refresh history and product list quantities.

#### 3d. New Service: `initialInventoryService.js`

**Location:** `frontend/src/services/initialInventoryService.js`

```js
- getAll()           → GET /api/initial-inventory
- getByItem(itemId)  → GET /api/initial-inventory/:itemId
- add(data)          → POST /api/initial-inventory
- delete(id)         → DELETE /api/initial-inventory/:id
```

### 4. Permission Setup

- Add `INITIAL_INVENTORY` to `Module` enum in `schema.prisma`
- Run Prisma migration
- The superadmin permissions page will automatically pick up the new module (if it reads from the enum dynamically) — otherwise add it manually to the permissions UI

---

## Implementation Order

1. **Database:** Add `InitialInventory` model + `INITIAL_INVENTORY` enum value → run migration
2. **Backend:** Create `routes/initialInventory.js` with all 4 endpoints
3. **Backend:** Register route in `index.js` with permission middleware
4. **Frontend:** Create `initialInventoryService.js`
5. **Frontend:** Create `InitialInventoryTab.jsx` component (list-detail + modal)
6. **Frontend:** Add tab switcher to `InventoryPage.jsx`
7. **Testing:** Verify add/delete/history/permissions flow

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Deleting entry could make inventory go negative | Validate that `Inventory.quantity` >= entry quantity before allowing delete |
| Permission enum change requires migration | Standard Prisma migration; low risk |
| Large product list performance | Paginate or virtualize the product list if needed (defer until proven slow) |
