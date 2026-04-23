# Bulk POS — Phase 2 Hardening Plan

**Branch:** `feat/call-center-phase-1` (continue here)
**Scope:** Close the 15 open issues on the bulk module surface (POS, orders list, order detail, collections, modals, invoice print, customer account).
**Status:** Draft — pending approval before execution.

---

## 1. Issue Inventory → Buckets

Fifteen problems grouped into five work streams. Each stream is independently shippable so we can land them in order without a stop-the-world refactor.

| # | Issue | Stream |
|---|---|---|
| 1 | POS adds to cart without stock check | **A. Cart & pricing correctness** |
| 4 | Order tax still hardcoded 14% instead of settings | **A** |
| 10 | Input validation weak (qty / price can be empty, negative, NaN) | **A** |
| 11 | Quantity step wrong (piece → 1, weighted → 0.01) | **A** |
| 15 | POS "تأكيد" bypasses payment-method picker (confirms immediately) | **B. Payment flow overhaul** |
| 2 | Order detail exposes only 2 payment methods | **B** |
| 3 | No treasury selection for cash / cheque in POS flow | **B** |
| 5 | Credit-confirmed order doesn't appear in customer account tab | **C. Customer account (AR) ledger** |
| 14 | Collections page should match `SupplierAccountsPage` layout | **C** |
| 6 | Invoice "print" dumps plain text — want real PDF | **D. PDF invoice** |
| 7 | Documents on order cannot be opened | **D** |
| 8 | `window.confirm` used for confirm action — replace with modal | **E. UX polish (modals + icons)** |
| 9 | Want a dedicated "change status" button on order detail | **E** |
| 12 | Replace every `window.prompt` with a modal | **E** |
| 13 | Action column: drop "تأكيد" + "إلغاء" + text "عرض"; keep single blue eye-icon link | **E** |

---

## 2. Design Direction (frontend-design DFII)

**Aesthetic:** *Editorial-Industrial* — already the house style (coffee-tone primary `#7B3F2D`-ish, `bg-accent/30` tables, `rounded-xl`, `shadow-soft`). We keep it.

**DFII scoring for this change set:**

| Dimension | Score | Note |
|---|---|---|
| Aesthetic Impact | 3 | Consistency work, not a restyle |
| Context Fit | 5 | Purely serves the internal ERP user |
| Feasibility | 5 | All primitives already exist (`Modal`, `StatusChip`, `formatEGP`) |
| Performance Safety | 5 | No new heavy deps besides one PDF lib |
| Consistency Risk (subtract) | 1 | Matches existing supplier-accounts page |

**DFII = 3 + 5 + 5 + 5 − 1 = 17 → clamp to 15 (Excellent).** Proceed.

**Differentiation anchor:** the single eye-icon action cell. No other ERP page in this repo uses an icon-only action row — it gives the orders list a denser, scan-friendly rhythm while keeping every command reachable through the detail page.

---

## 3. Stream A — Cart & Pricing Correctness

### A1. Stock check before add-to-cart  *(issue #1)*

- **Backend**: extend `GET /api/items` (or add `GET /api/bulk/items?warehouseId=…`) to return `onHand` per item for the selected warehouse. If adding a route is more surgical, create `bulkService.listItemsWithStock(warehouseId)` on the frontend and have it hit the existing `Inventory` lookup.
- **Frontend [BulkPOSPage.jsx]**:
  - Reload the catalog whenever `warehouseId` changes.
  - Each catalog card shows `onHand` next to the unit (e.g., `piece · 90 متاح`).
  - `addToCart(item)` must reject with an Arabic toast if `existingQtyInCart + 1 > onHand`.
  - `updateLine(…, quantity)` must clamp / reject quantities exceeding `onHand`.
  - Disable the card button when `onHand <= 0`, and add a muted "نفد المخزون" badge.

**Why here, not the confirm step?** The backend `applyBulkOrderStockMovement` check is the authoritative stop — we keep it, but we want UI to prevent the obvious case so cashiers aren't surprised at confirm time.

### A2. Tax rate from settings *(issue #4)*

Already fetched in `BulkPOSPage` and `BulkOrderDetailPage` on a previous pass, BUT:

- **Backend [bulkOrder.controller.js:146]**: `create` still defaults `taxRate` to `DEFAULT_TAX_RATE = 0.14`. Change to:
  ```js
  const cfg = await prisma.systemConfiguration.findFirst();
  const defaultTaxRate = cfg?.taxRate != null ? Number(cfg.taxRate) / 100 : 0.14;
  const taxRate = body.taxRate != null ? Number(body.taxRate) : defaultTaxRate;
  ```
- **Frontend**: POS already passes no `taxRate` — so client is fine. Audit by creating a fresh order after the backend change and verify `order.taxRate === settings.taxRate / 100`.

### A3. Input validation + step fix *(issues #10, #11)*

Add a small util `validateCartLine(line, item)` returning `{ ok, error }` and use it in `saveDraft`/`saveQuote`/`openConfirmModal`:
- `quantity` finite, `> 0`, `≤ onHand`
- `unitPrice` finite, `≥ 0`

Per-input tweaks in POS and BulkPaymentModal:
- Quantity `<input type="number">`: `step={item.isWeighted ? "0.01" : "1"}`, `min="0.01"` for weighted / `"1"` for pieces.
  (If no `isWeighted` flag exists on `item`, treat `unit === "piece" | "قطعة"` as piece → step 1; otherwise 0.01.)
- Unit price: `step="0.01"`, `min="0"`.
- Payment amount: `step="0.01"`, `min="0.01"`, `max={balanceDue}` (already present — keep).

---

## 4. Stream B — Payment Flow Overhaul

### B1. POS "تأكيد" must open payment-method modal first *(issue #15)*

Current code in `BulkPOSPage.openConfirmModal`:
1. Create DRAFT order
2. Immediately call `confirmOrder(id, { paidAmount: 0 })` — this is what "directly confirms" means
3. Then open `BulkPaymentModal`

Replace with a **pre-confirm** method picker:

1. User clicks "تأكيد" → open new component `BulkConfirmOrderModal` (reuses `Modal`).
2. Modal collects: `method` (CASH | BANK_TRANSFER | CHEQUE | CREDIT), `treasuryId` (when CASH/BANK/CHEQUE), `amount` (prefilled with total for cash methods, 0 for CREDIT, editable for partial), `bankReference`, `chequeNumber`, `chequeDueDate`, `notes`.
3. On submit:
   - `createOrder({...DRAFT})`
   - `confirmOrder(id, { paidAmount: amount })`
   - If method is CASH/BANK/CHEQUE and amount > 0: we also need the backend to record the **real** payment (treasury, method, references). See B2.
4. Navigate to `/bulk/orders/:id`.

Add a "السابق" button so user can still go back to the cart without losing it.

### B2. Backend `confirm` must accept the chosen method *(issues #2, #3)*

Current `confirm` just creates a synthetic CASH payment with `treasuryId: null`. Extend the request body:

```js
{
  paidAmount: number,          // 0 → CREDIT; total → fully paid
  method?: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT",
  treasuryId?: number,         // required when method is cash-like and amount > 0
  bankReference?: string,
  chequeNumber?: string,
  chequeDueDate?: string,
  notes?: string,
}
```

Validation:
- If `paidAmount > 0` and `method !== "CREDIT"` → `treasuryId` required.
- If `method === "CHEQUE"` → `chequeNumber` + `chequeDueDate` required.
- If `method === "BANK_TRANSFER"` → `bankReference` required (soft; log warning otherwise).
- If `paidAmount === 0` → force `method = "CREDIT"`.

The bulkPayment row gets the real values, not `null`.

Remove the branch in `BulkOrderDetailPage.onConfirmCash` that sends `{ paidAmount: Number(order.total) }` with no method — route that through the same new modal (`BulkConfirmOrderModal`) so detail page and POS share one code path.

### B3. `BulkPaymentModal` already supports all 4 methods

Confirmed via `METHOD_LABELS` — it's only the pre-confirm path that was missing. After B1+B2 the modal can be reused as-is from the detail page (`canPay`).

---

## 5. Stream C — Customer Account Ledger + Collections redesign

### C1. Credit orders showing on customer account *(issue #5)*

`BulkCustomerDetailPage` has a tab `ar` but we didn't read it — verify it lists all CONFIRMED/PARTIALLY_PAID orders plus payments. If the tab exists but only queries payments, extend it:

- Add backend endpoint `GET /api/bulk/customers/:id/statement` (already exists under `routes/bulk/reports.js` → `ctrl.statement`). Wire the customer detail AR tab to call `bulkService.customerStatement(id, { from, to })`.
- Show: opening balance, all credit orders (debit rows), all payments (credit rows), running balance, closing balance.
- Totals match `customer.balance` / `customer.openExposure` badges.

### C2. Collections page → supplier-accounts layout *(issue #14)*

Rewrite `BulkCollectionsPage` to mirror `SupplierAccountsPage`:

Left column (1/3):
- Search box
- List of customers with outstanding balance (`balance > 0`), showing company name + balance chip.

Right column (2/3), when a customer is selected:
- Header: customer name, phone, credit limit, open exposure.
- Tabs: "المدفوعات" / "الطلبات الآجلة" / "كشف الحساب".
- Two action buttons: **تسجيل دفعة** (opens `BulkPaymentModal` but bound to customer, not a single order — needs allocation by FIFO or order picker) and **إضافة رصيد افتتاحي** (opens `BulkOldDebtModal`, matching the supplier equivalent).

**Out of scope for this plan:** Old-debt migration for bulk customers — if the column `openingBalance` doesn't exist on `BulkCustomer`, flag it and defer to a separate spec.

---

## 6. Stream D — PDF invoice + document access

### D1. Real PDF generator *(issue #6)*

Two realistic options:

- **Option D1a (recommended): server-side PDF via `pdfkit` or `puppeteer`.**
  New endpoint `GET /api/bulk/orders/:id/invoice.pdf?type=SALES_RECEIPT|TAX_INVOICE` that streams the PDF with proper Arabic font (`Cairo-Regular.ttf`). Saves the PDF as a `BulkDocument.fileUrl` on first request, then serves cached.
- **Option D1b: client-side `react-pdf` (`@react-pdf/renderer`).**
  Generates in-browser, works offline, no server work. Larger bundle (~400 KB) but simpler to get right with RTL.

**Decision driver:** do we have printer/admin access to push `puppeteer`/Chromium onto the deployment host? If not, pick D1b.

Either way, the `طباعة` button replaces `window.print()` with `window.open(pdfBlobUrl, "_blank")` or a download.

### D2. Open documents from order detail *(issue #7)*

Currently `order.documents` is rendered but no click handler. Add a small documents card:
- List each document with `documentNumber`, `type`, `issuedAt`, and a download/preview button.
- Clicking hits `GET /api/bulk/documents/:id/file` (new route) → returns the stored PDF or regenerates on demand.
- Fallback: if no file is stored and the type is `SALES_RECEIPT` / `TAX_INVOICE`, render via D1 on the fly.

---

## 7. Stream E — UX Polish

### E1. Replace `window.confirm` / `window.prompt`

Create two tiny reusable primitives next to `Modal.jsx`:
- `ConfirmModal.jsx` — props: `open, title, message, confirmLabel, cancelLabel, tone ("danger" | "primary"), onConfirm, onClose`.
- `PromptModal.jsx` — same plus `label, placeholder, initialValue, validate(value) → error?`, returns the entered string to `onConfirm`.

Provide a `useConfirm()` / `usePrompt()` hook so callers keep the imperative feel:

```jsx
const confirm = useConfirm();
const ok = await confirm({ message: `تأكيد الطلب ${o.orderNumber}؟`, tone: "primary" });
if (!ok) return;
```

Replaces every `window.confirm` / `window.prompt` in:
- `BulkOrdersListPage.handleConfirm` / `handleCancel`
- `BulkOrderDetailPage.onConfirmCash` / `onConfirmCredit` / `onCancel` / `onVoidPayment`
- Any remaining supplier/customer pages (out of scope unless already touched).

### E2. "تغيير الحالة" button on order detail *(issue #9)*

Add a dropdown/menu button `تغيير الحالة` that exposes only *legal* transitions for the current status:

| From | Allowed → |
|---|---|
| DRAFT | QUOTED, CONFIRMED (via confirm modal), CANCELLED |
| QUOTED | DRAFT, CONFIRMED, CANCELLED |
| CONFIRMED | PARTIALLY_PAID / PAID (via payment), CANCELLED (with AR warning) |
| PARTIALLY_PAID | PAID (full payment), RETURNED |
| PAID | RETURNED |

Each selection routes to the existing action (payment modal, cancel prompt, return modal).

### E3. Action column cleanup *(issue #13)*

`BulkOrdersListPage` action cell becomes a single `Link` to `/bulk/orders/:id` rendered as an `material-icons-round` eye icon in `text-sky-600` (or existing `text-primary`). Remove `تأكيد` / `دفع` / `إلغاء` buttons from the list — all those actions now live on the detail page where their modals are available. This also makes the action column narrower and the table denser, matching issue #13 intent.

Payment / confirm / cancel stay as **row-level operations on the detail page** and via a "إجراء سريع" menu triggered from the eye icon's context (optional stretch — not required by the ticket).

---

## 8. Execution Order

Ship in thin PRs so we don't break the running app:

1. **PR 1 — Stream A (cart & pricing)**
   - Add `GET /api/bulk/items?warehouseId=…` (or on-hand field on existing list).
   - `BulkPOSPage` consumes stock, validates, adjusts steps.
   - Backend `create` honors settings tax rate.
2. **PR 2 — Stream E primitives**
   - Add `ConfirmModal`, `PromptModal`, `useConfirm`, `usePrompt`.
   - Swap all call sites. No functional change.
3. **PR 3 — Stream B (payment flow)**
   - `BulkConfirmOrderModal`.
   - Backend `confirm` accepts method / treasuryId / references.
   - POS "تأكيد" routed through the new modal.
   - Detail page "تأكيد نقدي / تأكيد آجل" routed through same modal.
4. **PR 4 — Stream E polish (#9, #13)**
   - Eye-icon action column.
   - "تغيير الحالة" menu on detail page.
5. **PR 5 — Stream C (customer account + collections)**
   - Customer AR tab uses statement endpoint.
   - `BulkCollectionsPage` rewritten to supplier-accounts layout.
6. **PR 6 — Stream D (PDF + docs)**
   - Pick D1a vs D1b, land generator.
   - Documents card on order detail.

Each PR has a hand-tested checklist (steps to reproduce the issue before / after).

---

## 9. Risks & Open Questions

- **PDF library choice** (D1): needs user input. Flag before starting PR 6.
- **`onHand` endpoint shape**: is there already a warehouse-aware inventory lookup we can reuse? If not, add minimal route; do not design a full inventory module.
- **Credit limit behavior on confirm**: if user chooses CREDIT but customer is over limit, we currently throw `CREDIT_LIMIT_EXCEEDED`. Keep that, surface it in the new confirm modal (inline red banner, not a toast).
- **Migration on `BulkCustomer.openingBalance`**: defer unless user asks for old-debt entry in collections.
- **Void-payment flow**: not in the issue list, but now uses `window.prompt` — gets swept into PR 2.

---

## 10. Acceptance Checklist (per issue)

| # | Pass when… |
|---|---|
| 1 | Catalog card is disabled at `onHand = 0`; adding 11 of an item with 10 on hand shows a toast without calling the backend |
| 2 | Order detail "تأكيد" menu offers CASH / BANK_TRANSFER / CHEQUE / CREDIT |
| 3 | Confirm modal requires picking a treasury for cash-like methods; cheque requires number+date; bank requires reference |
| 4 | Change `systemConfiguration.taxRate` from 14 to 15 → new order created from POS shows 15% on detail totals |
| 5 | Confirm an order as CREDIT → customer detail "الحساب" tab shows the debit row with matching order number |
| 6 | "طباعة" opens a real PDF (inspectable in browser PDF viewer), with proper Arabic rendering |
| 7 | Documents card lists all order documents; clicking downloads the PDF |
| 8 | No page in the bulk module calls `window.confirm`; all confirmations route through `ConfirmModal` |
| 9 | Detail page has a "تغيير الحالة" button whose options are constrained to legal transitions |
| 10 | Submitting an order with empty / negative / NaN quantity or price shows a specific Arabic error per field |
| 11 | Quantity input for a piece item has `step=1`; for a weighted item has `step=0.01` |
| 12 | No page calls `window.prompt`; void-payment and cancel-order use `PromptModal` |
| 13 | Orders list action cell has only one control: a blue eye-icon link to the detail page |
| 14 | `/bulk/collections` layout visually mirrors `/supplier-accounts` (two-pane list + detail) |
| 15 | Clicking "تأكيد" in POS opens the confirm modal first; nothing is written until the modal is submitted |

---

*End of plan.*
