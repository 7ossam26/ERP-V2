# Bulk POS — Step 2: Design Approaches with Trade-offs

> Four architectural trade-offs deferred from the Understanding Lock (§15). Each has 2–3 options with a recommendation. Mark your pick with **X** next to the option, or reply e.g. "D1=B, D2=A, D3=C, D4=A" and I'll move to Step 3.

---

## D1 — Storage model: extend `Sale` vs. new `BulkOrder`

**The question:** where does a bulk order row live in the database?

### Option A — Extend `Sale` (add `source = BULK` + nullable bulk fields)

Add `source` enum (`POS | CALL_CENTER | BULK`) to `Sale`. Add nullable bulk-specific fields directly on `Sale`: `bulkCustomerId`, `sourceWarehouseId`, `scheduledPickupDate`, `proformaNumber`, etc. All three sales channels live in one table.

- **Pros**
  - Reuses existing `Sale` + `SaleItem` + refund + payment plumbing — fastest to build.
  - Unified sales pipeline makes it easy to *optionally* include bulk in future cross-channel reports.
  - Stock-movement and treasury code paths already integrate with `Sale`.
- **Cons**
  - `Sale` becomes schema-bloated: many nullable columns that only apply to one channel.
  - Retail/call-center vs. bulk have very different lifecycles (no shift, no delivery man, different statuses). Guarding every controller with `if (source === BULK)` accumulates.
  - Bulk needs new statuses (`QUOTED`, `PARTIALLY_PAID`) that pollute the retail `SaleStatus` enum.
  - Your Understanding Lock §11 explicitly **excludes bulk from the existing Sales Report** — a unified table works *against* that intent.

### Option B — New `BulkOrder` + `BulkOrderItem` tables

Dedicated models for bulk. Mirror the shape of `Sale`/`SaleItem` but with bulk-specific fields and its own `BulkOrderStatus` enum. `Client` ⟷ `BulkCustomer` are siblings, not one polymorphic type.

- **Pros**
  - Clean separation matches the intent: bulk has its own lifecycle, its own report surface, its own permissions.
  - No nullable-column sprawl on `Sale`; no enum pollution.
  - Each channel's controller stays focused and readable; no branching on `source`.
  - AR ledger naturally attaches to `BulkOrder` (retail has no AR concept).
- **Cons**
  - More code: new Prisma models, new controllers, new routes, new service helpers.
  - Stock-movement integration needs a small shared helper (or two independent callers) — minor.
  - Any future "unified sales view" needs a UNION query. Given §11 excludes bulk from existing reports, this isn't a real cost in v1.

### Option C — `Sale` supertype + `BulkSaleDetails` child table (1:1)

`Sale` stays lean; bulk-only fields live on a joined `BulkSaleDetails(saleId, …)` row. Polymorphism via join.

- **Pros**
  - Keeps `Sale` clean while sharing the core row.
  - Bulk fields isolated in their own table.
- **Cons**
  - Every bulk read is a join; Prisma queries get verbose.
  - Still pollutes `SaleStatus` enum (or forces a parallel `BulkSaleDetails.status` that must stay in sync).
  - Worst of both worlds: neither fully unified nor fully separated.

### Recommendation: **Option B (new `BulkOrder` + `BulkOrderItem`)**

Your locked decisions already split bulk from retail at every operational boundary: separate report, separate invoice-number series, separate permissions, excluded from shift reconciliation, no delivery, optional tax#, AR-tracked. The data model should mirror that separation. Option B costs a few extra Prisma models up front and saves you from `if (source === BULK)` forks forever.

**[ ] A — Extend `Sale`**
**[ ] B — New `BulkOrder` + `BulkOrderItem`  ← recommended**
**[ ] C — `Sale` + `BulkSaleDetails` child table**

---

## D2 — Quote → Order conversion: in-place status flip vs. separate Quote row

**The question:** when a DRAFT/QUOTED becomes CONFIRMED, is it the same row or a new one?

### Option A — Same row, status flip

One `BulkOrder` record. Its `status` moves `DRAFT → QUOTED → CONFIRMED`. Quote number and invoice number are both stored on the same row (populated at the appropriate status transition).

- **Pros**
  - Simpler: one ID, one audit trail, one row to query.
  - Line items, pricing, customer, warehouse all carry over automatically.
  - Invoice history = status history on the same record.
- **Cons**
  - If a quote is revised multiple times before confirmation, the pre-revision state is lost (unless we add revision history).
  - Quote numbers and invoice numbers share a row — two numbering series on one entity (minor; fields are just nullable until transitioned).

### Option B — Separate Quote + Order rows

`BulkQuote` is its own table. On confirmation, spawn a new `BulkOrder` row with `quoteId` FK back to the quote. Quote stays read-only after conversion.

- **Pros**
  - Immutable quote record — audit-friendly if quotes are contractually meaningful.
  - Clean numbering: quote series vs. invoice series each own their table.
- **Cons**
  - More tables, more code, duplicated fields.
  - Line-item duplication between `BulkQuoteItem` and `BulkOrderItem`.
  - Your locked flow makes quotes **optional** — most orders skip the QUOTED state. A dedicated table for an optional detour is overweight.
  - Harder to answer "what's the total value across quotes + confirmed orders for this customer" without UNIONs.

### Recommendation: **Option A (same row, status flip)**

Quotes are optional in your flow and "not editable after creation" is already locked (§8). If a quote needs revision, the rep cancels the DRAFT/QUOTED and creates a new one — same cost as a new row in Option B, but without the schema overhead. If you ever need immutable quote snapshots, add a `BulkQuoteSnapshot` audit log later.

**[ ] A — Same row, status flip  ← recommended**
**[ ] B — Separate `BulkQuote` + `BulkOrder` tables**

---

## D3 — Contract-price table shape

**The question:** how do we store "customer X pays price Y for item Z"?

### Option A — Normalized table `BulkContractPrice(customerId, itemId, price)`

One row per customer-item override. Unique composite key on `(customerId, itemId)`.

- **Pros**
  - Indexable: `WHERE customerId = ?` returns all their overrides instantly.
  - Easy to edit one line at a time in a management UI.
  - Easy to audit: row-level `createdAt`, `updatedAt`, `updatedByUserId`.
  - Easy to query: "which customers have a custom price for item X?"
- **Cons**
  - Rows can grow (customers × items), but your volume is tiny (5 orders/day, modest customer count).

### Option B — JSON blob on `BulkCustomer.contractPrices`

Store `{ itemId: price, … }` as a JSON column on the customer row.

- **Pros**
  - Single row per customer, fewer writes.
- **Cons**
  - Cannot index on `itemId` — "which customers have a custom price for this item" becomes a full scan.
  - Editing one price rewrites the whole blob (lost-update risk with concurrent reps).
  - No row-level audit.
  - Prisma support for JSON columns on MySQL is weaker; harder to validate shape.

### Option C — Versioned `BulkPriceList` entity (price list header + entries + effective dates)

A price list is a first-class entity. Customers link to a price list (many customers can share one). Price lists have versions with effective-from/to dates.

- **Pros**
  - Supports "all customers in this tier pay the same contract prices" — real wholesale pricing model.
  - Time-travel: "what was the price on 2026-01-15?"
- **Cons**
  - Much more complex: price-list management UI, versioning UI, assignment UI.
  - Your locked scope says **per-customer** contract prices (not tiered). Time-travel is not a requested need.
  - Overbuilding for v1.

### Recommendation: **Option A (normalized `BulkContractPrice` table)**

Matches the locked scope exactly. Easy audit, easy indexes, easy editing UI. If you later need tiers (Option C), you add a `BulkPriceListId` column and migrate — not a throwaway.

**[ ] A — Normalized `BulkContractPrice(customerId, itemId, price)`  ← recommended**
**[ ] B — JSON blob on `BulkCustomer`**
**[ ] C — Versioned `BulkPriceList` entity**

---

## D4 — AR ledger: derived vs. materialized

**The question:** how do we compute a customer's open balance?

### Option A — Derive on the fly from `BulkOrder` + `BulkPayment`

Open balance = `SUM(orders.total) - SUM(payments.amount)` computed per query. No separate ledger table.

- **Pros**
  - Single source of truth — orders and payments are the only write paths.
  - No drift risk between ledger and underlying data.
  - No migration to rebuild if you change the rules.
  - At your volume (5 orders/day × customers ≈ thousands of rows max), aggregate queries are trivially fast with proper indexes.
- **Cons**
  - Aging report ("what's 30/60/90+ days old") needs date-anchored aggregation — still a query, just with `CASE WHEN` on due dates.
  - Statement of account needs ordered iteration — also just a query.

### Option B — Materialized `CustomerLedger` with running balance

Every confirmed order inserts a debit ledger entry, every payment inserts a credit ledger entry. Current balance = last row's running total (or `SUM(amount)`). Dedicated ledger rows for aging/statements.

- **Pros**
  - Statement of account is a trivial `SELECT * FROM ledger WHERE customerId = ? ORDER BY date`.
  - Explicit paper trail matches traditional accounting mental model.
- **Cons**
  - Double-entry risk: any bug that creates/mutates an order without its matching ledger entry silently diverges.
  - Every order cancel / refund needs a compensating ledger entry — extra transactional complexity.
  - At your volume, you're paying the complexity tax for performance you don't need.

### Option C — Hybrid (derive balance, materialize statement cache)

Derive the open balance from orders + payments (like A). Additionally emit immutable "statement line" rows on CONFIRMED orders and on payments for statement rendering and aging.

- **Pros**
  - Balance stays consistent with source data (no drift).
  - Statements are still a simple ordered read.
- **Cons**
  - Still has the "must emit line on every event" discipline — same downside as B, just for fewer fields.

### Recommendation: **Option A (derive on the fly)**

Your volume is low, your consistency risk tolerance is low, and Prisma + MySQL handle this aggregation comfortably with indexes on `bulkCustomerId`. Aging and statements are SQL queries, not data-model concerns. If performance ever becomes an issue (it won't at 5/day), add a materialized view later.

**[ ] A — Derive on the fly  ← recommended**
**[ ] B — Materialized `CustomerLedger`**
**[ ] C — Hybrid derive-balance + cached statement lines**

---

## Summary of recommendations

| # | Decision | Pick |
|---|---|---|
| D1 | Storage model | **B — new `BulkOrder` + `BulkOrderItem`** |
| D2 | Quote → Order | **A — same row, status flip** |
| D3 | Contract price shape | **A — normalized table** |
| D4 | AR ledger | **A — derive on the fly** |

This set biases toward **clean separation at the data model level** (D1) and **lean implementation everywhere else** (D2/D3/D4). It matches the locked v1 scope without pre-building for speculative wholesale-tier pricing or accounting-grade ledgers.

---

## Sign-off

Reply with your picks (e.g. `D1=B, D2=A, D3=A, D4=A` or just "all recommended") and I'll write **Step 3: design doc + decision log + implementation plan**.
