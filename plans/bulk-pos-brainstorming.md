# Bulk POS (Wholesale / B2B) — Brainstorming Questionnaire

> **Instructions:** For each question, put an **X** next to your chosen option (e.g. `[X] A`) or write free text where asked. Skip nothing — if unsure, pick "not sure / please recommend" and I'll propose a default with tradeoffs.
>
> When done, save and send back. I'll produce the Understanding Lock → Design Doc → Implementation Plan.
>
> **Context:** we already have retail `POSPage`, `CallCenterNewOrderPage`, and a unified `Sale` model (with discount, tax, delivery, shift coupling). This questionnaire is about a **new module** for bulk / wholesale / B2B orders with bulk customers — not to be confused with retail POS or call-center delivery orders.

---

## SECTION 1 — Purpose & Positioning (foundational)

### Q1. What does "bulk" mean here — what problem are we solving that retail POS can't?

- [ ] A — **Wholesale / B2B** — selling to other businesses (restaurants, shops, resellers) at wholesale prices, with invoices and often credit terms.
- [ ] B — **Large-qty retail** — same customers as retail POS but very large quantities (e.g., event catering, corporate orders) at ad-hoc negotiated prices.
- [ ] C — **Distributor model** — dedicated clients with contracts, price lists, and recurring orders.
- [x] D — **All of the above** — one module covers B2B, large-qty, and distributors.
- [ ] E — Other: **\_\_**

---

### Q2. Is this a **separate module** or an **extension of existing POS**?

- [x] A — **New standalone module** (`BULK_POS` / `WHOLESALE`) with its own page, own role, own reports.
- [ ] B — **Toggle inside existing POS** — same page, a "Bulk Mode" switch changes pricing/behavior.
- [ ] C — **New module that reuses POS components** (cart, catalog) but lives on a separate route and has its own permissions.
- [ ] D — Not sure / recommend the best trade-off.

---

### Q3. Who is the actor using this module?

- [ ] A — The same cashier using retail POS (same user, different screen).
- [ ] B — A dedicated **Wholesale/Sales-Rep** role (new role, separate login).
- [ ] C — Branch manager only.
- [ ] D — Call-center agents also (they can create bulk orders for B2B clients).
- [x] E — Other: Let me decide from super admin dashboared

---

## SECTION 2 — Bulk Customer Model

### Q4. Do bulk customers live in the **same `Client` table** as retail clients, or a separate entity?

- [ ] A — Same `Client` table, flagged with `type = BULK | RETAIL`.
- [x] B — New separate `BulkCustomer` / `Company` model with company-specific fields (tax ID, commercial reg, contact persons).
- [ ] C — Same table + a 1-to-1 `BulkCustomerProfile` extension for B2B-only fields.
- [ ] D — Not sure / recommend default.

---

### Q5. Required fields for a bulk customer (check all that apply)

- [x] Company / trade name
- [ ] Legal name (if different)
- [x] Tax / VAT registration number
- [ ] Commercial registration number
- [x] Primary contact person (name, phone)
- [x] Secondary contact(s) (optional)
- [ ] Billing address
- [x] Shipping address(es)
- [ ] Industry / segment (restaurant, cafe, reseller, etc.)
- [x] Credit limit
- [ ] Default payment terms (Net-7 / Net-15 / Net-30 / COD)
- [ ] Assigned sales rep / account manager
- [ ] Default price tier
- [ ] Discount ceiling (max allowed %)
- [ ] Notes
- [ ] Other: **\_\_**

---

### Q6. Multiple shipping / delivery addresses per bulk customer?

- [x] A — One address only (billing = shipping).
- [ ] B — Separate billing vs shipping, one of each.
- [ ] C — Multiple saved shipping addresses (pick one per order).
- [ ] D — Free-text per order, not saved.

---

### Q7. Can bulk customers be created on-the-fly from the bulk POS screen, or must they be pre-registered?

- [ ] A — Inline creation (search tax ID / phone → if not found, create).
- [ ] B — Must exist — created only by admin in a dedicated screen.
- [ ] C — Inline creation allowed, but flagged "unverified" until admin approves.
- [x] D — Not sure / recommend default.

---

## SECTION 3 — Pricing Strategy

### Q8. كيف يتم تحديد سعر الجملة؟ _(How is the bulk price determined?)_

- [ ] A — **سعر جملة ثابت لكل صنف** — عمود سعر ثاني على جدول الأصناف (مثلاً `wholesalePrice`). كل صنف له سعر تجزئة وسعر جملة واحد فقط.
      _(Flat wholesale price per item — a second price column on `Item`. Every item has one retail price and one wholesale price.)_
- [ ] B — **شرائح أسعار (Tiers)** — عدة شرائح (شريحة 1 / شريحة 2 / شريحة 3)، وكل عميل جملة يتم تعيينه على شريحة معينة تحدد أسعاره تلقائياً.
      _(Price tiers — N tiers, each bulk customer is assigned to one tier which determines their prices automatically.)_
- [ ] C — **كسور الكميات (Quantity breaks)** — نفس الصنف، السعر ينخفض عند كميات أكبر (مثلاً: ≥ 10 وحدات = س جنيه، ≥ 50 = ص جنيه).
      _(Quantity breaks — same item, price drops at higher quantities, e.g. ≥ 10 units = X EGP, ≥ 50 = Y EGP.)_
- [x] D — **قائمة أسعار خاصة لكل عميل** — override لكل صنف لكل عميل على حدة (تسعير تعاقدي).
      _(Customer-specific price list — per-customer-per-item override, contract pricing.)_
- [ ] E — **تفاوض لكل طلب** — المندوب يكتب السعر يدوياً بدون أي قيمة محفوظة مسبقاً.
      _(Negotiated per order — the rep types the price, no preset.)_
- [ ] F — **هجين (Hybrid)** — دمج أكثر من خيار من اللي فوق، حدد أي منها: **\_\_**
      _(Hybrid — combine multiple above, specify which:)_

---

### Q9. Can the rep **override** the preset bulk price at the line level?

- [x] A — Yes, freely.
- [ ] B — Yes, but within a floor (cannot go below cost or below X% above cost).
- [ ] C — Yes, but requires manager PIN / approval.
- [ ] D — No — price is locked to the configured rule.

---

### Q10. Should we display **cost / margin** to the rep at checkout?

- [x] A — Yes — show cost and live margin % per line.
- [ ] B — Show margin only (not raw cost).
- [ ] C — No — hide cost entirely.
- [ ] D — Role-based (manager sees it, rep doesn't).

---

### Q11. Discounts on bulk orders — how do they interact with the new bulk pricing?

- [ ] A — Same `DiscountPanel` as POS/Call-Center: order-level % or value on top of bulk price.
- [x] B — Bulk already **is** the discount — no additional discount allowed.
- [ ] C — Both: bulk price + additional order-level discount allowed.
- [ ] D — Line-level discount allowed too (% or value per item line).

---

## SECTION 4 — Tax & Invoicing

### Q12. Tax handling for bulk customers

- [ ] A — Same 14% VAT as retail, applied on top.
- [x] B — Tax-inclusive bulk prices (price shown already includes VAT).
- [ ] C — **Tax-exempt** customers exist (e.g., export, government) — toggle per customer.
- [ ] D — Mixed: customer record carries `taxProfile = INCLUSIVE | EXCLUSIVE | EXEMPT`.

---

### Q13. Do we need to issue a formal **tax invoice** (E-Invoice / فاتورة ضريبية) with company data + tax number?

- [ ] A — Yes, always, with both company and customer tax numbers on the document.
- [x] B — Only when customer has a tax number; else a simplified receipt.
- [ ] C — No — just the same POS receipt.
- [ ] D — Yes, and it must integrate with Egyptian ETA (E-Invoice portal). _(scope flag — large effort)_

---

### Q14. Do we need a **proforma invoice / quote** workflow before the final sale?

- [ ] A — Yes — rep creates a Quote → customer approves → converts to Sale.
- [ ] B — No — direct sale only, no quote stage.
- [x] C — Optional — rep chooses "Save as Quote" or "Confirm Sale".
- [ ] D — Not sure / recommend default.

---

### Q15. Invoice numbering — separate series for bulk?

- [x] A — Separate series/prefix (e.g., `BULK-0001`, `INV-B-0001`) distinct from retail `saleNumber`.
- [ ] B — Shared series — bulk and retail share `saleNumber`.
- [ ] C — Not sure / recommend default.

---

## SECTION 5 — Payment & Credit

### Q16. What payment methods are valid for bulk orders?

- [x] Cash
- [ ] Card / POS machine
- [x] Bank transfer (with reference number)
- [x] Cheque (with cheque number + due date)
- [x] Credit (deferred — customer pays later)
- [x] Split / partial payment (e.g., 50% now + 50% later)
- [ ] Other: **\_\_**

---

### Q17. Do bulk customers have a **credit account** (AR / accounts receivable)?

- [x] A — Yes — track open balance per customer, aging report, statements.
- [ ] B — No — every order must be paid in full at creation.
- [ ] C — Yes, but only for customers flagged as "credit-approved".
- [ ] D — Not sure / recommend default.

---

### Q18. If credit is enabled, how is **credit limit** enforced?

- [x] A — Hard block — cannot create order if `outstanding + orderTotal > creditLimit`.
- [ ] B — Warn-and-allow — rep sees warning, manager PIN required to exceed.
- [ ] C — Soft warning only, no block.
- [ ] D — No credit limit tracked.

---

### Q19. Payment collection / settlement on credit orders — who and where?

- [x] A — Dedicated "Collections" screen in the module (record payments against invoices).
- [ ] B — Treasury module handles incoming payments (existing).
- [ ] C — Cashier at POS can collect a payment against an old bulk invoice.
- [ ] D — All of the above.

---

## SECTION 6 — Inventory, Stock & Branches

### Q20. Where does bulk stock come from?

- [ ] A — Same branch inventory as retail POS (shared pool).
- [ ] B — Separate **wholesale warehouse(s)** — bulk orders deduct from those, not branch retail stock.
- [x] C — Configurable per order (rep picks source warehouse).
- [ ] D — Not sure / recommend default.

---

### Q21. Do we **reserve** stock on bulk orders, or only deduct at fulfillment?

- [x] A — Deduct immediately at order creation (like current Sale).
- [ ] B — Reserve at creation, deduct at delivery/fulfillment.
- [ ] C — No reservation — check at fulfillment only (risk of overselling).
- [ ] D — Configurable per order type.

---

### Q22. Backorders — what happens when requested qty > available stock?

- [x] A — Block — cannot place order until stock available.
- [ ] B — Allow partial fulfillment (ship what's available, rest as backorder).
- [ ] C — Accept as backorder, fulfill when stock arrives, track pending qty.
- [ ] D — Warn-and-allow (override with PIN).

---

### Q23. Is the bulk module **per-branch**, **central**, or **both**?

- [ ] A — Per-branch — each branch has its own bulk queue, stock, and shift.
- [ ] B — Central — HQ/warehouse-level, not tied to a branch shift.
- [x] C — Both — bulk orders can be fulfilled from any branch/warehouse; rep picks source.
- [ ] D — Not sure / recommend default.

---

### Q24. هل إنشاء طلب جملة يتطلب **وردية كاشير مفتوحة** (مثل نقطة البيع بالتجزئة)؟ _(Does creating a bulk order require an open cashier shift?)_

- [ ] A — نعم — نفس قاعدة الوردية الموجودة (يفرض المصالحة المحاسبية).
      _(Yes — same shift rule as POS (enforces reconciliation).)_
- [x] B — لا — الجملة تعمل بشكل مستقل عن وردية الكاشير.
      _(No — bulk runs independently of cashier shift.)_
- [ ] C — فقط إذا تم استقبال الدفع عند الإنشاء؛ طلبات الأجل تتجاوز الوردية.
      _(Only if payment is received at creation; credit orders bypass shift.)_
- [ ] D — غير متأكد / برجاء التوصية بالأفضل.
      _(Not sure / recommend default.)_

---

## SECTION 7 — Order Lifecycle & Data Model

### Q25. How should bulk orders be stored?

- [ ] A — Extend existing `Sale` model with `source = BULK` and new fields.
- [ ] B — New `BulkOrder` + `BulkOrderItem` models, linked to `Sale` only when invoiced/paid.
- [ ] C — New `Quote` + `Invoice` + `Sale` three-table flow.
- [x] D — Not sure / recommend the best trade-off.

---

### Q26. Order status transitions (check all that apply)

- [x] DRAFT (rep still editing)
- [ ] QUOTED (proforma sent)
- [x] CONFIRMED (customer approved, stock reserved)
- [ ] PARTIALLY_FULFILLED
- [ ] FULFILLED / DELIVERED
- [ ] INVOICED
- [x] PAID
- [x] PARTIALLY_PAID
- [x] CANCELLED
- [x] RETURNED / REFUNDED
- [ ] Other: **\_\_**

---

### Q27. Editability after creation

- [ ] A — Fully editable until CONFIRMED; locked after.
- [ ] B — Editable until PAID.
- [x] C — Not editable at all — cancel + re-create.
- [ ] D — Editable with audit trail at any time (manager only).

---

### Q28. Cancellation policy

- [x] A — Cancel only while DRAFT / QUOTED.
- [ ] B — Cancel any time before FULFILLED, auto-reverses stock.
- [ ] C — Cancel any time with manager approval.
- [ ] D — Partial cancel (cancel some lines, keep others).

---

### Q29. Returns / refunds for bulk

- [ ] A — Reuse existing POS `RefundModal`.
- [ ] B — New **credit note** workflow (issue credit note doc, reduce AR balance).
- [x] C — Both — rep picks "cash refund" or "credit note".
- [x] D — Not sure / recommend default.

---

## SECTION 8 — Delivery & Fulfillment

### Q30. How are bulk orders delivered?

- [ ] A — Same delivery-man pool as retail (existing `DeliveryMan` model).
- [ ] B — **Freight / external logistics** — free-text carrier + tracking number, no delivery-man assignment.
- [x] C — Customer pickup only (no delivery).
- [ ] D — Mix — rep picks delivery type per order.

---

### Q31. Is the delivery fee on bulk orders the same as retail?

- [ ] A — Same zone-based fee as retail.
- [ ] B — Negotiated per order (rep types fee).
- [ ] C — Free delivery above threshold, else flat fee.
- [x] D — No delivery fee field — freight billed separately.

---

### Q32. Scheduled delivery / fulfillment date?

- [ ] A — Yes — customer picks a specific date/time; order sits in queue until that date.
- [ ] B — No — immediate only.
- [x] C — Optional — default is immediate, rep can schedule.

---

### Q33. Multi-drop (one order delivered to multiple addresses)?

- [x] A — Not needed.
- [ ] B — Yes — split order into N delivery groups.
- [ ] C — Not sure / recommend default.

---

## SECTION 9 — Documents & Printing

### Q34. Which printable documents do we need?

- [x] Quote / Proforma invoice (PDF + print)
- [x] Tax invoice
- [ ] Delivery note / packing slip (no prices)
- [ ] Receipt / payment voucher
- [x] Credit note
- [x] Customer statement of account (AR aging)
- [ ] Other: **\_\_**

---

### Q35. Document format & distribution

- [ ] A — Print on POS printer (same 80mm roll as retail).
- [x] B — A4 PDF download only.
- [ ] C — Both — POS slip for quick handoff + A4 PDF for records.
- [ ] D — Email / WhatsApp the PDF directly to the customer.

---

### Q36. Company branding on bulk documents

- [x] A — Reuse existing `PrintTicket` header (logo + tax number).
- [ ] B — Dedicated header for bulk (formal letterhead with terms & conditions footer).
- [ ] C — Configurable per-branch letterhead.

---

## SECTION 10 — Permissions & Roles

### Q37. Which modules / permissions does the bulk role need?

- [x] A new `BULK_POS` module permission (create/manage bulk orders)
- [x] `BULK_CUSTOMERS` (view + create bulk customers)
- [x] `BULK_PRICING` (edit price lists / tiers)
- [x] `BULK_CREDIT` (approve credit limits, record payments)
- [x] `BULK_REPORTS`
- [ ] POS / retail (optional)
- [ ] Other: **\_\_**

---

### Q38. Can the rep view orders from **other reps**?

- [x] A — All bulk orders across the company.
- [ ] B — Only their own.
- [ ] C — Only orders for customers they're the assigned account manager for.
- [ ] D — Scoped by branch / region.

---

### Q39. Who can approve price/discount overrides and credit-limit breaches?

- [ ] A — Branch manager PIN at the terminal.
- [ ] B — Remote approval (manager gets a notification and approves from their screen).
- [x] C — Rep has full autonomy, audit trail is enough.
- [x] D — Not sure / recommend default.

---

## SECTION 11 — Reporting

### Q40. Which new reports do you want?

- [x] Bulk sales by customer
- [ ] Bulk sales by sales rep
- [ ] Bulk sales by item / category
- [x] Customer AR aging (open balance bucketed 0–30 / 31–60 / 61–90 / 90+)
- [x] Customer statement of account
- [ ] Margin report per order (reveals cost/margin)
- [ ] Top N bulk customers by revenue
- [ ] Quote-to-sale conversion rate
- [ ] Stock-out events on bulk orders
- [ ] Other: **\_\_**

---

### Q41. Do bulk orders appear in the existing Sales Report?

- [ ] A — Yes, mixed, with `source = BULK` filter.
- [x] B — No, separate report only.
- [ ] C — Yes with a visual marker, and a toggle to exclude.

---

### Q42. Do bulk orders count toward the cashier's shift reconciliation?

- [ ] A — Yes — if paid at creation, they're in the shift.
- [x] B — No — bulk is always outside shift reconciliation.
- [ ] C — Only cash/card payments count; credit orders don't.

---

## SECTION 12 — UX & Non-Functional

### Q43. UI layout preference

- [x] A — Clone of existing POS layout (left: catalog, right: cart) with bulk-specific panels.
- [ ] B — Line-item grid like Excel (scan fast, add many rows).
- [ ] C — Search-heavy sidebar (items, saved orders, recent customers).
- [ ] D — Not sure / show me mockups.

---

### Q44. Expected volume (rough estimate)

- Bulk orders per day across all branches: **\_\_** 5
- Concurrent bulk reps online: **\_\_** 2
- Avg line items per bulk order: **\_\_** 10
- Largest expected order (EGP): **\_\_** 2M

---

### Q45. UI language

- [x] A — Arabic-first RTL (match the rest of the app).
- [ ] B — Bilingual (EN/AR toggle).
- [ ] C — Same as the rest of the app.

---

### Q46. Devices / browser constraints

- [ ] A — Desktop only.
- [ ] B — Desktop + tablet.
- [x] C — Phone too (reps on the road).

---

### Q47. Offline support — do reps work where connectivity is unreliable?

- [ ] A — Must work offline with later sync (complex).
- [x] B — Online-only is fine.
- [ ] C — Not sure / recommend default.

---

## SECTION 13 — Integrations & Edge Cases

### Q48. Import / export of customers and price lists?

- [ ] A — Yes — Excel/CSV import for bulk customers and per-customer price lists.
- [x] B — No — manual entry only.
- [ ] C — API-only integration (external ERP / accounting).

---

### Q49. Relationship to the existing **Suppliers / Purchases** module — any overlap?

- [x] A — None — bulk is purely outbound sales.
- [ ] B — Some customers are also suppliers (contra-account) — we must net balances.
- [ ] C — Not sure / recommend default.

---

### Q50. Loyalty / recurring orders

- [x] A — None for now.
- [ ] B — "Repeat last order" button only.
- [ ] C — Full recurring schedule (auto-create weekly/monthly orders).
- [ ] D — Loyalty points / tiers based on 12-month spend.

---

## SECTION 14 — Rollout

### Q51. Rollout strategy

- [ ] A — Ship everything at once, no feature flag.
- [x] B — Phase it (suggested): (1) bulk customers + pricing rules + manual price orders; (2) quote/invoice/credit; (3) reports + imports.
- [ ] C — Feature flag per company / branch.

---

### Q52. Migration of existing data

- [x] A — No existing bulk data — greenfield.
- [ ] B — We have bulk customers in spreadsheets — import required.
- [ ] C — We have bulk customers inside the current `Client` table mixed with retail — need to classify and split.
- [ ] D — Other: **\_\_**

---

### Q53. Timeline / deadline constraints

```



```

---

### Q54. Anything I missed? Free-text notes / constraints / must-haves:

```



```

---

## End of questionnaire

Once you fill this in and send it back, I will:

1. Write the **Understanding Lock** summary for your confirmation.
2. Propose **2–3 design approaches** with trade-offs (standalone module vs extension of `Sale`, quote-flow depth, pricing engine shape).
3. Build the final **design doc + decision log + implementation plan**.
