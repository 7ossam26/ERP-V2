# Bulk POS — Design Doc, Decision Log & Implementation Plan

**Status:** Locked — ready to implement
**Date:** 2026-04-20
**Owner:** Tech lead (user), Implementation (Claude)
**Predecessors:** [bulk-pos-brainstorming.md](bulk-pos-brainstorming.md) · [bulk-pos-understanding-lock.md](bulk-pos-understanding-lock.md) · [bulk-pos-design-approaches.md](bulk-pos-design-approaches.md)

---

## 1. Executive Summary

A new B2B wholesale module (`BULK_POS`) alongside retail POS and Call Center. Dedicated data model (`BulkCustomer`, `BulkOrder`, `BulkOrderItem`, `BulkContractPrice`, `BulkPayment`), contract-price overrides per customer, full AR tracking with credit limits, tax-inclusive pricing, formal tax invoices when a customer has a tax number, customer-pickup fulfillment only, independent of cashier shifts. Arabic-first RTL, desktop/tablet/phone parity.

**Volume target:** ~5 orders/day, 2 concurrent reps, ~10 lines/order, max ~2M EGP.

---

## 2. Decision Log

### 2.1 From the questionnaire (locked)

| # | Decision |
|---|---|
| Role | New module `BULK_POS`, granular permissions via superadmin dashboard |
| Visibility | All reps see all bulk orders company-wide |
| Approvals | None — reps act freely |
| Customer model | Dedicated `BulkCustomer` (not extending `Client`) |
| Customer fields | Company/trade name, tax# (optional), primary contact, secondary contacts, shipping address, credit limit |
| Addresses | One shipping address per customer; billing = shipping |
| Customer entry | Manual only (no CSV in v1) |
| Pricing | Per-customer contract price list + free inline rep override |
| Cost visibility | Hidden from reps |
| Discounts | **None** — no discount UI at all |
| Tax | Inclusive prices; invoice shows net / VAT / total breakdown |
| Tax invoice | Issued only when customer has tax# |
| Invoice numbering | Separate series, global counter, `BULK-0001` format |
| Payment methods | Cash, bank transfer (ref), cheque (# + due date), credit (deferred), split/partial |
| AR tracking | Full — aging + statement of account |
| Treasury | Rep picks treasury per payment |
| Credit limit | Nullable per customer; **unset = unlimited**; when set = **hard block** on new credit orders exceeding limit |
| Stock | Rep picks source warehouse; one warehouse per order; deducts at `CONFIRMED`; **block backorders** |
| Shifts | Bulk runs independently; excluded from shift reconciliation |
| Fulfillment | Customer pickup only; freight billed separately; optional scheduled pickup date; no multi-drop |
| Documents | Proforma (draft/quote), Tax Invoice (confirmed + tax#), Sales Receipt (confirmed, no tax#), Credit Note (refund) — A4 PDF, reuse `PrintTicket` header |
| Lifecycle | `DRAFT → (QUOTED) → CONFIRMED → PAID/PARTIALLY_PAID` + `CANCELLED, RETURNED` |
| Edits | Not editable post-creation |
| Cancel | **Only before CONFIRMED** (DRAFT/QUOTED); no approval; no stock reversal needed |
| Post-CONFIRMED unwind | Refund/credit-note/return path only; rep picks cash refund vs. credit note per refund |
| Reports | Excluded from existing Sales Report; new reports: bulk sales by customer, AR aging, statement of account |
| UX | POS-style clone (catalog left, cart right); Arabic-first RTL; desktop/tablet/phone parity; online-only |
| Rollout | Phased (1: customers + pricing + orders + receipt, 2: quote + tax invoice + credit note + AR, 3: reports); greenfield |

### 2.2 From Step 2 approaches (all recommended options accepted)

| # | Decision | Choice |
|---|---|---|
| D1 | Storage model | **New `BulkOrder` + `BulkOrderItem`** tables (not extending `Sale`) |
| D2 | Quote → Order | **Same row, status flip** (no separate Quote table) |
| D3 | Contract price shape | **Normalized `BulkContractPrice(customerId, itemId, price)` table** |
| D4 | AR ledger | **Derive on the fly** (no materialized `CustomerLedger`) |

---

## 3. Data Model

### 3.1 New Prisma enums

```prisma
enum BulkOrderStatus {
  DRAFT
  QUOTED
  CONFIRMED
  PARTIALLY_PAID
  PAID
  CANCELLED
  RETURNED
}

enum BulkPaymentMethod {
  CASH
  BANK_TRANSFER
  CHEQUE
  CREDIT           // deferred — no cash movement at this time
}

enum BulkRefundMethod {
  CASH_REFUND
  CREDIT_NOTE
}

enum BulkDocumentType {
  PROFORMA
  TAX_INVOICE
  SALES_RECEIPT
  CREDIT_NOTE
}

// Extend the existing Module enum
enum Module {
  // ... existing values ...
  BULK_POS
  BULK_CUSTOMERS
  BULK_PRICING
  BULK_CREDIT
  BULK_REPORTS
}
```

### 3.2 `BulkCustomer`

```prisma
model BulkCustomer {
  id               Int       @id @default(autoincrement())
  companyName      String    @map("company_name") @db.VarChar(200)
  tradeName        String?   @map("trade_name") @db.VarChar(200)
  taxNumber        String?   @unique @map("tax_number") @db.VarChar(50)
  primaryContactName   String  @map("primary_contact_name") @db.VarChar(120)
  primaryContactPhone  String  @map("primary_contact_phone") @db.VarChar(40)
  primaryContactEmail  String? @map("primary_contact_email") @db.VarChar(120)
  shippingAddress  String    @map("shipping_address") @db.Text
  creditLimit      Decimal?  @map("credit_limit") @db.Decimal(12, 2)   // NULL = unlimited
  notes            String?   @db.Text
  isActive         Boolean   @default(true) @map("is_active")
  createdByUserId  Int?      @map("created_by_user_id")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  createdBy        User?                  @relation("BulkCustomerCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  contacts         BulkCustomerContact[]
  contractPrices   BulkContractPrice[]
  orders           BulkOrder[]
  payments         BulkPayment[]

  @@index([companyName])
  @@index([primaryContactPhone])
  @@map("bulk_customers")
}

model BulkCustomerContact {
  id          Int     @id @default(autoincrement())
  customerId  Int     @map("customer_id")
  name        String  @db.VarChar(120)
  phone       String  @db.VarChar(40)
  email       String? @db.VarChar(120)
  role        String? @db.VarChar(60)   // "buyer", "accountant", etc.

  customer    BulkCustomer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId])
  @@map("bulk_customer_contacts")
}
```

### 3.3 `BulkContractPrice`

```prisma
model BulkContractPrice {
  id           Int      @id @default(autoincrement())
  customerId   Int      @map("customer_id")
  itemId       Int      @map("item_id")
  price        Decimal  @db.Decimal(10, 2)     // tax-inclusive
  createdByUserId Int?  @map("created_by_user_id")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  customer     BulkCustomer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  item         Item         @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdBy    User?        @relation("BulkContractPriceCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@unique([customerId, itemId])
  @@index([itemId])
  @@map("bulk_contract_prices")
}
```

### 3.4 `BulkOrder` + `BulkOrderItem`

```prisma
model BulkOrder {
  id                 Int              @id @default(autoincrement())
  orderNumber        String           @unique @map("order_number")   // "BULK-0001"
  customerId         Int              @map("customer_id")
  warehouseId        Int              @map("warehouse_id")
  createdByUserId    Int              @map("created_by_user_id")
  status             BulkOrderStatus  @default(DRAFT)

  // Pricing (tax-inclusive storage)
  subtotalInclusive  Decimal          @map("subtotal_inclusive") @db.Decimal(12, 2)  // sum of line totals (incl VAT)
  taxRate            Decimal          @default(0.14) @map("tax_rate") @db.Decimal(5, 4)
  netAmount          Decimal          @map("net_amount") @db.Decimal(12, 2)           // subtotal / (1 + rate)
  taxAmount          Decimal          @map("tax_amount") @db.Decimal(12, 2)           // subtotal - net
  total              Decimal          @db.Decimal(12, 2)                              // == subtotalInclusive in v1 (no discount, no freight)

  // Payment rollups (derived via triggers-in-code on payment create/void)
  paidAmount         Decimal          @default(0) @map("paid_amount") @db.Decimal(12, 2)
  balanceDue         Decimal          @map("balance_due") @db.Decimal(12, 2)          // total - paidAmount

  // Lifecycle timestamps
  scheduledPickupDate DateTime?       @map("scheduled_pickup_date")
  confirmedAt        DateTime?        @map("confirmed_at")
  paidAt             DateTime?        @map("paid_at")
  cancelledAt        DateTime?        @map("cancelled_at")
  cancelledByUserId  Int?             @map("cancelled_by_user_id")
  cancelReason       String?          @map("cancel_reason") @db.Text
  returnedAt         DateTime?        @map("returned_at")

  notes              String?          @db.Text
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  customer     BulkCustomer   @relation(fields: [customerId], references: [id], onDelete: Restrict)
  warehouse    Warehouse      @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  createdBy    User           @relation("BulkOrderCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  cancelledBy  User?          @relation("BulkOrderCanceller", fields: [cancelledByUserId], references: [id], onDelete: SetNull)
  items        BulkOrderItem[]
  payments     BulkPayment[]
  refunds      BulkRefund[]
  documents    BulkDocument[]

  @@index([customerId, status])
  @@index([status, createdAt])
  @@map("bulk_orders")
}

model BulkOrderItem {
  id            Int      @id @default(autoincrement())
  orderId       Int      @map("order_id")
  itemId        Int      @map("item_id")
  quantity      Decimal  @db.Decimal(12, 4)
  unitPrice     Decimal  @map("unit_price") @db.Decimal(10, 2)   // tax-inclusive at time of sale
  lineTotal     Decimal  @map("line_total") @db.Decimal(12, 2)

  order         BulkOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  item          Item      @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([orderId])
  @@map("bulk_order_items")
}
```

### 3.5 `BulkPayment` + `BulkRefund`

```prisma
model BulkPayment {
  id             Int                @id @default(autoincrement())
  orderId        Int                @map("order_id")
  customerId     Int                @map("customer_id")
  treasuryId     Int?               @map("treasury_id")        // null for CREDIT
  method         BulkPaymentMethod
  amount         Decimal            @db.Decimal(12, 2)
  receivedAt     DateTime           @default(now()) @map("received_at")
  createdByUserId Int               @map("created_by_user_id")

  // Method-specific fields
  bankReference  String?            @map("bank_reference") @db.VarChar(120)
  chequeNumber   String?            @map("cheque_number") @db.VarChar(60)
  chequeDueDate  DateTime?          @map("cheque_due_date")

  voidedAt       DateTime?          @map("voided_at")
  voidedByUserId Int?               @map("voided_by_user_id")
  voidReason     String?            @map("void_reason") @db.Text

  notes          String?            @db.Text

  order          BulkOrder          @relation(fields: [orderId], references: [id], onDelete: Restrict)
  customer       BulkCustomer       @relation(fields: [customerId], references: [id], onDelete: Restrict)
  treasury       Treasury?          @relation("BulkPaymentTreasury", fields: [treasuryId], references: [id], onDelete: Restrict)
  createdBy      User               @relation("BulkPaymentCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  voidedBy       User?              @relation("BulkPaymentVoider", fields: [voidedByUserId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([customerId, receivedAt])
  @@map("bulk_payments")
}

model BulkRefund {
  id             Int              @id @default(autoincrement())
  orderId        Int              @map("order_id")
  method         BulkRefundMethod
  amount         Decimal          @db.Decimal(12, 2)
  reason         String?          @db.Text
  treasuryId     Int?             @map("treasury_id")   // null for CREDIT_NOTE
  creditNoteNumber String?        @unique @map("credit_note_number")  // "BULK-CN-0001"
  createdByUserId Int             @map("created_by_user_id")
  createdAt      DateTime         @default(now()) @map("created_at")

  order          BulkOrder        @relation(fields: [orderId], references: [id], onDelete: Restrict)
  treasury       Treasury?        @relation("BulkRefundTreasury", fields: [treasuryId], references: [id], onDelete: Restrict)
  createdBy      User             @relation("BulkRefundCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)

  @@index([orderId])
  @@map("bulk_refunds")
}
```

### 3.6 `BulkDocument` (numbered document ledger)

```prisma
model BulkDocument {
  id              Int               @id @default(autoincrement())
  orderId         Int               @map("order_id")
  type            BulkDocumentType
  documentNumber  String            @unique @map("document_number")   // "BULK-0001", "BULK-TAX-0001", "BULK-CN-0001"
  issuedAt        DateTime          @default(now()) @map("issued_at")
  issuedByUserId  Int               @map("issued_by_user_id")
  pdfSnapshot     Json?             @map("pdf_snapshot")   // freeze amounts/lines at issue time

  order           BulkOrder         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  issuedBy        User              @relation("BulkDocumentIssuer", fields: [issuedByUserId], references: [id], onDelete: Restrict)

  @@index([orderId, type])
  @@map("bulk_documents")
}
```

### 3.7 Numbering series

Add rows to existing system config / dedicated table for atomic counter:

```prisma
model BulkNumberSequence {
  key        String   @id                     // "ORDER", "TAX_INVOICE", "CREDIT_NOTE"
  nextValue  Int      @default(1) @map("next_value")
  prefix     String   @db.VarChar(20)         // "BULK-", "BULK-TAX-", "BULK-CN-"
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("bulk_number_sequences")
}
```

Allocation is done inside a transaction with `SELECT … FOR UPDATE` semantics (Prisma: `$transaction` + raw `SELECT ... FOR UPDATE` or use a unique index + retry loop).

### 3.8 Touch points on existing models

- **`User`** — add back-relations for `BulkCustomerCreator`, `BulkContractPriceCreator`, `BulkOrderCreator`, `BulkOrderCanceller`, `BulkPaymentCreator`, `BulkPaymentVoider`, `BulkRefundCreator`, `BulkDocumentIssuer`.
- **`Item`** — add `bulkContractPrices BulkContractPrice[]` and `bulkOrderItems BulkOrderItem[]` back-relations.
- **`Warehouse`** — add `bulkOrders BulkOrder[]`.
- **`Treasury`** — add `bulkPayments BulkPayment[] @relation("BulkPaymentTreasury")` and `bulkRefunds BulkRefund[] @relation("BulkRefundTreasury")`.
- **`Module` enum** — append `BULK_POS, BULK_CUSTOMERS, BULK_PRICING, BULK_CREDIT, BULK_REPORTS`.
- **No changes to `Sale`/`SaleItem`.** Bulk is a separate pipeline end-to-end.

### 3.9 Stock movement integration

Reuse the existing stock-movement function that `Sale` uses. Invoke it at:
- `CONFIRMED` — deduct each line's `quantity` from `warehouseId`, ref = `BULK_ORDER:{id}`.
- `RETURNED` — reverse the deduction (credit warehouse), ref = `BULK_RETURN:{id}`.

Extract a helper `applyBulkOrderStockMovement(tx, order, direction)` in `backend/services/bulkStock.service.js` that wraps the existing primitive.

---

## 4. Backend Architecture

### 4.1 Directory layout

```
backend/
  controllers/
    bulk/
      bulkCustomer.controller.js
      bulkContractPrice.controller.js
      bulkOrder.controller.js
      bulkPayment.controller.js
      bulkRefund.controller.js
      bulkReport.controller.js
      bulkDocument.controller.js      // proforma/tax-invoice/credit-note PDFs
  routes/
    bulk/
      index.js                         // mounts all below under /api/bulk
      customers.js
      pricing.js
      orders.js
      payments.js
      refunds.js
      reports.js
      documents.js
  services/
    bulkStock.service.js              // stock hooks
    bulkNumbering.service.js          // atomic counter allocation
    bulkCredit.service.js             // open-balance + credit-limit check
    bulkPricing.service.js            // resolve contract price for (customer, item)
  middleware/
    requireModule.js                  // reused: enforce BULK_POS / BULK_* perms
  tests/bulk/
    ...
```

### 4.2 Authorization middleware

Each route asserts the right permission via `requireModule(Module.BULK_POS)` / `requireModule(Module.BULK_CUSTOMERS)` / etc. Permissions are wired to roles from the superadmin dashboard (existing RBAC).

### 4.3 Key endpoints (REST)

```
# Customers
GET    /api/bulk/customers                         — list (search by name/phone/tax#)
GET    /api/bulk/customers/:id                     — detail + aggregate (open balance, contact list)
POST   /api/bulk/customers                         — create
PATCH  /api/bulk/customers/:id                     — update
POST   /api/bulk/customers/:id/contacts            — add secondary contact
DELETE /api/bulk/customers/:id/contacts/:contactId — remove secondary contact

# Contract pricing
GET    /api/bulk/customers/:id/prices              — list overrides
PUT    /api/bulk/customers/:id/prices              — bulk upsert { itemId, price }[]
DELETE /api/bulk/customers/:id/prices/:priceId     — remove override

# Orders
GET    /api/bulk/orders                            — list with filters (status, customer, date)
GET    /api/bulk/orders/:id                        — detail
POST   /api/bulk/orders                            — create (status=DRAFT or QUOTED)
POST   /api/bulk/orders/:id/confirm                — DRAFT/QUOTED → CONFIRMED (stock deduct, credit check, allocate BULK-NNNN, issue doc)
POST   /api/bulk/orders/:id/cancel                 — DRAFT/QUOTED → CANCELLED (reason required)
POST   /api/bulk/orders/:id/return                 — CONFIRMED/PAID → RETURNED (creates BulkRefund)

# Payments
POST   /api/bulk/orders/:id/payments               — record payment (updates paidAmount, balanceDue, status)
POST   /api/bulk/payments/:id/void                 — void payment (reason required)
GET    /api/bulk/customers/:id/payments            — list

# Documents (PDF)
GET    /api/bulk/orders/:id/proforma.pdf
GET    /api/bulk/orders/:id/tax-invoice.pdf
GET    /api/bulk/orders/:id/sales-receipt.pdf
GET    /api/bulk/refunds/:id/credit-note.pdf

# Reports
GET    /api/bulk/reports/sales-by-customer?from=&to=
GET    /api/bulk/reports/ar-aging
GET    /api/bulk/reports/statement?customerId=&from=&to=
```

### 4.4 Confirm-order transaction (the critical path)

```
BEGIN
  SELECT order FOR UPDATE WHERE id=? AND status IN ('DRAFT','QUOTED')
  For each line:
    check inventory for (warehouseId, itemId) — reject if any line > available
  If (paymentMethod will be CREDIT or partial credit) and customer.creditLimit is set:
    openBalance = SUM(orders.total WHERE status IN (CONFIRMED, PARTIALLY_PAID))
                - SUM(payments.amount WHERE voidedAt IS NULL)
                + orders.total of this order (projected)
    reject if openBalance > creditLimit
  allocateNumber('ORDER') → "BULK-NNNN"
  Update order: status=CONFIRMED, confirmedAt=now, orderNumber=...
  applyBulkOrderStockMovement(tx, order, 'DEBIT')
  Issue document:
    if customer.taxNumber → TAX_INVOICE (BULK-TAX-NNNN)
    else → SALES_RECEIPT (BULK-RCP-NNNN)
COMMIT
```

### 4.5 Credit limit check (`bulkCredit.service.js`)

```js
export async function getOpenBalance(tx, customerId) {
  const [orders, payments, refunds] = await Promise.all([...]);
  // sum of non-cancelled, non-returned order totals
  // minus sum of non-voided payments
  // minus sum of CASH_REFUND refund amounts (credit notes reduce it too since they cancel receivable)
  return Math.max(0, ordersSum - paymentsSum - refundsSum);
}

export async function assertCreditLimitOk(tx, customer, projectedOrderTotal) {
  if (customer.creditLimit == null) return;   // unlimited
  const open = await getOpenBalance(tx, customer.id);
  if (open + projectedOrderTotal > customer.creditLimit) {
    throw new HttpError(409, 'CREDIT_LIMIT_EXCEEDED', { open, limit: customer.creditLimit });
  }
}
```

Projected order total is checked only for CREDIT-bearing confirmations (full-cash orders don't add to AR). For mixed/partial, include the unpaid portion.

### 4.6 Contract price resolution (`bulkPricing.service.js`)

```js
export async function resolvePrice(tx, customerId, itemId) {
  const override = await tx.bulkContractPrice.findUnique({
    where: { customerId_itemId: { customerId, itemId } },
  });
  if (override) return { price: override.price, source: 'CONTRACT' };
  const item = await tx.item.findUnique({ where: { id: itemId }, select: { price: true } });
  return { price: item.price, source: 'BASE' };
}
```

Rep can override the suggested price at line level — server accepts whatever price is sent but records `unitPrice` on the line.

### 4.7 Tax breakdown (inclusive → net + VAT)

```js
function splitInclusive(inclusive, rate) {
  const net = round2(inclusive / (1 + rate));
  const tax = round2(inclusive - net);
  return { net, tax };
}
```

Stored on the order: `subtotalInclusive`, `netAmount`, `taxAmount`, `total` (= subtotalInclusive in v1 — no freight, no discount).

### 4.8 PDF generation

Reuse existing PDF generator (whatever currently powers `PrintTicket`). New module-local template `backend/services/bulkDocumentPdf.service.js` produces:
- Header (reused from `PrintTicket`)
- Customer block (company, tax#, address)
- Document number + type + date
- Line table (SKU, name, qty, unit price incl VAT, line total)
- Totals block (net, VAT, total)
- Payment status footer
- A4 portrait

### 4.9 Validation rules (summary)

| Endpoint | Rule |
|---|---|
| POST `/customers` | `companyName` required; `taxNumber` unique if set |
| POST `/orders` | ≥1 line; `customerId`, `warehouseId` required; no discount fields accepted |
| POST `/orders/:id/confirm` | status in `DRAFT`/`QUOTED`; stock check; credit check; atomic |
| POST `/orders/:id/cancel` | status in `DRAFT`/`QUOTED`; reject otherwise |
| POST `/orders/:id/return` | status in `CONFIRMED`/`PARTIALLY_PAID`/`PAID`; must create matching `BulkRefund` |
| POST `/payments` | order status not `CANCELLED`/`RETURNED`; `amount > 0`; `amount ≤ balanceDue`; method-specific fields required |

### 4.10 Audit

Every state-changing endpoint writes to the existing `AuditLog` table with `targetEntity = 'BulkOrder' / 'BulkCustomer' / 'BulkPayment' / ...`, capturing old/new values. Cancel and void carry the user-provided reason in `details`.

---

## 5. Frontend Architecture

### 5.1 Directory layout

```
frontend/src/
  pages/bulk/
    BulkPOSPage.jsx                  // main sales screen (POS-style clone)
    BulkOrdersListPage.jsx           // all orders grid + filters
    BulkOrderDetailPage.jsx          // single order view + payments + documents
    BulkCustomersListPage.jsx
    BulkCustomerDetailPage.jsx       // profile + contract prices + AR tab
    BulkCollectionsPage.jsx          // record payments screen
    BulkReportsPage.jsx
  components/bulk/
    BulkCustomerPicker.jsx           // search-by-phone/tax#/name
    BulkCatalogGrid.jsx              // item grid with contract price badge
    BulkCartPanel.jsx                // lines, totals breakdown
    BulkTotalsBreakdown.jsx          // net / VAT / total rows
    BulkWarehousePicker.jsx
    BulkPaymentModal.jsx             // cash / bank / cheque / credit / split
    BulkContractPriceEditor.jsx
    BulkCreditBadge.jsx              // "open: X, limit: Y" pill
    BulkDocumentLinks.jsx            // buttons: proforma, invoice, receipt PDFs
    BulkReturnModal.jsx              // pick cash refund vs credit note
    BulkARAgingTable.jsx
    BulkStatementTable.jsx
  api/bulk.js                        // axios module
  utils/bulkMoney.js                 // splitInclusive, formatEGP
```

### 5.2 Routing

Add under `AppRoutes.jsx` (or equivalent):
```
/bulk/pos             → BulkPOSPage
/bulk/orders          → BulkOrdersListPage
/bulk/orders/:id      → BulkOrderDetailPage
/bulk/customers       → BulkCustomersListPage
/bulk/customers/:id   → BulkCustomerDetailPage
/bulk/collections     → BulkCollectionsPage
/bulk/reports         → BulkReportsPage
```

All behind a `<RequireModule module="BULK_POS">` gate (or per-page module gate for finer control).

### 5.3 Layout language

Same visual system as `POSPage.jsx`: catalog grid left, cart right, total summary at bottom-right. Arabic-first RTL, already-supported. Tablet/phone: catalog becomes a drawer below the cart on narrow viewports (responsive breakpoint ~768px).

### 5.4 Sales screen flow

1. Rep picks customer (`BulkCustomerPicker`) → customer loads, contract prices hydrate into catalog. Credit badge shows current open balance vs. limit.
2. Rep picks warehouse (`BulkWarehousePicker`).
3. Rep adds items → cart lines appear. Each line: qty + unit price (pre-filled from contract price, editable).
4. Totals panel shows: subtotal (incl VAT), net, VAT, total.
5. "Save as Draft" / "Save as Quote" / "Confirm Sale" actions.
6. "Confirm Sale" → open `BulkPaymentModal` (method, amount, treasury). Credit check happens server-side; failure shows "Credit limit exceeded" with projected/open/limit numbers.
7. On success, navigate to `BulkOrderDetailPage` with download buttons for the appropriate document.

### 5.5 Customer detail page

Tabs:
- **Profile** — fields + secondary contacts
- **Contract prices** — table of item/price, inline edit, bulk upsert
- **Orders** — list filtered to this customer
- **AR** — open balance, aging buckets, payment history, "Record payment" button

### 5.6 Reports

`BulkReportsPage` sub-tabs: **Sales by customer**, **AR aging**, **Statement of account** (customer picker + date range).

### 5.7 Print flow

Every document button hits its `GET /…/*.pdf` endpoint → opens in a new tab with the browser's native PDF viewer. No in-app receipt printer integration in v1 (matches the "A4 PDF only" decision).

---

## 6. Edge Cases & Invariants

| Case | Behavior |
|---|---|
| Confirm when a line goes out of stock mid-DRAFT | Reject at confirm time (`INSUFFICIENT_STOCK`, lists offending lines) |
| Customer has no contract price for item | Fall back to `item.price` (base) |
| Rep sets unit price to 0 | Allowed (promotional/giveaway); server warns but accepts |
| Rep sets unit price below cost | Allowed (cost is hidden); no warning |
| Confirm exceeds credit limit (credit-bearing portion) | Reject with `CREDIT_LIMIT_EXCEEDED` detail |
| Unlimited customer (`creditLimit` null) | Skip check entirely |
| Cancel a CONFIRMED order | Reject — client routes user to return flow instead |
| Void the only payment of a PAID order | Order status reverts to `PARTIALLY_PAID` or `CONFIRMED` based on remaining sum |
| Return while balance still open | Refund may be full or partial; if CREDIT_NOTE, reduces open balance; if CASH_REFUND, pays out from treasury |
| Return 100% of an unpaid order | Treat as functional cancel-post-confirm: stock reversed, status → RETURNED, balance zeroed via credit note |
| Rep overrides a contract price at line level | Line stores the overridden price; the contract price row is NOT mutated |
| Delete a contract price row | Doesn't affect past orders (they stored their `unitPrice`) |
| Cheque with future due date | Payment recorded immediately; balance-due reduced immediately (aging treats by `receivedAt`, NOT `chequeDueDate`; if bounce reconciliation is needed later, use `voidPayment`) |
| Mobile viewport | Catalog collapses to a bottom drawer; totals panel sticky |

---

## 7. Test Plan

### 7.1 Backend (Jest, `backend/tests/bulk/`)

- `bulkCustomer.spec.js` — CRUD, unique tax#, contact add/remove.
- `bulkContractPrice.spec.js` — upsert, delete, unique (customer, item).
- `bulkPricing.service.spec.js` — resolves override first, falls back to base.
- `bulkOrder.spec.js`
  - Create DRAFT/QUOTED orders with lines.
  - Confirm happy path: stock deducted, number allocated, document issued.
  - Confirm rejected: insufficient stock, exceeds credit limit.
  - Cancel DRAFT/QUOTED OK; cancel CONFIRMED rejected.
  - Return CONFIRMED/PAID: stock reversed, refund row created.
- `bulkPayment.spec.js` — record payment updates paid/balance/status. Void reverts. Over-pay rejected.
- `bulkCredit.service.spec.js` — open-balance math correct across orders/payments/refunds. Unlimited customer passes.
- `bulkNumbering.service.spec.js` — concurrent allocation doesn't duplicate (spawn 10 simultaneous transactions).
- `bulkReport.controller.spec.js` — aging buckets correct; statement ordering; filter by date.

### 7.2 Frontend (manual smoke on dev server)

- Create customer → appears in picker.
- Set contract prices → catalog badge reflects override.
- Build order with override + manual override → totals breakdown correct (net/VAT/total).
- Save as draft → reopens with same state.
- Confirm with cash → order PAID, receipt PDF downloads.
- Confirm with credit → status CONFIRMED, AR balance updates.
- Cancel DRAFT → cleared.
- Try cancel CONFIRMED → button absent/disabled; return modal is the only option.
- Record payment against CONFIRMED → status flips to PAID when balance zeroed.
- Void payment → status reverts.
- Return order partial → refund created, credit note PDF downloads.
- Credit limit block → confirmation rejected with readable error.
- Mobile viewport — full flow works.

### 7.3 RTL / Arabic

- All labels translated.
- Numbers use Arabic-Indic digits or Western? → match the rest of the app.
- Invoice PDFs render with Arabic text + numeric amounts correctly.

---

## 8. Implementation Plan (Phased)

### Phase 1 — Foundation (customers + pricing + orders + receipt)

**Backend**
1. Prisma migration: new enums, `BulkCustomer`, `BulkCustomerContact`, `BulkContractPrice`, `BulkOrder`, `BulkOrderItem`, `BulkNumberSequence`, Module enum extension. Seed sequences.
2. Services: `bulkNumbering`, `bulkPricing`, `bulkStock`.
3. Controllers + routes: `bulkCustomer`, `bulkContractPrice`, `bulkOrder` (create/list/get/confirm/cancel).
4. Confirm transaction with stock deduction and document issuance (SALES_RECEIPT only — tax invoice deferred to Phase 2).
5. `BulkDocument` records + sales-receipt PDF endpoint.
6. Jest tests for all of the above.

**Frontend**
7. Axios module `api/bulk.js`.
8. Module gate + routing scaffolding.
9. `BulkCustomersListPage` + `BulkCustomerDetailPage` (Profile tab only in this phase).
10. `BulkContractPriceEditor` inside customer detail.
11. `BulkPOSPage` MVP: picker + catalog + cart + totals + "Confirm Sale" (cash only).
12. `BulkOrdersListPage` + `BulkOrderDetailPage` (documents tab = receipt download).

**Gate for Phase 2:** end-to-end cash sale with contract pricing works in dev.

### Phase 2 — Quotes + tax invoice + credit + returns

**Backend**
13. Quote status support on `BulkOrder` (already in enum; endpoint passes `status=QUOTED` on create).
14. Tax invoice PDF (branches on `customer.taxNumber`).
15. `BulkPayment` controller + routes; `BulkRefund` controller + routes.
16. `bulkCredit` service + credit-limit enforcement in confirm + payment endpoints.
17. Void-payment + return endpoints with proper status transitions.
18. Credit note PDF.

**Frontend**
19. "Save as Quote" action + Proforma PDF download on draft/quote.
20. `BulkPaymentModal` (cash/bank/cheque/credit/split).
21. Customer detail **AR tab** + `BulkCollectionsPage`.
22. `BulkReturnModal` (cash refund vs credit note).
23. Credit-limit UI feedback (badge on customer, blocking error on confirm).

**Gate for Phase 3:** full order lifecycle + AR tracking works.

### Phase 3 — Reports

**Backend**
24. `bulkReport.controller.js`: sales by customer, AR aging, statement of account endpoints.

**Frontend**
25. `BulkReportsPage` with three sub-tabs.
26. Export-to-PDF buttons for each report (reuse A4 renderer).

**Gate for done:** manual QA checklist green on all three flows across desktop/tablet/phone.

### Post-v1 (not in scope)

- CSV imports for customers and contract prices.
- Tiered price lists (D3 Option C path).
- Materialized ledger (D4 Option B path).
- Multi-warehouse split fulfillment.
- Recurring orders / subscriptions.
- Multi-currency.
- Offline mode.

---

## 9. Files Touched (expected)

**Schema / DB**
- `backend/prisma/schema.prisma` — new models, new enums, Module extension
- `backend/prisma/migrations/<timestamp>_add_bulk_pos/migration.sql`
- `backend/prisma/seed.js` — seed `BulkNumberSequence` keys

**Backend**
- `backend/controllers/bulk/*.js` (new)
- `backend/routes/bulk/*.js` (new) + registration in `backend/server.js`
- `backend/services/bulk*.service.js` (new)
- `backend/tests/bulk/*.spec.js` (new)

**Frontend**
- `frontend/src/pages/bulk/*.jsx` (new)
- `frontend/src/components/bulk/*.jsx` (new)
- `frontend/src/api/bulk.js` (new)
- `frontend/src/utils/bulkMoney.js` (new)
- `frontend/src/routes/*.jsx` — add bulk routes + module gates
- `frontend/src/pages/Dashboard/Sidebar.jsx` (or equivalent) — add Bulk POS menu items

**No changes needed to** `Sale`, `SaleItem`, `POSPage.jsx`, `CallCenterNewOrderPage.jsx`, `PrintTicket.jsx` (only referenced for header reuse — not modified).

---

## 10. Open questions (non-blocking)

These do not block starting Phase 1. Flag if you want them answered before I begin:

1. **PDF generator** — which library does the app currently use for `PrintTicket`? (Puppeteer, pdfkit, pdfmake, @react-pdf/renderer?) I'll match it.
2. **Invoice header logo / legal footer** — pull from `SystemConfiguration` or separate bulk config?
3. **Aging bucket cutoffs** — use the conventional 0-30 / 31-60 / 61-90 / 90+? Or a custom scheme?
4. **Cheque bounce handling** — v1 uses `voidPayment` as the mechanism. Good enough for now, or do you want an explicit "bounced cheque" workflow later?

Defaults I'll assume if you don't answer: (1) match existing, (2) `SystemConfiguration`, (3) conventional buckets, (4) `voidPayment` only in v1.

---

## 11. Sign-off & next action

If this doc is good, reply **"go Phase 1"** and I'll start with the Prisma migration + `BulkCustomer`/`BulkContractPrice` backend + frontend customers page (the first vertical slice). I'll keep phases in separate PRs per your rollout decision.
