# Visa / Instapay Treasury Split — Phases 3 → 6

> **Status:** Phases 1 (Schema & Migration) and 2 (Sale Routing Logic) are complete.
> This document is the professional execution plan for the remaining phases.
>
> **Owner:** Backend + Frontend
> **Locked model:** one Cash treasury per branch · one global `GLOBAL_VISA` · one global `GLOBAL_INSTAPAY` · one `MAIN`.
> **Payment methods:** `CASH | VISA | INSTAPAY` (CARD retired in Phase 1).

---

## Phase 3 — Refunds & Shift Close-out

**Goal:** Route refunds and end-of-shift reconciliation through the correct treasury per payment method, with zero silent drift.

### 3.1 Scope
- Refund flow treasury selection.
- Shift-close reconciliation of Visa / Instapay totals.
- Keep branch cash drawer as the only user-counted figure.

### 3.2 Backend tasks
1. **Refund treasury picker**
   - Endpoint: `POST /sales/:id/refund`.
   - Accept optional `refundMethod: 'CASH' | 'VISA' | 'INSTAPAY'`.
   - Default = `CASH` (branch cash treasury) when omitted.
   - Validate the picked method has a configured treasury (`visaTreasuryId` / `instapayTreasuryId` in `SystemConfiguration`). Return 422 with Arabic message if missing.
   - Write the refund ledger entry against:
     - `CASH` → branch cash treasury
     - `VISA` → `SystemConfiguration.visaTreasuryId`
     - `INSTAPAY` → `SystemConfiguration.instapayTreasuryId`
2. **Shift reconciliation — auto-trusted digital totals**
   - On shift close:
     - **Cash:** keep existing counted-vs-expected variance logic.
     - **Visa / Instapay:** compute expected from `Sale` aggregates for the shift window and post **without variance prompt** (auto-trusted). Log the computed totals on the shift record for auditing.
   - Add fields to the shift record (or metadata JSON): `expectedVisa`, `expectedInstapay`, `countedCash`, `expectedCash`, `cashVariance`.
3. **Validation & guards**
   - Reject refunds that exceed the original sale amount per method.
   - Reject refund on a sale whose payment method has no configured treasury.

### 3.3 Frontend tasks
- **Refund dialog:** add a dropdown `طريقة الاسترداد` (Cash / Visa / Instapay). Default Cash. Disable options whose treasury is not configured and show a tooltip.
- **Shift close screen:** show three read-only rows (Cash expected, Visa auto, Instapay auto) plus the single cash count input. Label digital rows clearly as *موثوقة تلقائياً*.

### 3.4 Tests
- Unit: refund routing picks correct treasury per method; rejects unconfigured methods.
- Integration: full refund flow Cash / Visa / Instapay → correct ledger + balances.
- Integration: shift close with mixed payments → cash variance only, digital auto-posted.

### 3.5 Acceptance criteria
- [ ] Refunds land in exactly one treasury based on picker.
- [ ] Shift close never prompts Visa/Instapay variance.
- [ ] All existing refund tests pass; new refund tests green.
- [ ] No regression in `tests/unit` (currently 21/21).

---

## Phase 4 — One-Way Treasury Transfers

**Goal:** Allow `Cash → Visa` and `Cash → Instapay` transfers; block the reverse.

### 4.1 Scope
- Treasury transfer endpoint + UI.
- Dropdown filtering by `TreasuryScope`.

### 4.2 Backend tasks
1. **Transfer validation** (`POST /treasury/transfer` or existing equivalent)
   - Allow when `source.scope = BRANCH_CASH` and `destination.scope ∈ {GLOBAL_VISA, GLOBAL_INSTAPAY, MAIN}`.
   - Allow `MAIN ↔ BRANCH_CASH` as today (unchanged).
   - **Reject** `GLOBAL_VISA` / `GLOBAL_INSTAPAY` as *source* with 422 + Arabic message (`لا يمكن التحويل من خزائن فيزا / انستاباي`).
2. **Dropdown data endpoints**
   - `GET /treasuries?scope=BRANCH_CASH|GLOBAL_VISA|GLOBAL_INSTAPAY|MAIN` — filter by scope.
   - Return `{ id, name, scope, branchId }`.

### 4.3 Frontend tasks
- Transfer form:
  - **Source dropdown:** scoped to `BRANCH_CASH` (+ `MAIN` for admins).
  - **Destination dropdown:** everything except the chosen source; if source = cash, allow Visa/Instapay/Main.
  - Inline validation mirror of backend rule.

### 4.4 Tests
- Unit: scope validator matrix (allowed / blocked).
- Integration: cash → visa moves balance both sides; visa → cash returns 422.

### 4.5 Acceptance criteria
- [ ] No path in the UI or API can drain Visa / Instapay back into cash.
- [ ] Existing Main ↔ Branch transfers still work unchanged.

---

## Phase 5 — Aggregation API

**Goal:** Provide the endpoints the new Branches-Sales page will consume.

### 5.1 Endpoints
1. **`GET /branches/balances?from=YYYY-MM-DD&to=YYYY-MM-DD`**
   - Returns per branch: `{ id, name, cashBalance, visa, instapay, total }`.
   - `cashBalance` = current treasury balance (point-in-time).
   - `visa` / `instapay` = sum of `Sale.netAmount` where `Sale.branchId = X AND paymentMethod = Y AND paidAt BETWEEN from AND to`.
   - Default window when params omitted: **today** (local tz).
2. **`GET /treasuries/global-balances`**
   - Returns `{ visaTreasury: { id, name, balance }, instapayTreasury: { id, name, balance }, mainTreasury: { id, name, balance } }`.
3. **`GET /branches/summary?from=&to=`** (if used) — keep shape, plug new fields.

### 5.2 Backend tasks
- Single optimized query per branch aggregate (GROUP BY `branchId, paymentMethod`).
- Timezone: compute ranges in server local tz (Africa/Cairo); accept ISO dates.
- Cache layer: none for now (premature); add only if p95 > 300ms.

### 5.3 Tests
- Unit: date-range builder (start-of-day / end-of-day handling).
- Integration: seeded sales across two branches + three methods → numbers match.

### 5.4 Acceptance criteria
- [ ] Endpoint returns correct totals for today, yesterday, custom range.
- [ ] Response shape stable and documented in `docs/api/`.

---

## Phase 6 — Frontend: Branches-Sales Redesign

**Goal:** Ship the screen the user sketched: 3 header cards + date filter + per-branch 4-column rows.

### 6.1 Layout
```
┌────────────────────────────────────────────────────────────────────┐
│  [Main Treasury + Branches]   [Visa Treasury]   [Instapay Treasury]│
├────────────────────────────────────────────────────────────────────┤
│  Date filter:  [Today] [Yesterday] [Last 7] [Custom range…]        │
├────────────────────────────────────────────────────────────────────┤
│  Branch         │  Cash     │  Visa     │  Instapay │  Total       │
│  فرع أ          │  ...      │  ...      │  ...      │  ...         │
│  فرع ب          │  ...      │  ...      │  ...      │  ...         │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Components
- `<TreasuryHeaderCards />` — 3 cards side-by-side, responsive grid.
  - Main card: existing gradient + growth chip.
  - Visa card: blue gradient, shows `visaTreasury.balance`, static (no drill-in).
  - Instapay card: purple gradient, shows `instapayTreasury.balance`, static.
- `<DateFilterBar />` — chips `Today | Yesterday | Last 7 days | Custom`. Custom opens a date-range picker. Default = **Today**.
- `<BranchRow />` — 4 numeric columns per branch plus total; reuse existing styling.

### 6.3 State & data flow
- On mount + filter change:
  - `GET /treasuries/global-balances` (header cards).
  - `GET /branches/balances?from=&to=` (rows).
- Loading skeletons per section; errors surface via `react-hot-toast`.

### 6.4 Files to touch
- [BranchesSalesPage.jsx](frontend/src/pages/sales/BranchesSalesPage.jsx) — full redesign.
- [BranchBalancesPage.jsx](frontend/src/pages/branches/BranchBalancesPage.jsx) — align visual language; currently already shows Visa + Instapay treasury cards, extend with the same date filter if the user wants parity.
- New: `frontend/src/components/branches/DateFilterBar.jsx`.
- New: `frontend/src/components/branches/TreasuryHeaderCards.jsx`.

### 6.5 Tests
- Frontend smoke: render with mocked API, toggle filter chips, assert re-fetch.
- Manual QA checklist: all four date chips, custom range, empty state, single branch.

### 6.6 Acceptance criteria
- [ ] Three header cards render with live balances.
- [ ] Date filter defaults to Today and refetches on change.
- [ ] Per-branch row shows Cash / Visa / Instapay / Total matching backend aggregate.
- [ ] RTL layout clean at ≥ 1280px and stacked on ≤ 768px.

---

## Cross-phase housekeeping

Carried from Phases 1–2, to be cleaned as we touch the files:
- `backend/tests/api-tests.js` — stale `bankTreasuryId` references.
- `backend/tests/phase-a2-pos.test.js` — uses old `CARD` method.
- `ERP-V2-Test-Plan.html` — documentation drift.

## Rollout order

1. Phase 3 backend → Phase 3 frontend → merge.
2. Phase 4 backend → Phase 4 frontend → merge.
3. Phase 5 backend-only, no UI change → merge (API stable before Phase 6).
4. Phase 6 frontend consumes Phase 5 endpoints → merge.

Each phase ships behind its own PR with the tests listed above green.
