# Plan: Purchase Cancel Feature (إلغاء فاتورة مشتريات)

**Date:** 2026-04-13  
**Status:** Ready for implementation  
**Authentication required:** Manager credentials (same as existing return flow)

---

## Understanding Summary

- **What**: Add a "cancel entire purchase" option inside the existing مرتجع (Return) modal
- **Why**: Users need to undo a full purchase when all items are still in stock, without returning item by item
- **Who**: Managers/admins with authentication credentials (same role-based check as existing returns)
- **Guard**: Cancellation blocked if warehouse lacks enough stock for any item in the purchase (prevents negative inventory)
- **UX**: New "إلغاء الفاتورة بالكامل" button inside the Return modal → stock check → manager auth → execute full reversal
- **Statuses**: Full cancel → `CANCELLED` (new enum value) / Partial return → `RETURNED` (existing)
- **Financials**: Exact reverse of creation — refund treasury (CASH/CREDIT), reduce supplier debt (DEFERRED), proportional split (MIXED)
- **Permanence**: Cancellation is permanent — no undo
- **Non-goals**: No return history view, no edit return, no undo cancel, no partial cancel

---

## Decision Log

| Decision | Alternatives | Reason |
|---|---|---|
| Cancel lives inside Return modal | Separate button on history/details | User chose D — keeps related actions together |
| Full reversal of financials | Manual handling / mark-only | User chose A — exact reverse of what happened at creation |
| `CANCELLED` status for full cancel | Use `RETURNED` for both | User wants distinct statuses: CANCELLED = full, RETURNED = partial |
| Add `CANCELLED` to `PaymentStatus` enum | Separate `status` field | User chose A — simpler, single field |
| Manager auth required | Any user / amount threshold | User chose A — same as existing return flow |
| Permanent cancellation | Allow undo | User chose A — must create new purchase if needed |
| Stock check before cancel | Always allow | Prevent negative inventory |
| Cancelled purchases visible in history | Hard delete | Stays in سجل المشتريات but marked and non-interactive |
| Cancel accessible from both سجل المشتريات and PurchaseDetailsModal | One location only | User chose C — both locations |

---

## Assumptions

1. The existing Return modal will get a new "إلغاء الفاتورة بالكامل" button that auto-selects all items at max quantity
2. Cancelled purchases appear in سجل المشتريات with a "ملغي" badge and cannot be returned or cancelled again
3. Audit log entry created via existing `audit_logs` table capturing: user, action, purchase details, affected stock/treasury/supplier values
4. The existing partial return flow remains unchanged
5. A purchase that has already been partially returned can still be cancelled (for the remaining items), but if stock is insufficient it will be blocked

---

## Phase 1 — Database Schema

**File:** `backend/prisma/schema.prisma`

Add `CANCELLED` to the `PaymentStatus` enum:

```prisma
enum PaymentStatus {
  PAID
  PARTIALLY_PAID
  UNPAID
  RETURNED
  CANCELLED
}
```

**Migration:** `npx prisma migrate dev --name add_cancelled_payment_status`

---

## Phase 2 — Backend Endpoint

**File:** `backend/routes/purchases.js`

Add new route:

```
POST /purchases/:id/cancel
```

### Request Body:
```json
{
  "managerUsername": "string",
  "managerPassword": "string",
  "notes": "string (optional)"
}
```

### Logic (inside a Prisma transaction):

1. **Fetch** the purchase with `items` (including `item` relation), `supplier`, `treasury`, `warehouse`
2. **Guard:** if `paymentStatus === 'CANCELLED'` → 400 "هذه الفاتورة ملغية مسبقاً"
3. **Manager auth:** Verify credentials + role check (same as existing return endpoint)
4. **Stock check** for every item in the purchase:
   - Query `inventory` for each `itemId` in the purchase's `warehouseId`
   - If any item's available stock < purchased quantity → 400 with details of which items are short
   - Account for any previously returned quantities (subtract from required check)
5. **Transaction:**
   a. **Reverse inventory** — decrement stock for each item in the warehouse
   b. **Reverse financials** (same logic as existing return endpoint):
      - CASH/CREDIT: Refund treasury (increment treasury balance)
      - DEFERRED: Reduce supplier account balance
      - MIXED: Proportional split refund
   c. **Create PurchaseReturn record** — full return with all items, linked to the purchase
   d. **Update purchase status:**
      ```js
      purchase.update({ paymentStatus: 'CANCELLED' })
      ```
   e. **Write audit log:**
      ```js
      writeAudit({
        action: 'CANCEL_PURCHASE',
        targetEntity: 'purchase',
        targetId: String(purchase.id),
        userId: req.user.id,
        oldValues: { paymentStatus: originalStatus, items: itemSnapshot },
        newValues: { paymentStatus: 'CANCELLED', returnId: returnEntry.id },
        ipAddress: req.ip,
      })
      ```
6. **Return** the updated purchase + return record

---

## Phase 3 — Frontend: Return Modal Update

**File:** `frontend/src/pages/purchases/PurchaseReturnModal.jsx`

### 3a. Add "إلغاء الفاتورة بالكامل" button

When a purchase is selected in the Return modal, show a button above/below the item selection:

```jsx
{selectedPurchase && selectedPurchase.paymentStatus !== 'CANCELLED' && (
  <button
    onClick={handleCancelEntirePurchase}
    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
    <span className="material-symbols-outlined">cancel</span>
    إلغاء الفاتورة بالكامل
  </button>
)}
```

### 3b. Cancel handler

```js
const handleCancelEntirePurchase = async () => {
  // Show confirmation dialog first
  setCancelConfirmOpen(true);
};

const confirmCancel = async () => {
  // Trigger manager auth, then call purchaseService.cancelPurchase(purchaseId, { managerUsername, managerPassword, notes })
  // On success: toast.success('تم إلغاء الفاتورة بالكامل')
  // On failure (stock shortage): toast.error with details of which items are short
};
```

### 3c. Confirmation dialog

Before manager auth, show a confirmation with:
- Purchase number and supplier name
- List of all items and quantities that will be reversed
- Warning: "سيتم إلغاء هذه الفاتورة بالكامل وإعادة جميع المبالغ والأصناف"
- Buttons: "تأكيد الإلغاء" (red) / "تراجع" (gray)

---

## Phase 4 — Frontend: History & Details Updates

### 4a. سجل المشتريات modal (PurchasesPage.jsx)

**Status label/class updates (line ~476):**
```js
const psLabel = (s) => ({
  PAID: "مدفوع",
  PARTIALLY_PAID: "جزئي",
  UNPAID: "غير مدفوع",
  RETURNED: "مرتجع",
  CANCELLED: "ملغي"
})[s] || s;

const psClass = (s) =>
  s === "PAID" ? "bg-green-100 text-green-800" :
  s === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" :
  s === "RETURNED" ? "bg-orange-100 text-orange-800" :
  s === "CANCELLED" ? "bg-gray-200 text-gray-600 line-through" :
  "bg-red-100 text-red-800";
```

**Disable eye/return buttons for cancelled purchases:**
- Eye button: still works (can view details of cancelled purchase)
- Return button in history: hidden for CANCELLED purchases

### 4b. PurchaseDetailsModal

Add a cancel button inside the details modal (only for non-cancelled purchases):

```jsx
{purchase.paymentStatus !== 'CANCELLED' && purchase.paymentStatus !== 'RETURNED' && (
  <button onClick={onCancelPurchase} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">
    إلغاء الفاتورة
  </button>
)}
```

When cancelled, show a "ملغي" badge on the purchase header.

---

## Phase 5 — Frontend Service

**File:** `frontend/src/services/purchaseService.js`

Add:
```js
async cancelPurchase(purchaseId, { managerUsername, managerPassword, notes }) {
  return api.post(`${PURCHASES_URL}/${purchaseId}/cancel`, {
    managerUsername,
    managerPassword,
    notes,
  });
},
```

---

## Implementation Order

1. [ ] Phase 1 — Prisma schema: add `CANCELLED` to `PaymentStatus` enum + migration
2. [ ] Phase 2 — Backend `POST /purchases/:id/cancel` route with stock check, financial reversal, audit log
3. [ ] Phase 3 — Frontend: cancel button + confirmation + manager auth in Return modal
4. [ ] Phase 4 — Frontend: status labels, badges, disable interactions for cancelled purchases
5. [ ] Phase 5 — Add `cancelPurchase` to purchase service
6. [ ] Manual test: create purchase → cancel → verify stock reversed → verify treasury/supplier account reversed → verify history shows "ملغي"

---

## Files to Change

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `CANCELLED` to `PaymentStatus` enum |
| `backend/prisma/migrations/...` | Auto-generated migration |
| `backend/routes/purchases.js` | Add `POST /:id/cancel` route |
| `frontend/src/pages/purchases/PurchaseReturnModal.jsx` | Add "إلغاء الفاتورة بالكامل" button, confirmation, handler |
| `frontend/src/pages/purchases/PurchasesPage.jsx` | Update `psLabel`/`psClass` for CANCELLED status, disable actions |
| `frontend/src/pages/reports/history/PurchaseDetailsModal.jsx` | Add cancel button + cancelled badge |
| `frontend/src/services/purchaseService.js` | Add `cancelPurchase` method |
