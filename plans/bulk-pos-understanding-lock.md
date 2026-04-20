# Bulk POS — Understanding Lock

> Confirm this captures your intent. After your sign-off, I move to **Step 2: 2–3 design approaches with trade-offs**, then **Step 3: design doc + decision log + implementation plan**.

---

## 1. Purpose

A new **wholesale/B2B sales module** (`BULK_POS`) that lives alongside the retail POS and Call Center modules. Targets company-to-company transactions: large orders, contract prices, deferred payment, formal tax invoices, AR tracking. Independent of cashier shifts.

---

## 2. Actors & Permissions

- New standalone module: **`BULK_POS`**.
- Granular permissions assigned via the existing **superadmin dashboard** (flexible RBAC):
  - `BULK_POS` — use the sales screen
  - `BULK_CUSTOMERS` — manage bulk customer master data
  - `BULK_PRICING` — manage per-customer contract prices
  - `BULK_CREDIT` — manage credit limits, collections, AR
  - `BULK_REPORTS` — view bulk reports
- Reps see **all** bulk orders company-wide (no branch/agent scoping).
- **No approval workflow** — reps confirm, cancel, refund on their own.

---

## 3. Customer Model

- New **`BulkCustomer`** (a.k.a. Company) model — separate from retail `Client`.
- Required fields: company/trade name, tax number (optional), primary contact, secondary contacts (0..n), shipping address, credit limit.
- **One** shipping address per customer. Billing address = shipping.
- Customer creation: **manual only** (no CSV imports in v1).

---

## 4. Pricing

- **Customer-specific contract price list**: per-customer-per-item price override table. Falls back to item base price if no override.
- **Rep can override price freely at order time** (no approval).
- **Cost / margin hidden** from reps.
- **No discounts** (no discount UI, no discount reason codes) — price negotiation happens via the contract price or inline override.
- **Tax-inclusive** prices: stored prices already include VAT; invoice displays net / VAT / total breakdown.

---

## 5. Tax & Invoicing

- Formal **Tax Invoice** issued only when the customer has a tax number.
- Customers without a tax number get a **Sales Receipt** instead.
- **Proforma Invoice** issued for DRAFT / QUOTED orders.
- All documents: **A4 PDF**, reuse the existing `PrintTicket` header.
- Invoice numbering: **separate series**, **global counter**, format `BULK-0001`, `BULK-0002`, …

---

## 6. Payment & Credit

- Payment methods: **cash, bank transfer (with reference), cheque (with cheque # + due date), credit (deferred), split/partial**.
- **Full AR tracking** — open balance per customer, aging report, statement of account.
- **Collections screen** inside the module for recording payments against outstanding invoices.
- Rep **picks the treasury** the payment lands in at collection time.

### Credit limit

- Every customer has a **credit limit field** (nullable).
- **Optional per customer** — a null/unset limit means **unlimited credit** (no enforcement for that customer).
- When a limit is set: **hard block** — system refuses to CONFIRM a new credit-bearing order if it would push the customer's open AR above their credit limit. Rep must collect or reduce before confirming.

---

## 7. Inventory & Warehouses

- Rep **picks the source warehouse** at order time (existing `Warehouse` model).
- **One warehouse per order** (no split fulfillment).
- Bulk warehouses and retail warehouses **both allowed** — no separation required.
- **Stock deducted at CONFIRMED.**
- **Backorders blocked** — cannot confirm if any line exceeds available stock.
- Cancelling a CONFIRMED order **auto-reverses** the stock movement.

---

## 8. Order Lifecycle

```
DRAFT ──▶ (QUOTED, optional) ──▶ CONFIRMED ──▶ PAID / PARTIALLY_PAID
   │              │                   │
   └──────────────┴──▶ CANCELLED      └──▶ RETURNED (refund / credit note flow)
       (only before CONFIRMED;
        no stock to reverse)
```

- **Not editable** after creation — lines/prices/customer are frozen once saved as DRAFT.
- **Cancel** allowed **only before CONFIRMED** (i.e., while DRAFT or QUOTED). Any rep, no approval, audit-logged. No stock reversal needed because stock deducts at CONFIRMED.
- Once **CONFIRMED**, the order is locked. To unwind: use the **refund / credit note / return** flow, which reverses stock as part of the return.
- **Refunds / returns** after CONFIRMED or PAID: rep picks **cash refund OR credit note** per refund.
- Runs **independently of cashier shifts** — no open-shift requirement, excluded from shift reconciliation.

---

## 9. Fulfillment

- **Customer pickup only** — no in-house delivery, no delivery men, no zones.
- **Freight billed separately** (not a line item handled by this module).
- **Optional scheduled pickup date** on the order.
- **No multi-drop / multi-stop.**

---

## 10. Documents

- Proforma Invoice (DRAFT / QUOTED)
- Tax Invoice (CONFIRMED, customer has tax#)
- Sales Receipt (CONFIRMED, no tax#)
- Credit Note (refund path)
- All A4 PDF, shared header with existing `PrintTicket`.

---

## 11. Reporting

- **Excluded** from the existing Sales Report — separate report surface.
- Reports in v1:
  - Bulk sales by customer
  - AR aging (current / 30 / 60 / 90+)
  - Statement of account (per customer)

---

## 12. UX & Non-Functional

- **POS-style layout clone**: catalog on left, cart on right.
- **Arabic-first RTL.**
- **Desktop + tablet + phone parity** — phone can do everything desktop can.
- **Online-only** (no offline mode).
- **Volume**: ~5 orders/day, 2 concurrent reps, ~10 lines/order, max order value ~2M EGP.

---

## 13. Out of Scope (v1)

- CSV imports for customers or price lists
- Supplier overlap (BulkCustomer is not a Supplier)
- Loyalty programs
- Recurring orders / subscriptions
- Multi-drop delivery
- Multi-currency
- Offline mode

---

## 14. Rollout (phased)

1. **Phase 1** — BulkCustomer model, contract pricing, manual order entry (DRAFT → CONFIRMED), stock deduction, Sales Receipt.
2. **Phase 2** — Quote workflow, Tax Invoice, Credit Note, AR + Collections + credit-limit enforcement.
3. **Phase 3** — Reports (bulk sales, AR aging, statement), future CSV imports.

- **Greenfield data** — no migration from existing sales.
- **No feature flag** — phases ship as PRs behind the permission gate (module hidden until permissions granted).

---

## 15. Open items deferred to Step 2 (design doc)

These are intentionally *not* decided yet — they're architectural trade-offs I'll present with 2–3 options:

- **Storage model**: extend `Sale` (add `source = BULK` + nullable bulk fields) vs. dedicated `BulkOrder` table. You said "recommend best tradeoff."
- **Quote → Order conversion**: same row with status flip, or separate Quote row linked to a new Sale row.
- **Contract-price table shape**: `(customerId, itemId, price)` table vs. JSON field on BulkCustomer vs. versioned price-list entity.
- **AR ledger shape**: derive open balance from Sales + Payments on the fly vs. materialized `CustomerLedger` entries.

---

## Sign-off

Reply **"locked"** (or call out any line you want to change) and I'll move to Step 2: design approaches with trade-offs.
