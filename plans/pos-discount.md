# POS Discount — Implementation Plan

## 1. Context

The `sales` table already supports discounts (migration `20260420081752_add_sale_discount_fields`) with columns:

- `discount_type` — `PERCENTAGE` | `VALUE`
- `discount_value` — raw input (e.g. `10` for 10% or `50` EGP)
- `discount_amount` — computed EGP amount persisted for reporting

Call Center (`CallCenterNewOrderPage.jsx`, `callCenter.controller.js`) already implements this flow end-to-end. POS does not. This plan wires POS to the same capability with the tech-lead answers below.

## 2. Decisions (from tech-lead answers)

| # | Decision |
|---|---|
| 1 | **Level:** order-level only *(confirmed)* |
| 2 | **Types:** both `PERCENTAGE` and `VALUE` |
| 3 | **Stacking:** mutually exclusive — one active discount, switching clears the other *(confirmed)* |
| 4 | **Authorization:** any cashier, no PIN/manager gate |
| 5 | **Cap:** none beyond existing backend guards (% ≤ 100, VALUE ≤ subtotal) |
| 6 | **Reason:** required, dropdown |
| 7 | **Order of math:** discount on **subtotal**, **before tax**, **before delivery fee** |
| 8 | **Rounding:** nearest **1 EGP** (`Math.round`) on `discountAmount` and final `total` |
| 9 | **UX location:** cart summary panel |
| 10 | **Display:** subtotal → discount line → tax → delivery → total |
| 11 | **Persistence on cart edit:** % recomputes; VALUE clamps to new subtotal (toast on clamp) |
| 12 | **Receipt:** discount line **with reason label** visible to customer |
| 13 | **Reports:** discount totals in **both** `POSReportModal` and `EndShiftModal` (Z-report) |
| 14 | **Refunds:** proportional refund of the discount |
| 15 | **Reuse call-center pattern** — extract shared `DiscountPanel` component |
| 16 | **Delivery in POS:** POS does have delivery orders — keep delivery-fee handling |
| 17 | **Audit:** persist `discount_applied_by_user_id` on the sale when a discount is used |
| 18 | **Editability:** discount freely editable/clearable pre-checkout; locked after sale confirmed |
| 19 | **Floor:** block applying a discount when `subtotal <= 0` |

## 3. Reason Codes (dropdown seed)

Reuse the exact same list call-center uses once we agree. Proposed seed:

- `STAFF_DISCOUNT` — خصم موظف
- `LOYAL_CUSTOMER` — عميل مميز
- `DAMAGED_ITEM` — منتج تالف/عيب
- `MANAGER_COMP` — مجاملة إدارة
- `PROMO` — عرض ترويجي
- `OTHER` — أخرى

Stored as a new column `sales.discount_reason` (VARCHAR(32), nullable). Migration required.

## 4. Backend Changes

### 4.1 Schema

New migration `add_sale_discount_reason_and_applied_by`:

```sql
ALTER TABLE `sales`
  ADD COLUMN `discount_reason` VARCHAR(32) NULL,
  ADD COLUMN `discount_applied_by_user_id` INT NULL,
  ADD CONSTRAINT `sales_discount_applied_by_fk`
    FOREIGN KEY (`discount_applied_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

Update `prisma/schema.prisma` Sale model accordingly. Call-center controller backfills these too for parity.

### 4.2 POS sale endpoint

Locate the POS sale-creation controller (mirror of `callCenter.controller.js` create-order). Accept new optional fields on the request body:

- `discountType?: "PERCENTAGE" | "VALUE"`
- `discountValue?: number`
- `discountReason?: string` (required when `discountValue > 0`)

Validation (mirror lines 256–275 of `callCenter.controller.js`):

- If `discountValue > 0`, `discountType` and `discountReason` are required.
- Reject if `subtotal <= 0`.
- `PERCENTAGE` capped at 100.
- `VALUE` capped at subtotal.
- Compute `discountAmount = round1(type === 'PERCENTAGE' ? subtotal * val / 100 : val)`.
- Compute `discountedSubtotal = subtotal - discountAmount`.
- Compute `tax = discountedSubtotal * taxRate` (tax on post-discount subtotal).
- Compute `total = round1(discountedSubtotal + tax + deliveryFee)`.
- Persist `discount_type`, `discount_value`, `discount_amount`, `discount_reason`, `discount_applied_by_user_id = req.user.id`.

### 4.3 Reports

Extend the POS report aggregation used by `POSReportModal.jsx` to return per-shift totals:

- `discountsCount`
- `discountsAmount`
- Optional breakdown by `discount_reason`

### 4.4 Refund endpoint

In the refund controller (backing `RefundModal.jsx`), when computing refund amount for a discounted sale, compute the proportional share of the order-level discount that applies to the returned line, then subtract it from the line price:

```
// sales.subtotal is stored pre-discount (see §4.2)
original_subtotal          = sale.subtotal
proportional_discount_share = round1(lineSubtotal * discount_amount / original_subtotal)
refundAmount               = lineSubtotal - proportional_discount_share
```

Algebraically identical to the "share of the post-discount price" form, but phrased to match Decision §2 #14 ("proportional refund of the discount") so implementers aren't second-guessing the wording. Store `proportional_discount_share` on the refund record for audit.

## 5. Frontend Changes

### 5.1 New shared component

`frontend/src/components/pos/DiscountPanel.jsx` — extracted from the call-center JSX block (lines ~430–460 of `CallCenterNewOrderPage.jsx`). Props:

```ts
{
  subtotal: number,
  value: { type: 'PERCENTAGE'|'VALUE', value: number, reason: string },
  onChange: (next) => void,
  reasonOptions: Array<{ code: string, label: string }>,
}
```

Refactor `CallCenterNewOrderPage.jsx` to consume it too → single source of truth (answers #15).

### 5.2 `POSPage.jsx`

- Add state: `discountType`, `discountValue`, `discountReason`.
- Replace existing totals block (`POSPage.jsx:657-662`):
  ```js
  const subtotal = /* existing */;
  const discountAmount = computeDiscount(subtotal, discountType, discountValue); // Math.round
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = discountedSubtotal * taxRate;
  const total = Math.round(discountedSubtotal + tax + deliveryFee);
  ```
- Render `<DiscountPanel/>` inside the cart summary, above the total rows.
- Cart summary rows order: **Subtotal**, **Discount (−amount, reason label)**, **Tax**, **Delivery**, **Total**.
- Disable the discount panel when `subtotal <= 0`.
- Freely editable/clearable pre-checkout (no lock).
- On cart mutation: if `PERCENTAGE` → recompute; if `VALUE` → clamp to new subtotal, toast if clamped.
- On checkout, include `discountType`, `discountValue`, `discountReason` in payload; block submit if `discountValue > 0` but reason empty.
- Extend the checkout payload (`POSPage.jsx:919-920`) with the new fields alongside `taxRate`/`taxAmount`, and ensure `taxAmount` reflects post-discount tax.

### 5.3 `PrintPaymentModal.jsx` + `PrintTicket.jsx`

Add a discount line between subtotal and tax, with the reason label visible to the customer:

```
Subtotal:          XXX
Discount (10% — خصم موظف):  -YY
Tax (14%):          TT
Delivery:           ZZ
Total:             TTT
```

Tax line must reflect the **post-discount** tax computed by the backend.

### 5.4 `POSReportModal.jsx`

Add a **Discounts** section showing count, total amount, and breakdown by reason code for the selected shift/range. Include a column for `applied_by` (cashier name) when drilling into individual discounted sales.

### 5.4b `EndShiftModal.jsx` (Z-report)

Add a one-line discount summary to the shift-close totals: `Discounts: N orders, −XX EGP`. Cashier sees this before confirming shift end.

### 5.5 `OrdersHistoryModal.jsx`

Show discount info in the order detail view (type, value, amount, reason).

### 5.6 `RefundModal.jsx`

When the selected sale has a discount, show the proportional refund math to the cashier before confirm.

## 6. Rounding Helper

Add `frontend/src/utils/money.js` (if not present) with:

```js
export const round1 = (n) => Math.round(Number(n) || 0);
```

Use in POS totals and receipt. Backend mirrors the same rule.

## 7. Edge Cases

- `subtotal <= 0` → discount panel disabled; backend rejects as well.
- Cart emptied while discount active → clear discount state.
- Item removed causing VALUE > new subtotal → clamp to subtotal, toast "تم تعديل الخصم ليتناسب مع الإجمالي".
- Switching discount type (% ↔ VALUE) → clears the other field (mutually exclusive enforced in UI).
- Reason dropdown unselected + value entered → disable checkout button with tooltip.
- Shift reopen / unfinished sale recovery → discount state must be part of the persisted draft (check how POS persists unfinished carts).
- Post-sale edit attempts → not allowed; discount is frozen once the sale is confirmed (refund path handles adjustments).
- Multi-currency: N/A (single currency confirmed by existing code).

## 8. Test Plan

Backend (Jest, mirror `backend/tests/`):

- Creates sale with PERCENTAGE → persists correct `discount_amount`.
- Creates sale with VALUE clamped to subtotal.
- Rejects `discountValue > 0` without `discountReason`.
- Refund of discounted sale returns proportional amount.
- Report aggregates discount totals per shift.

Frontend (manual smoke on dev server):

- Apply 10% → total drops, receipt shows line.
- Switch to 50 EGP → total updates.
- Empty cart → discount clears.
- Remove items until VALUE > subtotal → clamp + toast.
- Checkout without reason → blocked.
- Print receipt → discount visible.
- POS report → discount totals visible.
- Partial refund → proportional.

## 9. Rollout Steps

1. Backend: schema migration (`discount_reason`, `discount_applied_by_user_id`) + Prisma model update.
2. Backend: POS sale controller validation + computation + persistence.
3. Backend: POS report + shift-close aggregation + refund proportional math.
4. Backend: unit + integration tests.
5. Frontend: extract shared `DiscountPanel`; refactor call-center to consume it.
6. Frontend: wire `POSPage` (totals, checkout payload, disable rules).
7. Frontend: update `PrintPaymentModal`, `PrintTicket`, `POSReportModal`, `EndShiftModal`, `OrdersHistoryModal`, `RefundModal`.
8. Manual QA on dev server (golden path + all edge cases in §7).
9. Open PR.

## 10. Files Touched (expected)

**Backend**

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<new>_add_sale_discount_reason/migration.sql`
- POS sale controller (mirror of `callCenter.controller.js`)
- POS report controller
- Refund controller
- `backend/tests/...` new specs

**Frontend**

- `frontend/src/components/pos/DiscountPanel.jsx` *(new)*
- `frontend/src/pages/pos/POSPage.jsx`
- `frontend/src/components/pos/PrintPaymentModal.jsx`
- `frontend/src/components/orders/PrintTicket.jsx`
- `frontend/src/pages/pos/POSReportModal.jsx`
- `frontend/src/pages/pos/OrdersHistoryModal.jsx`
- `frontend/src/pages/pos/RefundModal.jsx`
- `frontend/src/pages/call-center/CallCenterNewOrderPage.jsx` *(refactor to shared panel)*
- `frontend/src/utils/money.js` *(add `round1` if missing)*

---

## 11. Review Addenda (2026-04-21)

Folded in from [fix-consol-and-plan-review.md §B.1](fix-consol-and-plan-review.md). Each item updates the corresponding section above; entries flagged **DECIDE** still need a tech-lead call before implementation starts.

### 11.1 Rounding rule — unified (finding 1.1.a)

Carry full precision through every intermediate computation. Round **only** at two moments:
1. When persisting `discountAmount` (nearest 1 EGP).
2. When computing the final `total` (nearest 1 EGP).

The backend returns both the persisted values and the final `total` to the client. The POS cart and the receipt render the backend-computed `total` verbatim — they do not re-round line totals. Tax line on the receipt is rounded for display only but reflects the same pre-rounded value the backend used when computing `total`. This guarantees backend `total ≡ receipt total` to the cent.

### 11.2 Refund formula — rewritten in §4.4 (finding 1.1.b–c)

See §4.4 above. `original_subtotal` is `sales.subtotal`, which is stored pre-discount (verified against migration `20260420081752_add_sale_discount_fields`). The `refundAmount = lineSubtotal − proportional_discount_share` form replaces the prior ambiguous wording.

### 11.3 Tax-on-post-discount — **DECIDE** (finding 1.1.d)

Current plan: `tax = discountedSubtotal * taxRate`. This reduces the taxable base, which is standard in many jurisdictions but not all. Blocking question: does Egyptian VAT treat an unconditional discount as reducing the taxable base, or as a post-tax concession? Pending a finance/legal answer, the plan keeps `tax = discountedSubtotal * taxRate`. If the answer flips, change to `tax = subtotal * taxRate` and render the discount as a post-tax line on the receipt.

### 11.4 Schema tightenings (finding 1.2)

- §4.1 FK changed from `ON DELETE SET NULL` to `ON DELETE RESTRICT` (see migration snippet above).
- Replace free-text `discount_reason` with an FK to a new lookup table **`discount_reasons`**:
  ```sql
  CREATE TABLE discount_reasons (
    code               VARCHAR(32) PRIMARY KEY,
    label_ar           VARCHAR(80) NOT NULL,
    customer_label_ar  VARCHAR(80) NOT NULL,
    is_active          TINYINT(1) NOT NULL DEFAULT 1
  );
  ```
  Seed the six codes from §3. `customer_label_ar` is what prints on the receipt (solves 1.3.c — customer never sees `MANAGER_COMP`). `sales.discount_reason` becomes a FK, not free-text.
- Historical call-center rows backfilled with `discount_applied_by_user_id = NULL`. Reports group NULL as "(Legacy)".

### 11.5 Cart/state rules (finding 1.3.a–b, 1.3.e)

- **Draft restore on shift reopen:** clear discount type, value, and reason. Cashier must re-apply. (Rationale: avoids stale discounts surviving an unattended cart.)
- **Subtotal drops to 0:** clear discount inputs as well (not only the computed amount).
- **`taxRate == 0` or `tax == 0`:** suppress the tax line on the receipt.

### 11.6 Z-report rule (finding 1.3.d)

The shift Z-report discount totals **exclude voided sales**, matching the existing rule for sales totals.

### 11.7 Abuse-detection report — **DEFER** (finding 1.4.a)

No pre-auth gate. Post-facto report in Phase 2: flag sales where `discount_amount > 500 EGP` OR `discount % > 30%`. Not blocking.

### 11.8 Audit double-write (finding 1.4.b)

Both `sales.discount_applied_by_user_id` and `audit_logs.actor_id` derive from `req.user.id` on the same request — verify with a unit test during implementation. No spec change.
