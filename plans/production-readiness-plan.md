# Production Readiness Plan — Resolve All Review Findings

**Source of findings:** [review-summary.pdf](review-summary.pdf) · [fix-consol-and-plan-review.md](fix-consol-and-plan-review.md)

**Disposition baseline from Part B:** 41 findings total → 1 FIXED, 35 SPEC-UPDATED (need code), 4 DEFER, 1 DECIDE.
This plan takes the 35 spec-updated items and turns them into concrete code/test work, keeps the 4 defers out of scope, and calls out the 1 decide as a hard blocker for one workstream.

---

## 0 · Blocker to resolve before any POS-discount code lands

| ID | Severity | Owner ask |
|----|----------|-----------|
| **1.1.d** | HIGH | Finance/tech-lead ruling: does Egyptian VAT allow tax on the post-discount subtotal, or must it be computed on gross? |

This is **not** a blocker for call-center or bulk-pos work — those two workstreams can start immediately. It only blocks pos-discount. Default in the spec stays post-discount until the ruling comes in; changing it later is a one-line formula swap plus a migration on historical `tax_amount` fields (out of scope here — surface if the ruling flips).

---

## 1 · Cross-cutting prep (do once, before any workstream)

| Task | Reason | Files |
|------|--------|-------|
| Verify A.1/A.2/A.3 fixes are merged on `main` and the branch is rebased | Part A changes must not get reverted during Part C churn | `git log --oneline main` |
| Confirm `prisma migrate status` is clean on dev DB | New migrations will land in all three workstreams; drift causes confusing errors | `backend/prisma` |
| Add a shared `serializeDecimal()` helper if not present | Finding 3.12 (Decimal-in-audit) needs a single serialization path | [backend/middleware/auditCapture.js](../backend/middleware/auditCapture.js) |
| Add integration-test harness that boots the app + seeds a superadmin + calls a handful of endpoints | Catches the "wall of 500s" class bug in CI. Part A exposed we had no such test. | `backend/tests/integration/smoke.test.js` (new) |

---

## 2 · Workstream A — Call Center hardening (priority 1)

Mapped to §12 addenda in [plans/call-center-design.md](call-center-design.md). Branch: `feat/call-center-phase-1` (current).

### A.1 Atomic NEW→PREPARING claim *(finding 2.1, §12.1 · HIGH)*

**Change:** [backend/controllers/callCenter.controller.js](../backend/controllers/callCenter.controller.js) — in the status-transition handler, replace the check-then-write with a single conditional UPDATE:
```js
const result = await prisma.order.updateMany({
  where: { id: orderId, status: 'NEW' },
  data:  { status: 'PREPARING', claimedById: req.user.id, claimedAt: new Date() }
});
if (result.count === 0) {
  return res.status(409).json({ error: 'ALREADY_CLAIMED', message: '...' });
}
```
**Test:** integration test firing two concurrent PATCHes; exactly one should 200, the other 409.

### A.2 Shift-open drain broadcasts to all open shifts *(finding 2.1, §12.2 · HIGH)*

**Change:** in the shift-open handler (likely [backend/controllers/shift.controller.js](../backend/controllers/shift.controller.js)), when draining queued NEW orders, publish to **every user with an open shift at this branch**, not just the opener. Rely on client-side dedup (notification id).
**Test:** unit test on the drain function with 2 open shifts — both targets receive the event.

### A.3 Cancel transaction wrapped atomically *(finding 2.1, §12.3 · HIGH)*

**Change:** wrap stock-reversal + `Order.status='CANCELLED'` in a single `prisma.$transaction`. If either fails, both roll back. Add integration test that simulates a partial failure (e.g., mock `inventory.update` to throw after the stock credit).
**File:** [backend/controllers/callCenter.controller.js](../backend/controllers/callCenter.controller.js).

### A.4 Batched backfill `Sale → Order` *(finding 2.2, §12.4 · MED)*

**Change:** the `20260419171241_add_call_center_orders_notifications` backfill (or follow-on data migration) should be rewritten as a Node script that processes in 5,000-row chunks with progress logging.
**File:** `backend/scripts/backfill-orders-from-sales.js` (new).
**Run window:** maintenance window; document in `docs/runbooks/`.

### A.5 Drop `Order.branchId` to prevent drift *(finding 2.2, §12.5 · MED)*

**Change:** Prisma migration removes `Order.branchId`; join through `Sale.branchId`. Update all services reading `order.branchId` to use `order.sale.branchId` (or `include: { sale: { select: { branchId: true } } }`).
**Migration:** `20260422000000_drop_order_branch_id`.
**Risk:** if the column was used in indexes or reports, update those. Grep `order\.branchId|Order\.branchId|order_branch_id` first.

### A.6 SSE replay-truncated signal *(finding 2.3, §12.7 · MED)*

**Change:** in [backend/routes/events.js](../backend/routes/events.js) SSE handler, when a client reconnects with `Last-Event-ID` older than the oldest notification in the 30-day window, emit a synthetic event:
```
event: replay-truncated
data: {}
```
before streaming the (possibly-zero) real events. Client responds by refetching REST state.
**Client change:** [frontend/src/services/events.service.js](../frontend/src/services/events.service.js) (or equivalent) — handle the new event by calling the appropriate REST endpoints.

### A.7 Dispatch authz: require open shift *(finding 2.4, §12.9 · MED)*

**Change:** add middleware `requireOpenShiftAtBranch` for the OUT_FOR_DELIVERY transition. Responds 403 `SHIFT_REQUIRED` if the actor has no open shift at the order's branch.
**File:** [backend/middleware/](../backend/middleware/) + controller.

### A.8 `alertsEnabled` persistence *(finding 2.4, §12.10 · LOW)*

**Change:** frontend — persist the "enable alerts" toggle in `localStorage` under `alertsEnabled_${userId}`. Read on mount.
**File:** frontend call-center page component.

### A.9 Drop unused `RedisEventBus` stub from Phase 1 *(finding 2.4, §12.12 · LOW)*

**Change:** delete the stub file. Add a note to the design doc that it'll come back when Redis is wired.

### A.10 SSE ticket flow *(finding 2.3, §12.6)* — **already FIXED in Part A.3**

Confirm only: verify the endpoint shape `POST /api/events/ticket` → `GET /api/events/stream?ticket=…` matches the spec.

### A.11 Heartbeat interval documented *(finding 2.3, §12.8)* — **doc-only**

Confirm `docs/runbooks/` records the Cloudflare 100s limit vs the chosen 25s heartbeat.

### A.12 TTL index acceptable at v1 *(finding 2.3, §12.11)* — **no code change**

Move on. Revisit when notification volume is >100k rows.

**Workstream A exit criteria:**
- All new integration tests green
- `feat/call-center-phase-1` PR includes §12.1–12.12 resolutions
- Manual run-through: 2 cashiers racing the same order → one wins, the other sees 409; SSE reconnect after 31-day gap → client resyncs

---

## 3 · Workstream B — Bulk POS hardening (priority 2)

Mapped to §12 addenda in [plans/bulk-pos-design-doc.md](bulk-pos-design-doc.md). New branch: `feat/bulk-pos-review-fixes` off `main` after A merges.

### B.1 Single write-path + reconciliation cron *(finding 3.1, §12.1 · HIGH)*

**Change:** create [backend/services/bulkPayments.service.js](../backend/services/bulkPayments.service.js) (new) — the **only** code path that writes `BulkPayment`. It also updates `BulkOrder.paidAmount` and `balanceDue` in the same transaction.
Refactor [backend/controllers/bulk/bulkPayment.controller.js](../backend/controllers/bulk/bulkPayment.controller.js) and [bulkRefund.controller.js](../backend/controllers/bulk/bulkRefund.controller.js) to delegate to this service.
Add `backend/jobs/reconcile-bulk-order-paid-amount.js` — nightly cron that asserts `paidAmount == SUM(non-voided payments)` per order; logs drift to an alerts channel.

### B.2 Remove `Math.max(0, …)` clamp *(finding 3.1, §12.2 · MED)*

**Change:** in `getOpenBalance`, return the signed value. UI surfaces negative balance as "credit on file" badge.
**Files:** service + [frontend/src/pages/bulk/BulkCustomerDetailPage.jsx](../frontend/src/pages/bulk/BulkCustomerDetailPage.jsx) (or equivalent).

### B.3 Sequences: add RECEIPT and PROFORMA keys *(finding 3.2, §12.3 · MED)*

**Change:** migration adds rows to the document-sequence table for `SALES_RECEIPT` (prefix `BULK-RCP-`) and `PROFORMA` (prefix `BULK-PRO-`). Update [bulkNumbering.service.js](../backend/services/bulkNumbering.service.js) to accept the new keys.
**Migration:** `20260423000000_add_bulk_receipt_proforma_sequences`.

### B.4 `SELECT … FOR UPDATE` at REPEATABLE READ *(finding 3.2, §12.4 · HIGH)*

**Change:** [bulkNumbering.service.js](../backend/services/bulkNumbering.service.js) — the sequence allocator uses `prisma.$transaction` with `$queryRaw\`SELECT … FOR UPDATE\``. Document the MySQL isolation level inline.
**Test:** 50 concurrent allocations under load → all unique, no gaps.

### B.5 Worst-case credit check at confirm *(finding 3.3, §12.5 · HIGH)*

**Change:** [bulkCredit.service.js](../backend/services/bulkCredit.service.js) + confirm handler — at `POST /confirm`, assume the full `total` is unpaid (worst case) and check against credit limit. Rechecked on subsequent payment records.
**Test:** customer at 90% of credit limit confirms a new order that pushes them over → 400 `CREDIT_LIMIT_EXCEEDED`.

### B.6 `assertCreditLimitOk` caller contract *(finding 3.3, §12.6 · LOW)*

**Change:** docstring on [bulkCredit.service.js](../backend/services/bulkCredit.service.js) states "caller computes `projectedOrderTotal` (full total for new confirms, unpaid portion for partial-pay recalcs)." Signature unchanged.

### B.7 Three worked refund scenarios in the doc *(finding 3.3, §6, §12.7 · LOW)*

**Change:** add 3 worked examples to [bulk-pos-design-doc.md](bulk-pos-design-doc.md) §6: (a) fully-paid order fully refunded, (b) partially-paid order partially refunded, (c) over-payment refund. Verify `getOpenBalance` produces the expected signed number for each.

### B.8 Row lock on Inventory during confirm *(finding 3.4, §12.8 · HIGH)*

**Change:** the confirm handler's transaction wraps the stock check and decrement with `SELECT … FOR UPDATE` on the relevant `Inventory` rows. Under the 5-orders/day volume it'll never contend, but correctness is correctness.
**File:** [backend/services/bulkStock.service.js](../backend/services/bulkStock.service.js) or confirm handler.
**Test:** concurrent confirm of 2 orders that each need the last unit → exactly one succeeds, the other 400 `INSUFFICIENT_STOCK`.

### B.9 Payment amount validator `> 0` AND `≤ balanceDue` *(finding 3.4, §12.9 · MED)*

**Change:** request validator on `POST /payments` enforces both bounds. Today only the `≤ balanceDue` check exists in the service layer.
**File:** [backend/validators/bulk/payment.validator.js](../backend/validators/bulk/payment.validator.js) (or create).

### B.10 PUT replaces / PATCH merges for `/prices` *(finding 3.5, §12.10 · LOW)*

**Change:** [bulkContractPrice.controller.js](../backend/controllers/bulk/bulkContractPrice.controller.js) — `PUT /:id/prices` replaces the override list (deletes omissions); add a new `PATCH /:id/prices` that merges.
**Route:** add PATCH route.
**Frontend:** pick the verb matching the UI's intent on each page.

### B.11 Optimistic concurrency on `BulkOrder` — **DEFER** *(finding 3.5, §12.11)*

No change. Document in the design doc addenda as accepted risk at current volume (already written).

### B.12 Decimal serialization test in audit *(finding 3.5, §12.12 · LOW)*

**Change:** add a test that creates a `BulkOrder`, updates a Decimal field, and asserts `audit_logs.old_values` / `new_values` JSON parses back to the exact Decimal.
**File:** `backend/tests/audit/decimal-serialization.test.js` (new).

### B.13 Phase 1 blocks tax-numbered customers *(finding 3.6, §12.13 · MED)*

**Change:** confirm handler — if `customer.taxNumber` is set and Phase 2 feature flag is off, return 400 `TAX_INVOICE_NOT_AVAILABLE_IN_PHASE_1`.
**File:** [bulkOrder.controller.js](../backend/controllers/bulk/bulkOrder.controller.js).
**UI:** disable the confirm button with a tooltip explaining why.

### B.14 Phase 1 confirm = implicit cash PAID *(finding 3.6, §12.14 · MED)*

**Change:** in Phase 1, `POST /confirm` on a non-tax customer writes a synthetic `BulkPayment` of `total` with `method=CASH` in the same transaction, sets order to `PAID`.
**File:** [bulkOrder.controller.js](../backend/controllers/bulk/bulkOrder.controller.js) + [bulkPayments.service.js](../backend/services/bulkPayments.service.js).
**Phase 2 task (noted, not done now):** remove the synthetic write, introduce payment selection.

### B.15 AR-aging buckets 0-30 / 31-60 / 61-90 / 90+ *(finding 3.7, §12.15 · MED)*

**Change:** [bulkReport.controller.js](../backend/controllers/bulk/bulkReport.controller.js) `ar-aging` endpoint uses these four buckets. Document in the API doc.

### B.16 No discounts report confirmed *(finding 3.7, §12.16)* — **no code**

Confirm in code review that no "discounts given" report exists for bulk. Matches design decision.

**Workstream B exit criteria:**
- All new tests green
- Reconciliation cron runs clean against a 1-week dataset
- Confirm flow correctness tested with 3 concurrent scenarios

---

## 4 · Workstream C — POS Discount hardening (priority 3, gated on VAT ruling)

Mapped to §11 addenda in [plans/pos-discount.md](pos-discount.md). New branch: `feat/pos-discount-review-fixes` after B merges.

### C.1 Unified rounding rule *(finding 1.1.a, §11 · HIGH)*

**Change:** define one helper `roundMoney(n)` (nearest 1 EGP) used on both backend and frontend. Carry full precision everywhere internally; round **only** at persistence (to the `tax_amount`, `discount_amount`, `total` columns) and at display (receipt, UI line items).
**Files:** backend `services/sales.service.js`, frontend `utils/money.js`.
**Test:** golden test — 100 synthetic carts of random quantities/discounts; backend stored `total` must equal receipt-rendered `total` for every cart.

### C.2 Refund formula wording aligned to code *(finding 1.1.b–c, §11 · MED)*

Already rewritten in the spec. Code check: confirm the refund handler computes `proportional_discount_share = roundMoney(lineSubtotal * discount_amount / original_subtotal)` and returns `lineSubtotal - proportional_discount_share`.
**File:** [backend/services/sales.service.js](../backend/services/sales.service.js) refund path.
**Test:** the 3 scenarios from the spec.

### C.3 VAT treatment — **DECIDE first** *(finding 1.1.d, §11)*

No code until the ruling arrives. If post-discount (current default) wins: no change. If gross wins: change `tax = discountedSubtotal * taxRate` → `tax = subtotal * taxRate`, update tests, write a migration decision note. **Do not ship the rest of workstream C until this is closed.**

### C.4 `discount_reasons` lookup table *(finding 1.2, §11 · MED)*

**Change:**
- Migration creates `discount_reasons` table with columns `code VARCHAR(32) PRIMARY KEY`, `label_ar VARCHAR(128)`, `customer_label_ar VARCHAR(128)`, `is_active BOOLEAN`.
- Seed with the current code set.
- Alter `sales.discount_reason_code` to FK → `discount_reasons.code`, `ON DELETE RESTRICT`.
- Change `discount_applied_by_user_id` FK to `ON DELETE RESTRICT` (already inline-fixed in spec §4.1).
**Migration:** `20260424000000_discount_reasons_lookup`.
**Backfill:** existing free-text codes must already be in the seed; fail the migration if not (safer than a silent insert).
**API:** expose `GET /api/pos/discount-reasons` returning only `is_active=true` rows.
**Frontend:** receipt uses `customer_label_ar`, back-office reports use `label_ar`.

### C.5 Cart state rules *(finding 1.3.a/b/e, §11 · LOW)*

**Change:** POS cart reducer — when subtotal reaches 0, clear discount inputs (type/value/reason) not just the applied discount. When `taxRate=0`, receipt suppresses the tax line. Re-adding items after an empty cart does not reapply a prior discount.
**File:** `frontend/src/state/posCart.js` (or current store).
**Test:** existing cart tests + 3 new cases.

### C.6 Z-report excludes voided sales *(finding 1.3.d, §11 · LOW)*

**Change:** shift Z-report discount summary filters `WHERE sale.isVoided = false`.
**File:** [backend/controllers/shift.controller.js](../backend/controllers/shift.controller.js) or report service.

### C.7 Abuse-detection alert — **DEFER** *(finding 1.4.a, §11)*

Logged as follow-up. No code this sprint.

### C.8 Audit double-write verification *(finding 1.4.b, §11 · LOW)*

**Change:** test asserts `sales.discount_applied_by_user_id == audit_logs.actor_id` for a POST discount action.
**File:** `backend/tests/audit/discount-attribution.test.js` (new).

**Workstream C exit criteria:**
- VAT ruling recorded in the design doc before any code merges
- Golden rounding test green
- `discount_reasons` migration applied cleanly

---

## 5 · Test strategy

Per workstream the critical new tests are:

| Workstream | Test type | What it proves |
|-----------|-----------|----------------|
| A.1 | Integration, 2 concurrent PATCHes | Atomic claim |
| A.3 | Integration with mocked failure | Cancel atomicity |
| A.6 | Integration with `Last-Event-ID` older than TTL | replay-truncated path |
| B.1 | Nightly cron dry-run | No `paidAmount` drift |
| B.4 | Load-test sequence allocator | No dup numbers |
| B.8 | 2 concurrent confirms | No overselling |
| B.14 | Confirm on non-tax customer | Synthetic CASH payment created |
| C.1 | Golden rounding test, 100 carts | Backend total == receipt total |

All above go in CI. Smoke test from cross-cutting §1 runs on every PR.

---

## 6 · Rollout order

1. **Cross-cutting prep** (½ day)
2. **Workstream A** on current `feat/call-center-phase-1` → PR → merge
3. **Workstream B** on fresh branch → PR → merge
4. **VAT decision lands**
5. **Workstream C** on fresh branch → PR → merge
6. Defer list (1.4.a abuse detection, 3.5 optimistic concurrency, SSE Redis, notification partial index) — open follow-up tickets

---

## 7 · Out of scope (explicit defers)

- Finding 1.4.a — discount abuse-detection alerting (logged)
- Finding 3.5 (§12.11) — optimistic concurrency on `BulkOrder` (logged, accept current-volume risk)
- Finding 2.3 — Redis event bus (will land with Phase 2)
- Finding 2.3 — SSE partial index on `Notification.createdAt` (revisit at scale)

---

## 8 · Risks

- **VAT ruling comes back "gross"** → C.3 becomes larger (migration on historical `tax_amount` rows). Out of scope here; treat as a separate plan if it happens.
- **A.5 (drop `Order.branchId`)** may surface hidden callers; budget extra time to grep and fix.
- **B.1 reconciliation cron** may flag drift in historical data from earlier code paths that didn't go through the service. Run once in audit-only mode before the fix-up pass.
