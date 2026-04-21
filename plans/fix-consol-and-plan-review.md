# Fix Plan — Console Errors (2026-04-21) & Plan Review

**Inputs:**
- [1-42-21-4-2026-consol.md](../1-42-21-4-2026-consol.md) — runtime console log
- [pos-discount.md](pos-discount.md)
- [call-center-design.md](call-center-design.md)
- [bulk-pos-design-doc.md](bulk-pos-design-doc.md)

---

## PART A — Fix the runtime errors in `1-42-21-4-2026-consol.md`

The log contains two distinct failure classes. Treat them separately — they have different root causes.

### A.1 `ReportsPage` TypeError (definitive root cause known)

**Symptom (line 106, 117, 150):**
```
Uncaught TypeError: currentUser?.permissions?.includes is not a function
  at ReportsPage (ReportsPage.jsx:7:51)
```

**Root cause:** [ReportsPage.jsx:7](../frontend/src/pages/reports/ReportsPage.jsx#L7) calls `.includes("CALL_CENTER")` on `currentUser.permissions`. The backend [auth.js:135-153](../backend/routes/auth.js#L135-L153) returns `permissions` as an **object map** `{ MODULE: boolean }`, not an array. `.includes` does not exist on plain objects → page crashes, error boundary triggers, the whole reports tree unmounts.

**Fix:**
- Edit [ReportsPage.jsx:7-8](../frontend/src/pages/reports/ReportsPage.jsx#L7-L8):
  ```js
  const hasCallCenter = currentUser?.permissions?.CALL_CENTER === true ||
    currentUser?.role === "superadmin";
  ```
- Grep for any other `.permissions?.includes(` / `.permissions.includes(` callsites and apply the same correction:
  ```
  rg "permissions\??\.includes\(" frontend/src
  ```
- Add a one-line guard in `AuthService.hasPermission(module)` (if it exists; else add it) so future code uses a single helper instead of duplicating the shape check.

**Verification:**
- `/reports` route loads without throwing.
- Both a superadmin and a non-superadmin without `CALL_CENTER` see the right tile visibility.

---

### A.2 Wall of 500s across unrelated endpoints

**Symptom:** every backend endpoint returns 500 in the same session — `/api/auth/me`, `/api/branches`, `/api/branches/summary`, `/api/branches/balances`, `/api/treasuries/global-balances`, `/api/notifications`, `/api/warehouses`, `/api/items`, `/api/bulk/customers`, `/api/bulk/orders`, `/api/events/stream`. Errors arrive as a generic `APIError: An unexpected error occurred` from [apiClient.js:80](../frontend/src/services/apiClient.js#L80) — the actual server message is being swallowed.

**Working hypothesis (most → least likely):**
1. **Shared middleware throwing** — likely `auth` or `requireModule`/permission middleware. Endpoints with no overlap in business logic but a shared mount path all 500-ing in unison points at a layer they all traverse. The `ReportsPage` crash above is downstream of a working `auth/me` though — yet `auth/me` is *also* in the 500 list later (line 76, 88, 100). So `auth/me` was working at session start, then started failing. Suggests **state mutation** (DB transaction left open, connection pool exhaustion, or a side-effect from a request that corrupts a singleton).
2. **Prisma client / schema drift** — multiple recent migrations landed (`add_bulk_pos_phase1`, `add_bulk_payments_refunds`, `treasury_scope_visa_instapay_split`, `shift_expected_digital_totals`, `add_sale_discount_reason_and_applied_by`). If the running backend was started before `prisma generate` ran, it'll throw on the first query that hits the new fields. Affects the entire client.
3. **SSE token leak in URL** (line 5, 52-57, 83, 161) — `/api/events/stream?token=...` puts the JWT in the query string. Server logs and browser history retain it. Not the cause of the 500s, but a security concern raised here because the same endpoint is in the failing list.
4. **DB pool / connection** — if MySQL is unreachable or pool is starved, every Prisma query 500s identically. A `503`/timeout shape would be more typical, but a thrown `PrismaClientInitializationError` surfaces as 500.

**Fix steps (in order — stop when the wall clears):**

1. **Surface the real error.** [apiClient.js:80](../frontend/src/services/apiClient.js#L80) is masking the server response. Either:
   - Change the error path to bubble `body.message` / `body.error` from the response to `console.error`, or
   - Tail backend logs (`backend/logs/` or stdout) while reproducing the page load.
   This is non-negotiable before guessing further.

2. **Verify Prisma is in sync with the schema:**
   ```
   cd backend && npx prisma migrate status
   cd backend && npx prisma generate
   ```
   Restart the backend. If migrations show "drift" or "pending," resolve before continuing.

3. **Smoke each endpoint with curl/Postman and a valid token** — this isolates whether the failure is per-endpoint or universal. If universal → middleware. If 1-2 specific endpoints → controller bugs (likely the ones touching the newest models).

4. **Inspect the auth middleware hot path** — [middleware/auth.js](../backend/middleware/auth.js). Look for:
   - A `req.user` shape change that downstream code reads as an object key (e.g. `req.user.permissions.X`) but is now `undefined`.
   - A throw in token parsing (was `accessibleBranches` shape changed by a recent migration?).
   - `requireModule` mismatch — the new `BULK_POS`/`CALL_CENTER` modules need to exist in the seeded role grid; if `requireModule(Module.BULK_POS)` enum-references a value that didn't get seeded into permissions, calls 403 (not 500 — but this is a likely cousin bug).

5. **Check `/api/events/stream`** — the SSE endpoint specifically. If its handler throws synchronously (e.g. trying to `subscribe` to an `EventBus` that wasn't initialized), it can poison subsequent requests if it leaves a transaction open. The log shows it 500ing repeatedly with the same `lastEventId=9` — suggesting client retry, but each retry pollutes server state.

6. **Once the cause is identified, write a regression test** for the failing layer. A single integration test that boots the app, calls `/api/auth/me` with a freshly-seeded user, and asserts a 200 would have caught this.

**Verification:**
- After fixing, log in as superadmin, hit `BranchesSalesPage`, `ReportsPage`, `/bulk/customers`, `/warehouses` — no 500s, no console errors.
- Reload 5× in succession — no degradation (rules out the "state-mutation per request" pattern).

---

### A.3 Secondary cleanup (drop into the same PR)

- **Hide JWT from SSE URL.** Move the token to an `Authorization` header via a service-worker proxy, or use a short-lived one-time stream token. URL-tokens leak through proxy logs, browser history, and `Referer` headers.
- **Add a top-level React error boundary** so a single page crash doesn't blank the screen. The current trace shows React already suggested this on line 147.
- **`apiClient.js`** — surface `error.response?.data?.message` in the thrown `APIError` so the next debugging session takes 30 seconds instead of 30 minutes.

---

## PART B — Bug & risk review of the three plans

Reviewing only what the plans **say they will build** — not the existing code. Each section calls out concrete defects, ambiguities, and missing edge cases. Treat each item as an issue to resolve before merging the corresponding plan.

---

### B.1 [pos-discount.md](pos-discount.md)

#### B.1.1 Math/rounding bugs

- **§4.2 ordering of rounds is wrong.** The plan says round `discountAmount` to nearest 1 EGP, then compute `tax = discountedSubtotal * taxRate` (unrounded), then round only the final `total`. But §6 defines `round1` as `Math.round(n)`, used in POS totals **and** receipt. If the receipt prints `subtotal − discountAmount + tax + delivery` using *line-rounded* values, the printed total will diverge from the backend `total` by up to ±1 EGP. **Pick one rule and apply it identically backend + frontend + receipt.** Recommended: round only the persisted `discountAmount` and the final `total`; show pre-round tax on the receipt with a note, or carry full precision through and round only at display.
- **§4.4 refund formula is mislabeled and likely wrong.** The plan writes:
  ```
  refundAmount = round1(lineSubtotal * (1 - discount_amount / original_subtotal))
  ```
  This computes the **net refund after applying the discount fraction** — i.e. the amount the customer actually paid for that line, post-discount. That's correct for "give back what they paid," but the plan's own §2 #14 says "**proportional refund of the discount**" — which would be `refundAmount = lineSubtotal − round1(lineSubtotal * discount_amount / original_subtotal)`. Same result by algebra, but the wording mismatch will cause an implementer to second-guess. Rewrite as:
  > Refund = the post-discount price of the returned line, i.e. `lineSubtotal − proportional_discount_share`, where `proportional_discount_share = round1(lineSubtotal * discount_amount / original_subtotal)`.
- **§4.4 references `original_subtotal`** — but the schema (§4.1) does **not** add a column for that. The existing `sales` table has a `subtotal` field; confirm it is stored *pre-discount* (the migration `20260420081752_add_sale_discount_fields` should have established this — verify before referencing). If `subtotal` is stored *post-discount*, the formula breaks silently.
- **§4.2 tax computation order** — "`tax = discountedSubtotal * taxRate`" means the *tax amount stored on the sale* changes when a discount is applied. Reports that aggregate `tax_amount` will now show lower tax for discounted sales. Confirm that's the intended VAT behavior — in many jurisdictions VAT is owed on the gross amount and the discount is treated as a separate concession, not a reduction of the taxable base. **This is a finance/legal call, not a coding call.**

#### B.1.2 Schema bugs

- **§4.1 FK `ON DELETE SET NULL` on `discount_applied_by_user_id`** breaks audit traceability. If the cashier is deleted, the sale loses its audit. Use `ON DELETE RESTRICT` or soft-delete users.
- **§3 reason codes are persisted as `VARCHAR(32)` strings** with no enforcing table. A typo or i18n change will silently corrupt reports grouped by reason. Either add a `discount_reasons` lookup table with FK, or use a Prisma enum. Free-text in a code column is a future-bug magnet.
- **No backfill plan for existing call-center sales** that already have discount data. §4.1 says "Call-center controller backfills these too for parity" but doesn't say what `discount_applied_by_user_id` becomes for historical rows (NULL? the original cashier? the controller's `req.user.id` at backfill time, which would be wrong).

#### B.1.3 State / UX gaps

- **§7 "Shift reopen / unfinished sale recovery"** is flagged as an open question, not a decision. This will block release. Decide now: either persist discount in the draft, or clear it on reopen — but answer it in the plan.
- **§5.2 cart mutation: `VALUE` clamps to new subtotal, toast on clamp.** What about `PERCENTAGE` when subtotal becomes 0? §7 says "cart emptied → clear discount state" but does not specify whether the *discount inputs* (type/value/reason) are also cleared or retained. Re-adding an item should not silently reapply a stale discount.
- **§5.3 receipt line `Discount (10% — خصم موظف)`** — the customer sees the internal reason code label. Some reasons (`MANAGER_COMP`, `STAFF_DISCOUNT`) are operationally awkward to print. Add a "customer-facing label" column to the reason table separate from the internal code.
- **§5.4b shift Z-report** says "discount summary" but does not specify whether voided sales count. Define.
- **No handling for `taxRate = 0`** (tax-exempt items / customers). Formula still works mathematically, but the receipt template should suppress the tax line rather than print `Tax (0%): 0`.

#### B.1.4 Audit / authz

- **§2 #4 "any cashier, no PIN/manager gate"** is fine if accepted, but the plan should add a **report-level alert** for outlier discounts (e.g. >30% or >500 EGP) so finance can detect abuse without a pre-auth gate.
- **`discount_applied_by_user_id` is set from `req.user.id`** — but the audit-capture middleware likely already records this. Confirm there is no double-write inconsistency (e.g. the column shows user A but `audit_logs.actor_id` shows user B because the request was impersonated).

---

### B.2 [call-center-design.md](call-center-design.md)

#### B.2.1 Concurrency / race conditions

- **§6.4 `PATCH /:id/status` NEW → PREPARING is not atomic against multiple cashiers.** Two cashiers click "Start Preparing" within 100ms, both pass the precondition check, both set `claimedById`. Last write wins, the other cashier sees no error. Required fix: `UPDATE orders SET status='PREPARING', claimedById=?, claimedAt=NOW() WHERE id=? AND status='NEW'` — check `affectedRows = 1`, return 409 otherwise. The plan does not specify this guard.
- **§6.2 shift-open drain** publishes events "for the opening user" — but D6 (decision log) says broadcast goes to **all** open-shift cashiers. If a second cashier opens a shift later, the drain logic fires only for them; the first cashier (already on duty) never receives the queued NEW order. Either drain on every shift-open and rely on dedup at the client, or change the drain to broadcast.
- **§6.6 stock reversal on cancel** — if the cancel transaction fails partway (inventory rolled back, `Order.status` not updated), the system can be left with stock credited back but order still NEW. The plan says "Transaction rollback; order stays NEW" — confirm the transaction wraps both updates atomically, and add an integration test for the partial-failure case.

#### B.2.2 Schema / migration

- **§5.2 backfill** — "create `Order` row for every existing `Sale`." For a database with hundreds of thousands of historical sales, a single-statement backfill will lock the table. Add explicit batching (e.g. 5,000 rows per chunk) and run during a maintenance window, or do it lazily.
- **§5.2 `Sale` has its own `branchId`, `Order` also has `branchId`.** They can drift. Either drop `Order.branchId` and join through `Sale`, or add a CHECK constraint / DB trigger to enforce equality.
- **§5.3 `Notification.payload` is `Json`** with no schema. Reports/queries can't index into it efficiently. If you ever want "notifications about high-value orders," you'll regret not extracting `total` to a column.

#### B.2.3 SSE / real-time

- **§6.3 SSE token in URL query string** — same security issue called out in A.3 above, and it's already manifesting in the console log. SSE clients can't set custom headers natively, but the standard pattern is a short-lived stream token issued via a regular authed `POST /api/events/ticket` call, then used once. Don't ship the long-lived JWT in the URL.
- **§6.3 `Last-Event-ID` replay reads from `Notification` table** — but D8 says notifications have a 30-day TTL. If a client disconnects for >30 days then reconnects with a stale `Last-Event-ID`, replay returns nothing and the client thinks it's caught up while having missed events. Define behavior: server should return a `replay-truncated` event, client should refetch state via REST.
- **§6.3 heartbeat every 25s** is fine for most proxies, but Cloudflare's free tier closes idle connections at 100s — confirm the deployment target before locking the interval.

#### B.2.4 Specification ambiguity

- **§3 D9 "shift attribution = shift open at dispatch."** §6.4 implements this as "actor's current open shift." But what if a manager (not a cashier) does the dispatch? The plan does not restrict who can `PATCH /:id/status`. Add an authz rule: only users with an open shift at that branch can perform the OUT_FOR_DELIVERY transition.
- **§7.5 "Enable alerts" gate is per session.** §3 doesn't say whether the gate state should persist (localStorage). Cashiers will hate clicking it every refresh. Decide.
- **§5.3 `Notification` indexes `[userId, readAt, createdAt]`** — good for the unread-badge query. But `[createdAt]` alone for the TTL purge is suboptimal at scale; the purge job will table-scan after 30d of unread rows accumulate. Add a partial index or accept the cost and document it.
- **§10 Phase 1 "Stub `RedisEventBus` file (not wired)"** — stubbing a file you won't use clutters the diff for no benefit. Drop it; add it when you add Redis.

---

### B.3 [bulk-pos-design-doc.md](bulk-pos-design-doc.md)

#### B.3.1 Stored aggregates can drift

- **§3.4 `BulkOrder.paidAmount` and `balanceDue` are stored columns** — but §4 doesn't show the transactional update path on payment create / void / refund. If any code path mutates `BulkPayment` without recomputing `BulkOrder.paidAmount`, the rollups silently desync. Two options:
  1. Always compute on read (fast enough at 5 orders/day, the stated volume).
  2. Wrap *every* `BulkPayment` write in a service that also updates the parent — and add a daily reconciliation job that asserts `paidAmount = SUM(non-voided payments)`.
  Either is fine; the plan must commit to one.
- **§4.5 `getOpenBalance` clamps to 0 with `Math.max(0, ...)`** — this hides over-payment (e.g. customer accidentally pays twice). Allow negative balances; surface them as a "credit on file" badge. Clamping = bug being silenced.

#### B.3.2 Numbering / sequences

- **§4.4 says "SALES_RECEIPT (BULK-RCP-NNNN)"** but §3.7 only enumerates sequence keys `ORDER`, `TAX_INVOICE`, `CREDIT_NOTE` (no `RECEIPT`). Add a `RECEIPT` key with prefix `BULK-RCP-` to the seed.
- **§3.7 atomic counter** says "use `SELECT ... FOR UPDATE`" with Prisma `$transaction` — but the *retry-loop fallback* (mentioned as alternative) is ambiguous. Pick one. With MySQL, prefer `SELECT ... FOR UPDATE` inside a transaction. Document the isolation level explicitly (REPEATABLE READ in MySQL default; FOR UPDATE acquires a row lock).
- **No sequence for `PROFORMA`** — proformas (§2.1) are listed as a document type and `BulkDocument.documentNumber` is `@unique`. Either proformas don't get numbers (and the controller skips writing a `BulkDocument` row for them), or a `PROFORMA` sequence is needed. Spec it.

#### B.3.3 Credit limit logic

- **§4.4 confirm flow checks credit limit "if paymentMethod will be CREDIT or partial credit"** — but §4.3 endpoints show `POST /confirm` taking no payment input; payment is recorded *separately* via `POST /payments`. So at confirm time, the system doesn't yet know if it's a CREDIT order. The credit check must therefore assume **the worst case** (full unpaid → adds full `total` to AR) and recheck on every subsequent payment. The plan's "if-CREDIT" wording is ambiguous; clarify.
- **§4.5 `assertCreditLimitOk(tx, customer, projectedOrderTotal)`** — the docstring says "for mixed/partial, include the unpaid portion" but the function signature only accepts a number. Either pass the breakdown in, or compute `projectedOrderTotal` upstream and document that responsibility lives with the caller.
- **§6 "Cash refund pays out from treasury but doesn't reduce open AR"** — debatable. A cash refund of a paid order *should* reduce the customer's lifetime payments, which means the open balance formula `ordersSum − paymentsSum − refundsSum` correctly *decreases* the customer's net deposits (refunds are paid back). But for a partially-paid order, the cash refund is logically a return of cash, separate from the balance owed. Walk through 2-3 concrete scenarios in the doc to make sure §4.5 produces the expected number.

#### B.3.4 Stock / fulfillment

- **§3.4 `warehouseId` is required and "one warehouse per order"** is mentioned but not enforced at the schema level (it's a single FK column, so by definition there's one — fine; just confirm there's no place the controller could iterate multiple warehouses).
- **§4.4 stock check happens inside the confirm transaction** — good. But there's no row-level lock on `Inventory`, so two concurrent confirms could both pass the check and oversell. Required: `SELECT ... FOR UPDATE` on the affected `Inventory` rows in the same transaction. The plan does not specify this and "block backorders" is the explicit decision (§2.1) — without the lock, the rule will be violated under load. Volume is tiny (5 orders/day) so the bug will be rare, but it's a correctness bug, not a performance one.
- **§3.5 `BulkPayment.amount`** has no positivity check at the schema or service layer (per the validation rules in §4.9, only "amount ≤ balanceDue" — not "amount > 0"). The validation rule line *does* say `amount > 0`. Make sure that's enforced in the request validator, not just the doc.

#### B.3.5 Validation / API surface

- **§4.3 `PUT /api/bulk/customers/:id/prices`** — "bulk upsert `{itemId, price}[]`." Does this **replace** the entire override list (deleting omissions) or **merge**? The semantics matter and the doc doesn't say. PUT classically replaces; PATCH merges. Define and document.
- **§3.4 BulkOrder lacks a `version`/`updatedAt` token for optimistic concurrency.** Two reps editing the same DRAFT will silently overwrite each other. v1 likely fine (volume tiny, single-rep-per-customer convention) but worth a comment.
- **§4.10 audit captures old/new on every state change** — confirm the `auditCapture` middleware actually serializes `Decimal` values correctly. Prisma's Decimal type sometimes stringifies oddly; reports comparing audit JSON to current values can break.

#### B.3.6 Phasing inconsistencies

- **Phase 1 step 4** says "tax invoice deferred to Phase 2," but Phase 1 also creates customers — including ones with `taxNumber` set. If a tax-numbered customer's order is confirmed in Phase 1, what document is issued? Either:
  - Block confirms for tax-numbered customers in Phase 1, or
  - Issue a generic SALES_RECEIPT regardless and warn.
  Pick one or the cutover will break.
- **Phase 1 has no payment recording** (BulkPayment is Phase 2). So a Phase 1 confirm immediately marks the order PAID? PARTIALLY_PAID? Or the order stays CONFIRMED forever with `paidAmount=0`? Spec it. Easiest answer: in Phase 1, confirm = cash-paid = PAID, hardcoded. Then Phase 2 introduces real payment selection.

#### B.3.7 Reports

- **§4.3 `GET /api/bulk/reports/ar-aging`** — bucket cutoffs are listed as an open question (§10). Don't ship without a decision; downstream finance reports depend on this exact slicing.
- **No report for "discounts given"** — fine, because §2.1 says no discounts. Just confirm that decision sticks; if it changes later, the schema has nowhere to record discount info.

---

## PART C — Suggested order of work

1. **Today**: ship A.1 (one-line ReportsPage fix) — unblocks any user trying to reach `/reports`.
2. **Today/tomorrow**: investigate A.2 with real backend logs. Fix and write the regression test. Drop A.3 cleanups into the same PR.
3. **Before starting any plan**: walk through each plan's review section above with the tech lead, fold the resolutions back into the plan documents (don't carry contradictions into implementation), then start coding.
4. **Plan-priority order** (informed by the review):
   - **call-center-design** has the riskiest open issues (concurrency on status transitions, SSE token leak that's *already* in production logs). Resolve those before continuing implementation.
   - **bulk-pos-design-doc** has medium risk (stored aggregates, credit-limit semantics). Resolve §B.3.1 and §B.3.6 before Phase 1 merge.
   - **pos-discount** has the smallest blast radius (tax math + receipt rendering); it can ship after the other two are stable.
