# Call Center — Hardening & Gap-Close Plan

Follow-up to `plans/call-center-design.md` Phases 1–3. This document phases the
senior-review findings + missing UX items into shippable PRs.

Scope recap:
- **Critical (data integrity):** C1, C2, C3, C4
- **Significant (real-time + finance):** S1, S6
- **Policy:** cancellation reason taxonomy + `cancelledById`
- **Tests:** the three tests from `call-center-design.md` §9
- **UX:** "who claimed it", discount on call-center orders, catalog category filter chips

Each phase is one PR. Ship in order — later phases depend on earlier invariants.

---

## Phase 4 — Data integrity (C1, C2, C3)

**Goal:** The `Order ↔ Sale` pair never drifts. Stock deduction cannot
over-sell under concurrent agents.

### 4.1 POS delivery endpoints sync `Order` + `paidAt` (C1, C2)
- File: [backend/routes/sales.js](../backend/routes/sales.js)
  - `PATCH /:id/mark-delivered` (≈L999–L1044):
    - Wrap in `prisma.$transaction`.
    - If sale has a linked `Order`: update `Order.status = DELIVERED`,
      `Order.deliveredAt = now`.
    - Set `sale.paidAt = now` when `paymentMethod IN ('CASH','CARD')` and
      `paidAt` is null.
    - After commit: `publishStatusChange(order)` via eventBus.
  - `PATCH /:id/dispatch-delivery` (≈L1048–L1124):
    - Wrap in `prisma.$transaction`.
    - Update `Order.status = OUT_FOR_DELIVERY`, `Order.dispatchedAt = now`,
      `Order.shiftId = currentShiftId` (null-safe).
    - Publish status change after commit.

### 4.2 Atomic stock decrement (C3)
- File: [backend/controllers/callCenter.controller.js](../backend/controllers/callCenter.controller.js)
  - Replace the `findUnique → update` pair with a single conditional write
    inside the transaction:
    ```js
    const res = await tx.product.updateMany({
      where: { id: productId, quantity: { gte: requestedQty } },
      data:  { quantity: { decrement: requestedQty } },
    });
    if (res.count === 0) throw new AppError('INSUFFICIENT_STOCK', 409);
    ```
  - Keep the existing `upsert` reversal on cancel (idempotent).

### 4.3 Deliverables
- One PR titled `fix(call-center): order/sale sync + atomic stock`.
- Manual test matrix (document in PR body):
  1. POS cash sale → mark delivered → `Order.status === DELIVERED`,
     `Sale.paidAt` set.
  2. POS COD sale → dispatch → close shift → row attributed to correct shift.
  3. Two browsers claim the last unit of a product → one succeeds,
     one receives `INSUFFICIENT_STOCK`.

---

## Phase 5 — Real-time replay + tray (C4, S1)

**Goal:** Cashier UI survives reconnects without losing status transitions;
tray reacts to status changes from other cashiers.

### 5.1 Persist `ORDER_STATUS_CHANGED` (C4)
- File: [backend/routes/orders.js](../backend/routes/orders.js) — `broadcastStatusChange`:
  - For each active cashier of the branch, create a `Notification` row
    (`type = ORDER_STATUS_CHANGED`, payload `{ orderId, status, branchId }`).
  - Publish via eventBus with the persisted row `id` (enables
    `Last-Event-ID` replay).
- File: [backend/lib/notificationPurge.js](../backend/lib/notificationPurge.js):
  - Confirm TTL covers the new rows (it already does — same table).
- File: [frontend/src/contexts/RealtimeNotificationsContext.jsx](../frontend/src/contexts/RealtimeNotificationsContext.jsx):
  - On `ORDER_STATUS_CHANGED`: trigger `refresh()`, **do not** increment
    `unreadCount`, **do not** prepend into the visible list (keep bell
    focused on `NEW_CALL_CENTER_ORDER`). Dedupe by `id` same as now.

### 5.2 Tray refreshes on status changes (S1)
- File: [frontend/src/components/orders/IncomingOrderTray.jsx](../frontend/src/components/orders/IncomingOrderTray.jsx):
  - Subscribe to `eventStream` directly (not keyed on
    `notifications[0]?.id`).
  - On `ORDER_STATUS_CHANGED` where `payload.branchId === activeBranchId`:
    re-fetch incoming list.
  - On `NEW_CALL_CENTER_ORDER` for this branch: same.

### 5.3 Deliverables
- PR titled `fix(realtime): persist status events + tray live refresh`.

---

## Phase 6 — Shift cash accuracy (S6)

**Goal:** `expectedCash` on close reflects money actually in the drawer, not
COD floating in the delivery fleet.

### 6.1 `calculateSystemExpectedCash`
- File: [backend/routes/shifts.js](../backend/routes/shifts.js):
  - For each CASH sale in the shift:
    - If sale has no linked `Order` (walk-in POS): count it.
    - If sale has a linked `Order`: count **only** when
      `Order.status === DELIVERED` AND `Order.shiftId === currentShiftId`.
  - Return breakdown in the response:
    ```json
    { "posCash": ..., "codDeliveredThisShift": ..., "codPendingExcluded": ... }
    ```
- Frontend close-shift dialog: show the three-line breakdown so cashier sees
  *why* expected cash is lower than total CASH sales for the day.

### 6.2 Deliverables
- PR `fix(shifts): exclude in-flight COD from expected cash`.
- Test: open shift → create COD order → dispatch → close shift without
  delivering → `expectedCash` does not include that sale.

---

## Phase 7 — Cancellation taxonomy + `cancelledById`

**Goal:** Cancellations are reportable (reason) and attributable (who).

### 7.1 Schema
- File: [backend/prisma/schema.prisma](../backend/prisma/schema.prisma):
  ```prisma
  enum OrderCancellationReason {
    CUSTOMER_REQUEST
    OUT_OF_STOCK
    WRONG_ADDRESS
    NO_ANSWER
    DUPLICATE
    OTHER
  }
  model Order {
    // ...
    cancellationReason OrderCancellationReason?
    cancellationNote   String?
    cancelledById      Int?
    cancelledBy        User? @relation("OrderCancelledBy", fields: [cancelledById], references: [id])
  }
  ```
- Migration: `add_order_cancellation_fields`.

### 7.2 Backend
- File: [backend/controllers/callCenter.controller.js](../backend/controllers/callCenter.controller.js) cancel endpoint:
  - Body: `{ reason, note? }`. Validate reason against enum.
  - Stamp `cancelledById = req.user.id`, `cancelledAt = now`.
  - Keep stock reversal.

### 7.3 Frontend
- Cancel dialog: required dropdown (6 reasons) + optional textarea.
- Order detail view: show "أُلغيت بواسطة {name} — {reason}".

### 7.4 Reports
- File: [backend/routes/reports.js](../backend/routes/reports.js) call-center
  report: add `cancellationsByReason: [{ reason, count }]`.
- File: [frontend/src/pages/reports/CallCenterReportPage.jsx](../frontend/src/pages/reports/CallCenterReportPage.jsx): new table "أسباب الإلغاء".

### 7.5 Deliverables
- PR `feat(orders): cancellation reason taxonomy + attribution`.

---

## Phase 8 — UX: claim attribution, discount, catalog chips

### 8.1 "Who claimed it"
- Schema: `Order.claimedById Int?`, `Order.claimedAt DateTime?`. Migration.
- Backend: on first `NEW → PREPARING` transition in
  [backend/routes/orders.js](../backend/routes/orders.js), stamp
  `claimedById = req.user.id`, `claimedAt = now` (only if null — first win).
- POS tray row: if `claimedById` set and not me, show
  "بواسطة: {cashier.name}" and disable the claim button (row stays visible).
- Call-center list: "تم الاستلام بواسطة …" badge.

### 8.2 Discount on call-center orders
- File: [frontend/src/pages/call-center/CallCenterNewOrderPage.jsx](../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx):
  - Add discount control (amount + type `FLAT|PERCENT`), mirroring POS.
  - Send in create payload.
- File: [backend/controllers/callCenter.controller.js](../backend/controllers/callCenter.controller.js):
  - Accept + validate `discount`, `discountType`. Cap at subtotal.
  - Permission-gate with the same role check POS uses.
  - Apply to `Sale.total`; include line on print ticket.
- File: [frontend/src/components/orders/PrintTicket.jsx](../frontend/src/components/orders/PrintTicket.jsx): render discount line if present.

### 8.3 Catalog category filter chips
- File: [frontend/src/pages/call-center/CallCenterNewOrderPage.jsx](../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx):
  - Derive unique categories from loaded products.
  - Horizontal scrollable chip row above the product grid: "الكل" + one chip per category.
  - Active chip filters the grid client-side (same as POS behavior).

### 8.4 Deliverables
- PR `feat(call-center): claim attribution, discount, catalog chips`.

---

## Phase 9 — Tests (design §9)

### 9.1 Unit — `orderService`
- File: `backend/tests/orderService.test.js` (new).
- Cases:
  1. `createOrderInTx` persists Sale + Order with correct channel, status,
     timestamps.
  2. `publishNewOrderNotifications` writes exactly one Notification row per
     active cashier of the branch (mock Prisma + eventBus).

### 9.2 Integration — SSE replay
- File: `backend/tests/events.integration.test.js` (new).
- Boot the Express app on an ephemeral port. Use `eventsource` client.
- Cases:
  1. Connect with JWT → publish `NEW_CALL_CENTER_ORDER` → client receives it.
  2. Disconnect → publish event → reconnect with `Last-Event-ID` →
     assert replay delivers the missed row.

### 9.3 E2E — Playwright flow
- File: `frontend/e2e/call-center-flow.spec.js` (new).
- Scenario (two browser contexts: agent + cashier):
  1. Agent creates a call-center order.
  2. Cashier tray shows it; cashier claims → status `PREPARING`.
  3. Walk the chain to `DELIVERED`.
  4. Close shift → expected cash includes the COD only if delivered this shift.
  5. Sales report with `source=CALL_CENTER` lists the sale.

### 9.4 Deliverables
- PR `test(call-center): unit + SSE integration + e2e`.
- CI wiring: add the new suites to existing test job; Playwright behind a
  separate job (optional flag for local-only if CI is slow).

---

## Rollout order & dependencies

| Phase | Depends on | Risk        | Rollback                              |
| ----- | ---------- | ----------- | ------------------------------------- |
| 4     | —          | Medium (tx) | Revert PR; no migration.              |
| 5     | 4          | Low         | Revert PR; notification rows harmless.|
| 6     | 4          | Medium (£)  | Feature flag `shiftCodExclude`.       |
| 7     | —          | Low (migr.) | Migration adds nullable cols only.    |
| 8     | 7 (claim)  | Low (migr.) | Nullable cols.                        |
| 9     | all        | None        | Test-only.                            |

Phases 4 and 7 can run in parallel (different files). Everything else
serializes on Phase 4.

---

## Out of scope (tracked separately)

From the senior review, deferred to a future plan:
- C5 duplicated `generateSaleNumber` (cosmetic dedupe).
- S2 saleNumber generated outside transaction (race is theoretical).
- S7 DailyTransactions server-side source filter (client-side is fine for
  current volume).
- Remaining 9 salesman-lens UX items (re-order, ETA, draft, VIP, landmark,
  cancel-reason dropdown already covered by Phase 7, etc.).
