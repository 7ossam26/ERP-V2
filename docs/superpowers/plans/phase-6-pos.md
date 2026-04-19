# Phase 6 — POS (Point of Sale)

## Transaction Design (read before implementing)

The `POST /api/sales` handler must be one `prisma.$transaction`. Every step below runs inside it; any throw rolls back everything.

### Strict step ordering

The ordering matters — it minimizes lock time on hot rows and fails fast.

```
STEP 1. Auth + shift gate (no DB writes)
STEP 2. Load + lock inputs (reads with FOR UPDATE where needed)
STEP 3. Validate (no writes yet)
STEP 4. Price resolution
STEP 5. Stock reservations + roll cuts (WRITES START)
STEP 6. Create Sale + SaleItem rows
STEP 7. Treasury update
STEP 8. Commit (audit fires via middleware on response)
```

### Step-by-step

**STEP 1 — Auth + shift gate**
- `req.user` present, has POS module access
- Find open shift for `req.user.id` at `req.user.branchId`
- If none → throw Arabic `يجب فتح وردية قبل إجراء عمليات البيع` (400), **outside the transaction** so nothing locks

**STEP 2 — Load + lock inputs**
Inside `prisma.$transaction(async (tx) => { ... })`:
- Load client (if `clientId` provided, else walk-in). Cache `client.tier`.
- For each line item, load Item with `tx.item.findUnique`. Cache `type`.
- For fabric lines: lock the specific rolls in `rollAllocations` with `SELECT ... FOR UPDATE`:
  ```js
  await tx.$queryRaw`SELECT id, remaining_length, status
                     FROM fabric_rolls
                     WHERE id IN (${Prisma.join(rollIds)})
                     FOR UPDATE`
  ```
- For non-fabric lines: lock the Inventory row:
  ```js
  await tx.$queryRaw`SELECT id, quantity FROM inventory
                     WHERE item_id=? AND warehouse_id=?
                     FOR UPDATE`
  ```
- Lock the treasury row the same way.

Locking here (before validation) is critical — we commit to the intent before doing expensive work, and any concurrent sale blocks until we finish.

**STEP 3 — Validate**
- For each fabric line: `Σ rollAllocations.length == quantity` (Arabic error on mismatch)
- For each fabric roll allocation: `length ≤ roll.remainingLength` (Arabic `الطول المتاح في لفة R-... غير كافٍ`)
- For each roll: `status IN (AVAILABLE, PARTIALLY_CUT)` — reject if someone marked it DAMAGED between request start and now
- For each non-fabric line: `quantity ≤ inventory.quantity` (Arabic `الكمية المتاحة غير كافية`)
- If `tierOverride` present: `tierOverrideReason` required (non-empty string)
- For each line where `unitPrice` provided and differs from resolved price by > 0.01: `priceOverrideReason` required

All validation throws before any write. Nothing persists.

**STEP 4 — Price resolution**
- Call `pricingService.resolveBulkPrices(clientId, itemIds, tierOverride)` — single query
- For each line: `finalUnitPrice = provided unitPrice ?? resolved.effectivePrice`
- Record `priceSource` per line for audit: `'tier_price' | 'base_price' | 'override'`

**STEP 5 — Writes: stock reservations + roll cuts**
- **Fabric lines:** for each allocation, call the Phase 3 cut logic *inline* (don't HTTP-call the route; duplicate the logic or extract into a shared service function `cutRoll(tx, rollId, length, saleItemId?)`). Per cut:
  1. `UPDATE fabric_rolls SET remaining_length = remaining_length - :length, status = CASE WHEN remaining_length - :length = 0 THEN 'DEPLETED' ELSE 'PARTIALLY_CUT' END WHERE id = :rollId`
  2. Insert `FabricRollCut` with `lengthCut` (saleItemId filled in STEP 6)
  3. Decrement `Inventory.quantity` for `(itemId, warehouseId)` by `length`

- **Non-fabric lines:** `UPDATE inventory SET quantity = quantity - :qty WHERE item_id=? AND warehouse_id=?`

Note the ordering: we cut rolls *before* creating Sale/SaleItem. That's intentional — if a roll cut fails for any reason (race, constraint, DB error), we haven't created a Sale record yet that needs to be undone. Cleaner rollback.

**Problem:** `FabricRollCut.saleItemId` is needed, but SaleItem doesn't exist yet. Solution: create cuts with `saleItemId = null` in Step 5, then `UPDATE fabric_roll_cuts SET sale_item_id = ? WHERE id IN (...)` in Step 6 after SaleItem rows have IDs. OR: create SaleItem rows first with placeholder totals, then cut, then update totals. **Pick the first approach** — cleaner.

**STEP 6 — Create Sale + SaleItem**
- Compute subtotal, discount, tax (respect `SystemConfiguration.taxEnabledOnSales`), grand total
- If `paidAmount < total` → reject Arabic `المبلغ المدفوع أقل من إجمالي الفاتورة` (POS is cash-on-sale only per scope)
- Change = `paidAmount - total` (for CASH only; for VISA/INSTAPAY, `paidAmount` must equal `total` exactly)
- Generate `saleNumber` (reuse existing generator)
- Insert `Sale` with `shiftId`, `branchId`, `clientId`, amounts, `paymentMethod`, `tierOverride`, `tierOverrideReason`, `notes`
- Insert `SaleItem` rows
- **Back-fill** `FabricRollCut.saleItemId` from Step 5 now that SaleItem IDs exist

**STEP 7 — Treasury update**
- For CASH: `UPDATE treasuries SET balance = balance + :paidAmount WHERE id = :cashTreasuryId`
- For VISA/INSTAPAY: route to the electronic treasury (match ElGhonemy's existing mapping — don't invent)
- Record the treasury movement using whatever table ElGhonemy uses (`TreasuryTransaction` or similar — inherit)

**STEP 8 — Return**
- Return full sale detail (populated: items, client, shift, payment, roll cuts)
- Audit middleware fires automatically on `res.json(...)`; details JSON should include `tierOverrideReason`, per-line `priceOverrideReason`, per-line `priceSource`

### Rollback scenarios — explicit list

Any throw before commit rolls everything back. Test these specifically:

| Failure injected at | Expected state after |
|---|---|
| Step 2 — roll lock fails (row was deleted mid-request) | No writes; Arabic error |
| Step 3 — validation fails on 3rd line of 5 | No writes on any of the 5 |
| Step 5 — first roll cut succeeds, second throws (e.g., constraint) | First roll's remaining_length reverts; no Inventory changes; no SaleItem |
| Step 5 — Inventory decrement fails (negative constraint) | All roll cuts reverted; no Sale |
| Step 6 — Sale insert fails (e.g., sale number collision) | All stock writes reverted |
| Step 7 — treasury update fails | Sale + SaleItem + stock writes all reverted |
| Network disconnect after Step 8 response sent | Sale is valid; client retries only the GET to view |

Add a test that force-injects a throw at Step 5 mid-loop (mock or feature-flag) and verifies DB is byte-identical to pre-request state.

### Race conditions — the scenarios you must test

**Race 1: Two cashiers selling the last of a roll**
- Cashier A at Gesr: sell 10m from roll R-00042 which has 15m
- Cashier B at Gesr: sell 8m from the same roll at the same moment
- Both requests arrive within 50ms
- `SELECT ... FOR UPDATE` in Step 2 serializes them. Whichever transaction starts first proceeds; second waits; second sees `remainingLength = 5m`; second's validation in Step 3 fails (`8 > 5`) with Arabic error.
- **Test**: fire two requests in parallel; exactly one succeeds, one fails with stock error, roll ends at `remainingLength = 5m`.

**Race 2: Cashier sells while warehouse keeper marks roll damaged**
- Cashier A: starts sale including roll R-00042
- Warehouse B: calls `mark-damaged` on R-00042
- Both inside transactions, both want the same row
- `FOR UPDATE` serializes. Whichever commits first wins. Loser sees the new state and fails validation.
- **Test**: fire both in parallel, assert exactly one succeeds, final state is consistent.

**Race 3: Two cashiers selling non-fabric item with stock=1**
- Both select same item, quantity 1
- Inventory row locked by first; second waits; second sees `quantity=0`; Step 3 rejects.
- **Test**: fire two parallel; one wins, one fails, final Inventory.quantity = 0.

**Race 4: Shift closes mid-sale**
- Cashier submits sale at 17:59:59
- Manager closes shift at 17:59:59 in a separate transaction
- Shift gate (Step 1) passed for cashier, but close commits before sale commits
- Decide policy: the sale is part of the shift that was open when submitted. Don't re-check shift status inside the transaction. Manager's close operation should verify no in-flight sales (or accept that the last sale belongs to the closed shift — simpler, match ElGhonemy's existing behavior — **do whatever ElGhonemy does; don't invent new policy**).

**Race 5: Client tier changes between cart build and submit**
- Cashier adds items with wholesale tier client
- Owner changes client to retail tier
- Cashier submits
- Step 4 resolves fresh prices at submit time with current tier. Prices may differ from what cashier saw. Policy: **server-side prices win.** Client sees the final invoice total; if it differs, cashier reviews before printing receipt.
- **Test**: change tier mid-cart; submit uses current tier, not the one active when items were added.

**Race 6: Item `showInPos` flipped to false mid-cart**
- Add item; admin disables it; cashier submits
- Don't block the submit — the item was valid when added, and the sale is a historical event
- Post-condition: sale created normally; future carts won't see the item.

### Isolation level

Use Prisma's default (MySQL `REPEATABLE READ`). With explicit `FOR UPDATE` locks in Step 2, this is sufficient. Do NOT bump to `SERIALIZABLE` — too much contention, no benefit over the explicit locks.

### Idempotency (nice-to-have, not required for v1)

If the cashier loses connection after submit but before receipt shows, they might retry. Without idempotency keys, a retry creates a duplicate sale. Two options:
- **v1 (this phase):** accept the risk; add a prominent "success" toast so cashier doesn't double-click; disable the submit button for 3 seconds after click.
- **v2 (future):** accept optional `idempotencyKey` header; cache response for 60s; retry returns cached response.

Implement v1 now, note v2 as a TODO in the route file.

### Code skeleton

```js
router.post('/', authMiddleware, requireModule('POS'), async (req, res, next) => {
  try {
    // STEP 1: shift gate (outside tx)
    const openShift = await prisma.shift.findFirst({
      where: { userId: req.user.id, branchId: req.user.branchId, status: 'OPEN' }
    });
    if (!openShift) {
      return res.status(400).json({ error: 'يجب فتح وردية قبل إجراء عمليات البيع' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // STEP 2: load + lock
      const { client, items, rollsByLine, inventoryByLine, treasury } =
        await loadAndLock(tx, req.body, req.user);

      // STEP 3: validate
      validateSalePayload(req.body, { client, items, rollsByLine, inventoryByLine });

      // STEP 4: resolve prices
      const resolvedLines = await resolveLinePrices(tx, req.body, client);

      // STEP 5: cut rolls + decrement inventory
      const pendingRollCuts = await applyStockChanges(tx, resolvedLines, rollsByLine);

      // STEP 6: create Sale + SaleItem + backfill cut refs
      const sale = await createSaleAndItems(tx, resolvedLines, req.body, openShift, req.user);
      await backfillRollCutsSaleItemIds(tx, pendingRollCuts, sale.items);

      // STEP 7: treasury
      await updateTreasury(tx, treasury, req.body.paymentMethod, req.body.paidAmount, sale.id);

      return sale;
    }, { timeout: 10000 }); // 10s txn timeout — normal sales complete in <500ms

    res.json(result); // audit middleware fires here
  } catch (err) {
    next(err);
  }
});
```

Extract the helpers (`loadAndLock`, `validateSalePayload`, etc.) into a file `backend/services/salesService.js` so the route file stays readable.

### Timeout

Default Prisma transaction timeout is 5 seconds. For a sale touching multiple rolls, set explicit `timeout: 10000`. If a real sale ever exceeds 10s, that's a sign of lock contention — log it.

### What NOT to do

- Don't nest transactions. One per request.
- Don't use application-level locks (Redis/Mutex). The DB locks are sufficient.
- Don't skip `FOR UPDATE` and rely on "optimistic" update where you `UPDATE ... WHERE remaining_length = :oldValue` and check rows-affected. That pattern gets ugly with fractional quantities and rounding.
- Don't resolve prices before locking inputs. Price changes are frequent enough that you want the resolution to happen inside the locked window.
- Don't send the receipt response before the transaction commits. If audit write fails, you already told the customer the sale succeeded.

---

## Handoff to Claude Code

**Important:** Read the "Transaction Design" section carefully before writing any code. The ordering, locking, and rollback strategy there are fixed — do not deviate. Extract transaction steps into `backend/services/salesService.js` helpers; keep `routes/sales.js` thin. When writing tests, include the 6 race-condition scenarios explicitly.
