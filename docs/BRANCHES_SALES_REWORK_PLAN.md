# Branches-Sales Rework Plan

**Goal:** Make the branches-sales page give one clear answer to: *"how much cash is in each branch right now, and how much did each branch sell on Visa/Instapay in the chosen window?"*

---

## Why this plan exists

The page today mixes incompatible concepts under one visual rhythm:

- **Header cards** show *cumulative treasury balances* (stock).
- **Branch detail rows** show *windowed sales* (flow).

They never reconcile. Auditors hit the gap immediately. The settlement-handoff fix we just shipped also surfaced a related correctness bug — cash delivery sales count toward branch revenue *before* they actually hit the till.

---

## Decisions locked

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Time window for sales | Date-range picker, default = today | Confirmed by user |
| D2 | HQ/main treasury visibility | Keep on this page | Confirmed by user |
| D3 | Cash card semantics | Always "current balance"; ignores date picker | Confirmed by user — *"cash doesn't change, right now cash in treasury"* |
| D4 | Trend % "vs yesterday" | Keep but relabel "صافي اليوم vs الأمس" | Picker-independent; clear time scope |
| D5 | Time-domain captions | Each card captioned `(الآن)` or `(للفترة)` | Light-touch, removes the stock/flow ambiguity |
| D6 | "Sales" definition | `Sale.paidAmount`, not `Sale.total`, everywhere | Partial tenders / debt shouldn't inflate Visa/Instapay |
| D7 | Cash excludes rider wallet | Cash delivery sales (`OUT_FOR_DELIVERY`) don't count until settled | Aligns with the settlement work; eliminates double-count |
| D8 | Layout direction | **Approach 2** — HQ as a thin context strip + 3-up operational row | Clear hierarchy: HQ is reference, 3-up is the scoreboard |

---

## Approach 2 — final picture

```
[ الخزينة الرئيسية: 540.00 ج.م — الرصيد الحالي ]   ← thin context strip

┌──────────────────┬──────────────────┬──────────────────┐
│ نقدية الفروع     │ مبيعات فيزا       │ مبيعات انستاباي │
│ (الآن)           │ (للفترة)         │ (للفترة)         │
│ 210.00 ج.م       │ 0 ج.م            │ 150.00 ج.م       │
└──────────────────┴──────────────────┴──────────────────┘

[ Date picker — اليوم · أمس · آخر 7 أيام · تخصيص ]

تفصيل الفروع
┌──────────────────────────────────────────────────────────┐
│ الفرع الرئيسي                              الإجمالي 360 │
│ ───────────────────────────────────────────────────────── │
│ نقدي 210 (الآن) │ فيزا 0 (للفترة) │ انستاباي 150 (للفترة) │
└──────────────────────────────────────────────────────────┘
```

Key callouts:

- The picker visually sits **after** the operational row but **before** the per-branch list — close enough to imply scope over both, but cards self-caption their time domain.
- Per-branch card uses the same caption pattern.
- HQ is a context strip (one line, low visual weight).

---

## Assumptions

1. `branch.treasury.balance` is a faithful representation of cash currently held by that branch (we trust the existing accounting paths in `routes/sales.js` and the settlement work).
2. There is exactly one main/HQ treasury, looked up from `SystemConfiguration.mainTreasuryId`.
3. The Visa and Instapay treasuries hold cumulative running balances; we don't display those balances on this page anymore (replaced by *windowed sales*).
4. `Africa/Cairo` (no DST) — server local-day boundaries are fine for date filtering. Already documented in [routes/branches.js:163](backend/routes/branches.js#L163).

---

## Open questions (deferred)

- Should the page support multi-branch filtering (e.g., "show me only branch X and Y")? Out of scope for this rework.
- Should the trend % be removable per user preference? Out of scope.
- Should we expose the Visa/Instapay treasury balances elsewhere (since they're no longer on this page)? Probably yes on a future "treasuries" page; out of scope here.

---

## Phases

### Phase 1 — Data correctness (backend only) ⏳ STARTING NOW

Goal: fix the numbers before reshaping the UI. After this phase, the existing UI will already show correct values; the layout changes come next.

**1.1 — `/branches/balances` endpoint changes:**

- Switch the per-method aggregate from `_sum.total` to `_sum.paidAmount` (D6).
- Exclude rider-held cash: `paymentMethod=CASH` rows where `deliveryStatus = OUT_FOR_DELIVERY` are not counted as branch cash (D7). Keep `DELIVERED` and `null` (non-delivery sales).
- Add a new field `currentCashBalance` per branch = `branch.treasury.balance`. The legacy `cashBalance` field stays as windowed paid CASH revenue but gets renamed to `cashSales` in the response shape; an alias keeps `cashBalance` for backward compat.
- Add response-level aggregates: `windowVisaSales`, `windowInstapaySales`, `currentCashTotal` — pre-aggregated so the front end doesn't have to re-sum.

**1.2 — `/branches/summary` endpoint changes:**

- Switch `paidAmount` consistency (already used here — verify).
- Add a flag `scope: "today-vs-yesterday"` so the frontend can label the trend correctly.

**1.3 — Verification:**

- Build clean.
- Existing UI still renders without crash.
- Manual spot-check: a CASH delivery in OUT_FOR_DELIVERY no longer inflates the branch's "cash" column.

### Phase 2 — UI restructure (Approach 2)

- Introduce HQ context strip component.
- Reshape header from 3-card-stock to 3-card-mixed with captions (D5).
- Move the date picker visually into the operational scope (D5 reinforcement).
- Update `BranchCard` per-branch tile to caption time domain.
- Trend badge relabeled (D4).
- Drop the `mainTotal = main + branches` calculation from `TreasuryHeaderCards` — it conflated two pools.

### Phase 3 — Cleanup & polish

- Remove the legacy `visaToday`/`instapayToday` field aliases from the API.
- Tailwind opacity nit (`bg-primary/8` → `/10`).
- Operator-precedence guard in the front-end `total ?? cash + visa + instapay` (parenthesize).
- Loading skeletons for header cards.
- Delete the now-unused `mainTotal` math.

---

## Verification per phase

| Phase | Smoke test | Money-correctness test |
|---|---|---|
| 1 | Build + existing UI loads | Create a CASH delivery → it must NOT show up in branch cash until settled |
| 2 | New layout renders, captions visible | All numbers match Phase 1 outputs (UI is dumb pipe) |
| 3 | Build + lint clean | n/a |

---

## Out of scope

- The full HQ vs branch-treasury reconciliation page (separate concern).
- A per-payment-method historical chart.
- WebSocket-live updates of cash balance.
- Permissions overhaul.
