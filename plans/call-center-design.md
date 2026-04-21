# Call Center Role — Design Document & Implementation Plan

**Status:** Approved for implementation
**Author:** Claude (brainstorming session, 2026-04-19)
**Source of truth for answers:** [call-center-brainstorming.md](call-center-brainstorming.md)

---

## 1. Understanding Summary

- **What we're building:** A new `CALL_CENTER` role that takes delivery orders by phone, routes them to a branch, and notifies the cashier(s) with an open shift at that branch so they can print the ticket and dispatch delivery.
- **Why:** Formalize a channel that exists today only informally — let a regional call-center team serve multiple branches with unified reporting, COD payment tracking, and inventory consistency.
- **Who uses it:**
  - **Call-center agents** (new role, regional — assigned to a set of branches via existing `accessibleBranches`).
  - **Cashiers** (existing) who receive notifications and act at the branch.
  - **Delivery men** (existing) who collect COD.
  - **Admins** configure the new role's permissions in the existing superadmin dashboard.
- **Key constraints:**
  - All call-center orders are **delivery + COD** (cash on delivery).
  - Stock is deducted **at order creation**.
  - Notification latency target: **≤ 30 seconds** (polling is sufficient).
  - UI is **Arabic-first RTL**, desktop + tablet.
  - Phased rollout (role+creation → notifications → reports).
- **Explicit non-goals:**
  - No pre-paid / card payments at call-center (COD only).
  - No dine-in or pickup orders.
  - No SMS/email notifications, no physical receipt printer integration (in-browser print dialog only).
  - No separate preparation-staff login or shared kitchen display (per Q1-B: prep is a workflow stage, not an actor).
  - No multi-address-per-client (one address per client).
  - No REJECTED status (only CANCELLED while NEW).

---

## 2. Assumptions

1. **Order volume** is > 2000 orders/day across all branches (confirmed). Polling still fits because server load scales with the *number of cashiers polling*, not orders/day (~40 req/min for ~10 concurrent cashiers at 15s interval). We revisit the transport layer only if cashier count grows past ~50 concurrent or if latency complaints appear.
2. **Concurrent call-center agents** is low (< 20 sessions). Single `regionalAgent` table not needed; existing `User.accessibleBranches` suffices.
3. The existing `Sale` model is the right place to extend — it already has `deliveryManId`, `deliveryZoneId`, `deliveryAddress`, `deliveryStatus`, `paymentMethod`. Adding `source` and expanding `deliveryStatus` is cheaper than a parallel `Order` model.
4. The cashier's POS page is already polling something (or can be made to). A 15-second polling interval for pending notifications is acceptable.
5. COD is represented with `paymentMethod = CASH` on the Sale, plus a new `paidAt` timestamp to distinguish "Sale created, cash not yet collected" from "Sale paid".
6. Shift-attribution of a call-center sale = the shift that was open **at the target branch** when the order was **dispatched** (status moved to OUT_FOR_DELIVERY). This keeps COD cash owned by whoever hands off to the driver.
7. No existing call-center data to migrate (greenfield feature).
8. "Print the order" means the in-browser print dialog on an **80mm thermal-printer ticket template** (confirmed) — compact, single-column Arabic RTL layout sized for receipt printers.

---

## 3. Decision Log

| # | Decision | Alternatives considered | Why this option |
|---|---|---|---|
| D1 | **New role is dynamic** — seeded via existing `Role` table, not a new enum value. Admin configures its permissions in superadmin UI. | Hard-coded role enum. | Matches existing pattern (roles are already data, not enum). Keeps superadmin flexible. |
| D2 | **Hybrid — new `Order` entity 1:1 with `Sale`.** `Order` holds workflow state (`status`, `channel`, lifecycle timestamps); `Sale` remains the immutable financial record created upfront so inventory/reporting paths are unchanged. | (a) Extend `Sale` directly (god-object risk as channels grow); (b) Fully separate `Order` promoted to `Sale` at finalize (more rework, inventory-timing complexity). | Future channels (WhatsApp, web, aggregators) plug into `Order` without touching `Sale`. Keeps financial reporting single-source. Low migration risk. |
| D3 | **Stock deducted at order creation**, reversed on CANCELLED-while-NEW. | Deduct at READY / at delivery. | User's explicit choice (Q12-A). Prevents over-selling at the branch. Cancel window is limited to NEW which bounds reversal complexity. |
| D4 | **Cancel only while status = NEW**. | Allow cancel any time with admin override. | User's explicit choice (Q11-D). Keeps state machine simple. Cashier/delivery flow owns the order after NEW. |
| D5 | **Notifications = Server-Sent Events (SSE).** Endpoint `GET /api/events/stream` holds an HTTP connection per authenticated cashier; server pushes JSON events. Client auto-reconnects with `Last-Event-ID` to replay missed events from the `Notification` table. | Polling (too laggy, doesn't scale with cashier count); WebSocket (bidirectional overhead we don't need). | Scales to thousands of clients per Node instance, works through most proxies, minimal infra. Cashier flow is pure server-push — SSE fits perfectly. |
| D6 | **Broadcast to all open-shift cashiers at the branch.** | Primary-only, round-robin. | Simplest, no ownership contention. Cashiers self-coordinate. First one to "claim" an order (move to PREPARING) auto-acknowledges for the others. |
| D7 | **Queue orders when no shift is open**, auto-fire notification when any shift opens at that branch. | Reject at creation. | User's explicit choice (Q16-B). Aligns with business reality where call-center runs outside branch hours. |
| D8 | **Notifications persisted with `readAt` flag + 30-day TTL.** Cron job purges rows older than 30 days. Supports reconnect-replay (SSE `Last-Event-ID`) and a "Notifications" panel. | Auto-delete on ack (loses replay + audit); keep forever (unbounded growth). | Scalable-from-start requires reconnect-replay. TTL bounds table size. Read/unread flag drives badge counts and history UI. |
| D9 | **Shift attribution for COD** = shift open at dispatch (OUT_FOR_DELIVERY transition). | At order creation, at delivery. | COD cash physically arrives back at the branch with the driver; the cashier who dispatched owns it during their shift. |
| D10 | **Inline client-create by phone lookup.** | Pre-create in separate screen. | User's explicit choice (Q13-A). Reduces agent clicks on a repeat customer. |
| D11 | **One new module enum: `CALL_CENTER`.** Permissions for CLIENTS/ITEMS/DELIVERY_ZONES auto-implied via endpoint scoping (agent only reads what CALL_CENTER needs). | Grant multiple existing modules. | Single responsibility; admin assigns one permission to enable the role. |
| D12 | **Prices visible, cost hidden** in the call-center agent UI. | Show both. | User's explicit choice (Q24-A). Standard sales-agent boundary. |
| D13 | **Agents see all call-center orders company-wide** (read), can only create/cancel those at branches they have access to (write). | Self-only, branch-scoped read. | User's explicit choice (Q25-A) gives visibility; write-scoping via `accessibleBranches` protects integrity. |
| D14 | **`EventBus` abstraction with in-memory adapter now; Redis pub/sub adapter ready to swap in.** All notification dispatch goes through the interface. | Redis from day one (infra cost upfront); ignore multi-instance concerns (not scalable). | Architecture is horizontally-scale-ready without paying ops cost today. Flipping to Redis = config change + one adapter file. |
| D15 | **`Order.channel` is an open enum** seeded with `POS`, `CALL_CENTER`, reserved values `WHATSAPP`, `WEB`, `AGGREGATOR` (unused). | Hard-code only the two live values; build a full plugin framework. | One-line future-proofing. Future channels ship without schema migration or enum rename. |

---

## 4. Architecture Overview

```
┌──────────────────────────┐                     ┌───────────────────────────┐
│  Call-Center Agent (UI)  │                     │  Cashier POS (UI)         │
│  - Branch picker         │  POST /api/call-    │  - Polling /notifications │
│  - Client search/create  │ ─── center/orders ─→│  - Toast + badge + sound  │
│  - Item cart (prices)    │                     │  - Queue: new orders      │
│  - Delivery zone picker  │                     │  - Print ticket           │
│  - Confirm order (NEW)   │                     │  - Assign delivery man    │
└──────────────────────────┘                     │  - Status transitions     │
                                                 └──────────┬────────────────┘
                                                            │
                                                            ▼
                                              ┌──────────────────────────┐
                                              │ Delivery Man (out-of-app) │
                                              │ Collects COD, returns    │
                                              │ cash + status = DELIVERED│
                                              └──────────────────────────┘

             ┌─────────────────────────────────────────────────────────┐
             │                      Backend                            │
             │  ┌────────────┐   ┌──────────────┐   ┌──────────────┐  │
             │  │ callCenter │──▶│   Sale       │◀──│  Inventory   │  │
             │  │ controller │   │ (source,     │   │ (deduct/     │  │
             │  │            │   │  orderStatus,│   │  reverse)    │  │
             │  │            │   │  paidAt)     │   │              │  │
             │  └─────┬──────┘   └──────┬───────┘   └──────────────┘  │
             │        │                  │                             │
             │        ▼                  ▼                             │
             │  ┌──────────────┐   ┌─────────────┐                     │
             │  │ Notification │   │  Shift      │                     │
             │  │ (per-user,   │   │  (find open │                     │
             │  │  pending)    │   │  cashiers)  │                     │
             │  └──────────────┘   └─────────────┘                     │
             └─────────────────────────────────────────────────────────┘
```

---

## 5. Data Model Changes

### 5.1 New `Module` enum value
```prisma
enum Module {
  // ... existing values ...
  CALL_CENTER
}
```

### 5.2 New `Order` entity (workflow layer) + minimal `Sale` additions

```prisma
enum OrderChannel {
  POS
  CALL_CENTER
  WHATSAPP    // reserved
  WEB         // reserved
  AGGREGATOR  // reserved
}

enum OrderStatus {
  NEW
  PREPARING
  READY
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

model Order {
  id          Int           @id @default(autoincrement())
  saleId      Int           @unique @map("sale_id")  // 1:1 with Sale
  channel     OrderChannel  @default(POS)
  status      OrderStatus   @default(NEW)
  branchId    Int           @map("branch_id")
  createdById Int           @map("created_by_id")    // the call-center agent (or cashier for POS)
  claimedById Int?          @map("claimed_by_id")    // cashier who moved NEW → PREPARING
  claimedAt   DateTime?     @map("claimed_at")
  readyAt     DateTime?     @map("ready_at")
  dispatchedAt DateTime?    @map("dispatched_at")
  deliveredAt  DateTime?    @map("delivered_at")
  cancelledAt  DateTime?    @map("cancelled_at")
  cancelReason String?      @map("cancel_reason") @db.Text
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  sale       Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  branch     Branch  @relation(fields: [branchId], references: [id])
  createdBy  User    @relation("OrderCreatedBy", fields: [createdById], references: [id])
  claimedBy  User?   @relation("OrderClaimedBy", fields: [claimedById], references: [id])

  @@index([channel, status, branchId])  // cashier queue lookup
  @@index([createdById, createdAt])     // agent-filtered views
  @@map("orders")
}

model Sale {
  // ... existing fields ...
  paidAt DateTime? @map("paid_at")   // null while COD in-flight; set when delivery completes or POS finalizes
  order  Order?                       // 1:1 reverse relation

  // source/orderStatus intentionally NOT added — workflow lives on Order
}
```

**Migration note:** Backfill creates an `Order` row for every existing `Sale` with `channel = POS`, `status = DELIVERED`, `deliveredAt = sale.createdAt`, `paidAt = sale.createdAt`. POS sales continue creating an Order transparently (the POS flow wraps the existing sale-create transaction to insert a matching Order at `DELIVERED`). This keeps all future reporting channel-aware with zero ambiguity.

### 5.3 New `Notification` model (persistent, with read-state + TTL)

```prisma
model Notification {
  id         Int              @id @default(autoincrement())
  userId     Int              @map("user_id")
  branchId   Int?             @map("branch_id")
  type       NotificationType
  payload    Json             // { orderId, saleId, clientName, itemsCount, total }
  readAt     DateTime?        @map("read_at")        // null = unread
  createdAt  DateTime         @default(now()) @map("created_at")

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)

  @@index([userId, readAt, createdAt])   // unread badge + history paging
  @@index([createdAt])                    // TTL purge job
  @@map("notifications")
}

enum NotificationType {
  NEW_CALL_CENTER_ORDER
  ORDER_STATUS_CHANGED  // future-proof: used when call-center agent wants to see cashier actions on their orders
}
```
> Rows retained 30 days; daily cron job purges older. `readAt` set via ack endpoint and via SSE `Last-Event-ID` replay on reconnect.

### 5.4 `User` — add reverse relation
```prisma
notifications Notification[]
```

---

## 6. Backend Design

### 6.1 New route group: `routes/callCenter.js`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET`  | `/api/call-center/branches`          | `CALL_CENTER` | List agent's accessible branches |
| `GET`  | `/api/call-center/items?branchId=X`  | `CALL_CENTER` | Master catalog + stock at branch X + price (no cost) |
| `GET`  | `/api/call-center/clients?phone=...` | `CALL_CENTER` | Lookup client by phone |
| `POST` | `/api/call-center/clients`           | `CALL_CENTER` | Inline create (name, phone, address, zone) |
| `POST` | `/api/call-center/orders`            | `CALL_CENTER` | Create order (validates branch access, deducts stock, creates `Notification` rows, returns saleId) |
| `GET`  | `/api/call-center/orders`            | `CALL_CENTER` | List all call-center orders (company-wide, paginated) |
| `POST` | `/api/call-center/orders/:id/cancel` | `CALL_CENTER` | Cancel while status = NEW; reverse stock |

### 6.2 Extend existing routes

| Route | Change |
|---|---|
| `routes/sales.js` | Every sale-create path also creates a matching `Order` row (channel derived from request context; defaults to `POS`, status `DELIVERED` for direct-finalize POS sales). Accept `?channel=CALL_CENTER` filter and include joined `order` in responses. |
| `routes/shifts.js` | When a shift transitions to OPEN, call `orderService.drainPendingForBranch(branchId, userId)` — finds all `Order.channel != POS AND status = NEW AND branchId = X`, publishes a `NEW_CALL_CENTER_ORDER` event for the opening user via `EventBus`, persists `Notification` rows. |
| `routes/reports.js` | Add `/api/reports/call-center` (agent KPIs, avg prep time, cancellation %, revenue by channel). |

### 6.3 Notifications & real-time event stream

**`routes/events.js` (SSE)**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/events/ticket` | Authed (normal Bearer token). Issues a single-use 24-byte base64url ticket, 30s TTL, stored in memory. Consumed on first use. Keeps the long-lived JWT out of URLs. |
| `GET`  | `/api/events/stream` | Long-lived SSE connection. Auth via `?ticket=<opaque>`. Supports `Last-Event-ID` header (and `?lastEventId=N` query for `EventSource` compatibility) for replay of missed events from the `Notification` table. Each event is a JSON object with `id`, `type`, `payload`. Heartbeat every 25s to keep proxies from closing the connection. If `lastEventId < MIN(Notification.id)` (i.e. the client was offline past the 30d TTL), the server emits a synthetic `replay-truncated` event so the client refetches state via REST instead of silently believing it is caught up. |

**`routes/notifications.js` (REST — history + ack)**

| Method | Path | Purpose |
|---|---|---|
| `GET`   | `/api/notifications` | Paginated history (last 30d). Filters: `unreadOnly`, `type`. |
| `PATCH` | `/api/notifications/:id/read` | Mark one as read. |
| `PATCH` | `/api/notifications/read-by-order/:orderId` | Bulk mark-read when a cashier claims an order (auto-dismisses the broadcast for all other cashiers). |
| `POST`  | `/api/notifications/read-all` | Mark all as read. |

**`EventBus` interface** (`backend/lib/eventBus.js`)

```js
// interface EventBus { publish(topic, event): Promise<void>; subscribe(topic, handler): Unsubscribe }

// Default adapter: InMemoryEventBus (EventEmitter-backed). Single-instance safe.
// Swap-in adapter: RedisEventBus (pub/sub). Multi-instance safe. Activated via env var EVENT_BUS=redis.
```

All notification dispatch flows through `eventBus.publish('notifications:user:<id>', event)`. The SSE route subscribes per connected user. No controller references `process.emit` or direct EventEmitter — always via the bus.

### 6.4 Cashier-side endpoints on the new Orders route

**`routes/orders.js`**

| Method | Path | Purpose |
|---|---|---|
| `GET`   | `/api/orders/queue?branchId=X` | List `channel != POS AND status IN (NEW, PREPARING, READY) AND branchId=X`. Drives the cashier's "Incoming Orders" panel. |
| `GET`   | `/api/orders/:id`              | Order detail (joins Sale + SaleItems + Client + DeliveryZone). |
| `PATCH` | `/api/orders/:id/status`       | State machine: NEW→PREPARING (sets `claimedById`+`claimedAt`), PREPARING→READY (sets `readyAt`), READY→OUT_FOR_DELIVERY (requires `deliveryManId`, sets `dispatchedAt` + `sale.shiftId` = actor's current open shift), OUT_FOR_DELIVERY→DELIVERED (sets `deliveredAt` + `sale.paidAt`). Publishes `ORDER_STATUS_CHANGED` event. |

### 6.5 State machine

```
   NEW ──(cashier: start)──▶ PREPARING ──(cashier: ready)──▶ READY
    │                                                          │
    │(call-center: cancel)                                      │
    ▼                                                           │
 CANCELLED                                       (cashier: dispatch, requires deliveryManId)
                                                                │
                                                                ▼
                                                        OUT_FOR_DELIVERY
                                                                │
                                                (cashier/delivery: delivered, sets paidAt)
                                                                │
                                                                ▼
                                                            DELIVERED
```

Any transition is audit-logged via existing `auditCapture` middleware.

### 6.6 Stock handling

- **On order creation** (NEW): same `Inventory` deduction path used by POS sales. Wrap in the same Prisma transaction as `Sale` + `SaleItem` + `Notification` inserts.
- **On CANCELLED (while NEW)**: reverse each `SaleItem` back into `Inventory` in a transaction. No other state allows cancel, so no other reversal paths exist.

### 6.7 Shift attribution

- Sale is created with `shiftId = null`.
- When `orderStatus` transitions to `OUT_FOR_DELIVERY`, set `shiftId = <current open shift at sale.branchId for the acting cashier>`.
- Shift cash-reconciliation report already sums sales by `shiftId` — it picks these up automatically after that transition.

---

## 7. Frontend Design

### 7.1 Pages (new)

| Path | Page | Access |
|---|---|---|
| `/call-center/new` | Order entry form | `CALL_CENTER` module |
| `/call-center/orders` | Orders list (company-wide, with filters + cancel button) | `CALL_CENTER` module |

### 7.2 Pages (modified)

| Page | Change |
|---|---|
| `/pos` | Add a floating "Incoming Orders" tray: badge + list of `NEW`/`PREPARING`/`READY` orders for the open shift's branch. Click → order detail → print + transition buttons. |
| `/sales` (report) | Add `Source` column + filter chip (All / POS / Call Center). |
| `/superadmin` (roles) | No code change — the new `CALL_CENTER` module appears automatically in the existing permission-grid. |

### 7.3 New components

- `CallCenterOrderForm` — client search (debounced `phone`), inline create form, item cart with stock warning, zone picker, confirm button.
- `IncomingOrderTray` — the toast/badge UI inside POS. Sound + browser notification on arrival.
- `OrderStatusBadge` — colored pill (NEW=red, PREPARING=yellow, READY=blue, OUT_FOR_DELIVERY=purple, DELIVERED=green, CANCELLED=gray).
- `PrintTicket` — browser-native `window.print()` wrapped template (Arabic RTL, **80mm thermal width**, `@page { size: 80mm auto }`).

### 7.4 New services

- `callCenterService.js` — wraps the new `/api/call-center/*` endpoints.
- `notificationService.js` — REST history (`list`, `markRead`, `markAllRead`).
- `eventStreamService.js` — opens the SSE connection to `/api/events/stream`, persists `lastEventId` in `localStorage`, auto-reconnects with exponential backoff (1s → 30s cap) + `Last-Event-ID` header for replay. Emits domain events via a React context.
- React hook: `useRealtimeNotifications()` — consumes the event stream context, renders toasts + browser notifications + beep for `NEW_CALL_CENTER_ORDER`, exposes unread count to the POS badge, exposes the "Incoming Orders" list (merged from initial REST fetch + live events).

### 7.5 Sound + browser-notification UX

- Sound: a short generic `ding.mp3` shipped in `public/sounds/`, played via `new Audio(...).play()`. Guarded behind a user-interaction gate (browser autoplay policy) — cashier must click "Enable alerts" once per session.
- Browser notification: `Notification.requestPermission()` on first load, wrapped behind the same gate.

---

## 8. Edge Cases & Error Handling

| Case | Handling |
|---|---|
| Agent selects branch they don't have access to (tampered request) | 403 at `POST /api/call-center/orders` — server re-validates `accessibleBranches`. |
| Item goes out of stock between picking and confirming | Server rejects with `OUT_OF_STOCK` (specific itemId). UI shows error, refreshes stock. |
| No cashier has an open shift at target branch (Q16-B) | Order still created as `NEW`. No `Notification` row yet. On next shift-open at that branch, shift controller fires the drain. |
| Cashier A clicks PREPARING → Cashier B's tray keeps showing NEW | `PATCH /api/sales/:id/status` also deletes all `Notification` rows for that saleId → all cashier trays remove it on next poll. |
| Call-center cancels an order that a cashier already started preparing | Cancel is blocked server-side (`orderStatus != NEW`). UI shows error. |
| SSE connection drops (proxy timeout, network blip) | Client auto-reconnects with `Last-Event-ID` header; server replays missed events from `Notification` table. No lost events. |
| Backend restart mid-connection | Client reconnect triggers replay; heartbeat detects dead connections within 25s. |
| Token expires during SSE session | Server closes stream with 401; client hook surfaces re-auth prompt, reopens stream on new token. |
| Multi-instance deployment with in-memory bus | Interface is abstracted — flip `EVENT_BUS=redis` env var and deploy; no code changes. |
| Stock reversal fails on cancel | Transaction rollback; order stays NEW; UI shows retry. |
| Shift transitions to OUT_FOR_DELIVERY but no open shift exists (cashier closed shift mid-flight) | Block the transition with "Open a shift first". |
| Two agents create two orders for the same client at the same branch within seconds | Both succeed (not a uniqueness violation); broadcast creates two notifications. |

---

## 9. Testing Strategy

1. **Backend unit tests** — state machine transitions (valid & invalid), stock deduction/reversal, broadcast to multiple open shifts, shift-drain on open.
2. **Backend integration test** — end-to-end: agent creates → cashier polls → notification appears → cashier dispatches → stock deducted → sale appears in shift report with attributed `shiftId`.
3. **Frontend E2E (Playwright)** — one "happy path" flow in `e2e/`: login as agent, create order, login as cashier (2nd browser context), notification shows, print ticket, assign delivery man, dispatch.
4. **Regression** — existing POS sales must still produce `source = POS` and bypass the order-status UI entirely.

---

## 10. Implementation Plan (phased, per Q32-B)

### Phase 1 — Role + Order entity + Order creation (~4–6 days)

**Schema + seeding**
- [ ] Add `CALL_CENTER` to `Module` enum.
- [ ] Add `OrderChannel`, `OrderStatus` enums + new `Order` model.
- [ ] Add `paidAt` field on `Sale`.
- [ ] Add `Notification` model + `NotificationType` enum (with `readAt` + TTL indexes).
- [ ] Prisma migration with backfill: create `Order` row for every existing Sale at channel=POS, status=DELIVERED.
- [ ] Seed "Call Center" `Role` with `CALL_CENTER` permission.

**Backend — shared infra**
- [ ] `lib/eventBus.js` — interface + `InMemoryEventBus` implementation. Stub `RedisEventBus` file (not wired).
- [ ] `lib/orderService.js` — shared helper to create `Order` rows alongside Sale creates (called from POS sale controller and call-center controller).

**Backend — call-center**
- [ ] `routes/callCenter.js` (branches, items w/ stock, client lookup, client create, order create, order list, order cancel).
- [ ] `controllers/callCenter.controller.js` — order-create transaction: Sale + SaleItems + Order + stock deduction + notification publish via EventBus.
- [ ] Extend `routes/sales.js` POS sale-create path to also insert `Order` row.
- [ ] Register routes in `backend/index.js`.

**Frontend**
- [ ] `callCenterService.js`.
- [ ] Nav entry gated on `CALL_CENTER` permission.
- [ ] `/call-center/new` — `CallCenterOrderForm`.
- [ ] `/call-center/orders` — list + cancel.

**Tests**
- [ ] Unit: order+sale transaction, stock deduction, cancel reversal, EventBus publish.
- [ ] Smoke: create + list + cancel via API.

### Phase 2 — SSE + Cashier queue (~3–4 days)

**Backend**
- [ ] `routes/events.js` — SSE endpoint with auth, heartbeat, `Last-Event-ID` replay from `Notification` table.
- [ ] `routes/notifications.js` — REST history (`GET`, `PATCH /:id/read`, `PATCH /read-by-order/:orderId`, `POST /read-all`).
- [ ] `routes/orders.js` — `GET /queue`, `GET /:id`, `PATCH /:id/status` (state machine + shift attribution + event publish).
- [ ] Shift-open hook: drain pending NEW orders for branch via `EventBus`.
- [ ] TTL cron: daily purge of notifications older than 30d.

**Frontend**
- [ ] `eventStreamService.js` (SSE client, auto-reconnect, `Last-Event-ID` persistence).
- [ ] `notificationService.js` (REST history).
- [ ] `useRealtimeNotifications` hook + React context provider at app root.
- [ ] `IncomingOrderTray` in POS.
- [ ] `OrderStatusBadge`, `PrintTicket` (80mm thermal RTL).
- [ ] Cashier flow: tray → detail → print → assign delivery man → dispatch.
- [ ] "Enable alerts" gate (sound + browser-notification permission).
- [ ] Notifications history panel.

**Tests**
- [ ] State-machine unit tests (valid + invalid transitions).
- [ ] SSE integration test: connect, publish, disconnect, reconnect with `Last-Event-ID`, replay.
- [ ] E2E: agent → cashier full flow.

### Phase 3 — Reports + polish (~1.5–2 days)

**Backend**
- [ ] `GET /api/reports/call-center` — orders/agent, avg prep time (CREATED → READY), cancellation %, orders/branch, revenue.
- [ ] Extend `GET /api/reports/sales` to support `source` filter.

**Frontend**
- [ ] New report page under `/reports/call-center`.
- [ ] Add `Source` column + filter to existing sales report page.
- [ ] Verify call-center orders appear correctly in shift cash-reconciliation.

**Polish**
- [ ] Arabic translation pass on all new strings.
- [ ] Tablet-viewport QA (1024×768 & 768×1024).
- [ ] Production-readiness: audit logs wired on every status transition, error messages localized.

---

## 11. Open Items — Resolved (2026-04-19)

1. **Volume:** > 2000 orders/day confirmed. Polling retained (load scales with cashier count, not orders).
2. **Print template:** 80mm thermal-printer width confirmed.
3. **Sound file:** generic `ding.mp3` — approved (assistant's choice).

All design items locked. Ready to start Phase 1 on user's signal.

---

## 12. Review Addenda (2026-04-21)

Folded in from [fix-consol-and-plan-review.md §B.2](fix-consol-and-plan-review.md). Each entry adjusts the corresponding section above.

### 12.1 Atomic NEW → PREPARING claim (finding 2.1.a)

§6.4 `PATCH /orders/:id/status` on the NEW → PREPARING transition must execute as a conditional update, not check-then-write:

```sql
UPDATE orders
  SET status='PREPARING', claimed_by_id=?, claimed_at=NOW()
  WHERE id=? AND status='NEW';
```

Inspect affected rows; if `!= 1`, return **409 `ALREADY_CLAIMED`**. The losing cashier's tray then refreshes to show the order in its new state. Integration test required.

### 12.2 Shift-drain broadcasts to all open shifts (finding 2.1.b)

§6.2 supersedes: when a cashier opens a shift at a branch, the drain publishes a `NEW_CALL_CENTER_ORDER` event **to every currently-open shift at that branch**, not only the opening user's shift. This matches Decision D6 (broadcast-to-all). Clients dedup by `Order.id` on arrival.

### 12.3 Cancel transaction is fully wrapped (finding 2.1.c)

§6.6 is explicit: `Inventory` credit + `Order.status = 'CANCELLED'` + `Sale` updates run inside a single `prisma.$transaction`. Integration test required that injects a failure after the inventory credit and asserts all writes rolled back.

### 12.4 Backfill runs in batches (finding 2.2.a)

§5.2 backfill — create `Order` row for every existing `Sale` — runs in **5,000-row chunks** with a short sleep between batches, scheduled during the next maintenance window. Migration file documents the chunked approach.

### 12.5 Drop `Order.branchId` (finding 2.2.b)

§5.2 schema updated: remove `branchId` from the `Order` model. Always join through `Sale` for branch context. Drop index `[channel, status, branchId]`; replace with `[channel, status]` plus the existing `Sale(branchId, id)` index. One source of truth — no drift possible between `Sale.branchId` and `Order.branchId`.

### 12.6 SSE auth = stream-ticket pattern (finding 2.3.a — **FIXED**)

§6.3 replaces JWT-in-URL with `POST /events/ticket` + `GET /events/stream?ticket=...`. See §6.3 above for the updated endpoint table. The long-lived JWT never travels in a URL (no proxy log / history / Referer leak). **Implemented in Part A.3 (backend `routes/events.js`, frontend `eventStreamService.js`).**

### 12.7 Replay-truncated signal (finding 2.3.b)

Already folded into the §6.3 endpoint description. Edge-cases table (§8) now contains:

| Case | Handling |
|---|---|
| Client reconnects with a `lastEventId` older than the `Notification` TTL horizon | Server emits `replay-truncated`; client refetches state via REST (`GET /orders/queue`, `GET /notifications?unreadOnly=true`) and resumes from the new max event id. |

### 12.8 Heartbeat interval (finding 2.3.c)

25s stays. Below Cloudflare Free's 100s idle cap. If the deployment target ever changes to a proxy with a tighter idle timeout, revisit the constant.

### 12.9 Dispatch authz rule (finding 2.4.a)

§6.4 adds: on the `OUT_FOR_DELIVERY` transition, the acting user must have an **open shift at the order's branch**. Otherwise return **403 `SHIFT_REQUIRED`**. Keeps D9's cash-attribution invariant tight — nobody without a shift can dispatch cash that has to land somewhere.

### 12.10 "Enable alerts" persistence (finding 2.4.b)

§7.5 updated: gate state persists in `localStorage` under `alertsEnabled=true`. One click per cashier per browser install, not per refresh.

### 12.11 Notification TTL index cost (finding 2.4.c)

Accepted at v1 volume: ~60k rows retained (2000 orders/day × 30d). The existing `[createdAt]` index supports the purge without degrading. Revisit only if the nightly purge job ever exceeds 10s.

### 12.12 Phase 1 — drop `RedisEventBus` stub (finding 2.4.d)

Phase 1 no longer ships a stub `RedisEventBus` file. The adapter is added when Redis is actually wired (post-v1 scaling trigger — currently no concrete trigger date).

---

**End of design doc.**
