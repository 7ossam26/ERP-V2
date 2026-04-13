# Plan: Production Order Cancel / Return Feature

**Date:** 2026-04-13  
**Status:** Ready for implementation  
**Permission required:** `CREATES_PRODUCTION`

---

## Understanding Summary

- **What**: Add a cancel/return action on production orders that fully reverses the order
- **Why**: Orders can be created by mistake; the system must stay inventory-accurate
- **Who**: Users with `CREATES_PRODUCTION` permission
- **Guard**: Deletion blocked if dest warehouse lacks enough finished goods stock to reverse (prevents negative inventory)
- **UX**: "إلغاء/رجوع" button on card header → confirmation modal → execute reversal
- **History**: Original order marked `CANCELLED` + a new paired `RETURNED` entry is created
- **Audit**: Record cancelling user, timestamp, and order details via `writeAudit`
- **Non-goals**: No partial reversals, no new permission level, no status-based workflow

---

## Decision Log

| Decision | Alternatives | Reason |
|---|---|---|
| Full reversal (raw materials back + finished goods removed) | Partial / keep finished goods | User chose A — treat as if never happened |
| Block delete if insufficient finished goods in dest warehouse | Always allow | Prevent negative inventory |
| `CREATES_PRODUCTION` permission | Higher PRODUCTION role | Consistent with who can create = who can undo |
| Paired records (CANCELLED original + new RETURNED entry) | Soft-delete only / hard delete | Full audit trail in history; user chose C |
| Confirmation modal with summary | Immediate action | User requirement |
| Audit log entry on cancel | No audit | User requirement — track who returned |

---

## Assumptions

1. If an order had **no `destWarehouseId`** (no finished goods tracked), skip the finished goods stock check — only return raw materials
2. The confirmation modal shows the list of ingredients and quantities that will be returned
3. `CANCELLED` and `RETURNED` orders are **not editable** — edit button hidden/disabled for these statuses
4. The `RETURNED` entry is display-only in history (no edit or cancel button on it)
5. All existing orders without a `status` field default to `COMPLETED` via migration

---

## Phase 1 — Database Schema (Prisma)

**File:** `backend/prisma/schema.prisma`

Add to `ProductionOrder` model:

```prisma
status          String   @default("COMPLETED") @db.VarChar(20)
cancelledById   Int?     @map("cancelled_by_id")
cancelledAt     DateTime? @map("cancelled_at")
linkedOrderId   Int?     @map("linked_order_id")   // pairs CANCELLED ↔ RETURNED

// New relations
cancelledBy     User?    @relation("ProductionOrderCanceller", fields: [cancelledById], references: [id], onDelete: SetNull)
linkedOrder     ProductionOrder?  @relation("LinkedOrders", fields: [linkedOrderId], references: [id], onDelete: SetNull)
linkedFrom      ProductionOrder[] @relation("LinkedOrders")
```

Add to `User` model:
```prisma
cancelledProductionOrders ProductionOrder[] @relation("ProductionOrderCanceller")
```

**Migration:** `npx prisma migrate dev --name add_production_order_status`

---

## Phase 2 — Backend Endpoint

**File:** `backend/routes/bom.js`

Add new route **before** `module.exports`:

```
POST /production-orders/:id/cancel
```

### Logic (inside a Prisma transaction):

1. **Fetch** the order with `items`, `bom.outputItem`, `sourceWarehouse`, `destWarehouse`
2. **Guard:** if `order.status !== 'COMPLETED'` → 400 "هذا الأمر تم إلغاؤه مسبقاً"
3. **Stock check** (only if `destWarehouseId` exists and `bom.outputItemId` exists):
   - Query `inventory` for `outputItemId` in `destWarehouseId`
   - If `available < order.actualOutputQty` → 400 with shortage details
4. **Transaction:**
   - a. Return raw materials → `inventory.update increment quantityUsed` for each `order.items` in `sourceWarehouseId`
   - b. Remove finished goods → `inventory.update decrement actualOutputQty` in `destWarehouseId` (if applicable)
   - c. Mark original as cancelled:
     ```js
     productionOrder.update({ status: 'CANCELLED', cancelledById: req.user.id, cancelledAt: new Date(), linkedOrderId: returnEntry.id })
     ```
   - d. Create paired RETURNED entry:
     ```js
     productionOrder.create({
       bomId, sourceWarehouseId, destWarehouseId,
       targetOutputQty: order.targetOutputQty,
       actualOutputQty: order.actualOutputQty,
       outputWasteQty: order.outputWasteQty,
       totalCost: order.totalCost,
       status: 'RETURNED',
       createdById: req.user.id,
       cancelledById: req.user.id,
       cancelledAt: new Date(),
       linkedOrderId: order.id,
       notes: `إلغاء أمر الإنتاج #${order.id}`,
       items: { create: order.items.map(i => ({ itemId: i.itemId, quantityUsed: i.quantityUsed })) }
     })
     ```
   - e. Write audit log:
     ```js
     writeAudit({
       action: 'CANCEL',
       targetEntity: 'production_order',
       targetId: String(order.id),
       userId: req.user.id,
       newValues: { cancelledById: req.user.id, returnedOrderId: returnEntry.id },
       oldValues: { status: 'COMPLETED', ...originalOrderSnapshot },
       ipAddress: req.ip,
     })
     ```
5. Return the updated original order + new return entry

---

## Phase 3 — Edit Button Logic Fix

**File:** `backend/routes/bom.js` — `PUT /production-orders/:id`

**Current issue:** The edit route has no status check. If someone edits a `CANCELLED` or `RETURNED` order it would corrupt inventory.

**Fix — add guard at top of handler:**
```js
if (original.status !== 'COMPLETED') {
  return res.status(400).json({ error: 'لا يمكن تعديل أمر ملغي أو مُرجَع' });
}
```

**File:** `frontend/src/pages/bom/ProductionHistory.jsx`

**Fix — hide edit button for non-COMPLETED orders:**
```jsx
// Before (line ~222):
<button onClick={...} title="تعديل">

// After:
{order.status === 'COMPLETED' && (
  <button onClick={...} title="تعديل">
    ...
  </button>
)}
```

---

## Phase 4 — Frontend: Cancel Button + Confirmation Modal

**File:** `frontend/src/pages/bom/ProductionHistory.jsx`

### 4a. Add cancel button to card header (next to edit button, only for COMPLETED orders)

```jsx
{order.status === 'COMPLETED' && (
  <button
    onClick={(e) => { e.stopPropagation(); handleStartCancel(order); }}
    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
    title="إلغاء/رجوع">
    <span className="material-icons-round text-lg">undo</span>
  </button>
)}
```

### 4b. Status badges on card header

```jsx
// CANCELLED
{order.status === 'CANCELLED' && (
  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">ملغي</span>
)}
// RETURNED
{order.status === 'RETURNED' && (
  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">مُرجَع</span>
)}
```

### 4c. Confirmation Modal

New state: `cancelingOrder` (null or order object)

Modal content:
- Title: "تأكيد إلغاء أمر الإنتاج"
- Summary: BOM name, date, cost
- Table of ingredients that will be returned to source warehouse
- Warning: "سيتم إلغاء هذا الأمر وإعادة المواد الخام للمخزون"
- Buttons: "تأكيد الإلغاء" (red) / "تراجع" (gray)

### 4d. Handler

```js
const handleCancelOrder = async (orderId) => {
  setCanceling(true);
  try {
    await bomService.cancelProductionOrder(orderId);
    toast.success('تم إلغاء أمر الإنتاج وإعادة المواد للمخزون');
    setCancelingOrder(null);
    fetchOrders();
  } catch (error) {
    toast.error(error.message || 'فشل إلغاء أمر الإنتاج');
  } finally {
    setCanceling(false);
  }
};
```

---

## Phase 5 — Frontend Service

**File:** `frontend/src/services/domainServices.js` (or wherever `bomService` is defined)

Add:
```js
cancelProductionOrder: async (orderId) => {
  const res = await api.post(`/bom/production-orders/${orderId}/cancel`);
  return res.data;
},
```

---

## Implementation Order

1. [ ] Phase 1 — Prisma schema + migration
2. [ ] Phase 2 — Backend `POST /production-orders/:id/cancel` route
3. [ ] Phase 3 — Fix edit guard (backend + frontend)
4. [ ] Phase 4 — Frontend cancel button, status badges, confirmation modal
5. [ ] Phase 5 — Add `cancelProductionOrder` to service layer
6. [ ] Manual test: execute order → cancel → verify stock restored → verify history shows both entries

---

## Files to Change

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `status`, `cancelledById`, `cancelledAt`, `linkedOrderId` to `ProductionOrder` |
| `backend/prisma/migrations/...` | Auto-generated migration |
| `backend/routes/bom.js` | Add cancel route + fix edit guard |
| `frontend/src/pages/bom/ProductionHistory.jsx` | Cancel button, status badges, confirmation modal, hide edit for non-COMPLETED |
| `frontend/src/services/domainServices.js` | Add `cancelProductionOrder` |
