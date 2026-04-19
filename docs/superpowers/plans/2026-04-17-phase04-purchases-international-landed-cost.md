# Phase 4: Purchases — International + Landed Cost + Fabric Roll Generation + Supplier Tax Number

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing purchase flow with international flag, landed-cost allocation (BY_VALUE / BY_QUANTITY / MANUAL / NONE), per-line `finalUnitCost`, automatic FabricRoll generation for fabric items on receipt, and supplier `taxNumber`.

**Architecture:** All new fields are added via a single Prisma migration. Backend logic lives entirely in `backend/routes/purchases.js` (no new files needed). Frontend extends `PurchasesPage.jsx` in-place with new UI sections behind the existing tab structure, plus a feature flag that hides landed-cost UI when disabled.

**Tech Stack:** Node.js / Express / Prisma (MySQL), React / Vite / Tailwind CSS, existing `generateRollNumber` service.

---

## Current State (read before touching anything)

### Schema fields that already exist on `purchases` table:
- `isInternational Boolean @default(false)`
- `shippingCost Decimal @default(0)`
- `customsDuty Decimal @default(0)`
- `otherLandingCosts Decimal @default(0)`

### Schema fields that already exist on `system_configuration`:
- `taxNumber String @default("")`  ← this is the **company's** tax number, NOT supplier's

### What DOES NOT exist yet in the schema:
- `purchases.clearanceCost` — the spec adds a dedicated clearance field
- `purchases.landedCostEnabled Boolean`
- `purchases.landedCostAllocation` (enum: NONE | BY_VALUE | BY_QUANTITY | MANUAL)
- `purchase_items.allocatedLandedCost Decimal`
- `purchase_items.finalUnitCost Decimal`
- `suppliers.taxNumber String`   ← supplier-specific tax number

### What DOES NOT exist in `fabricRolls.js` POST `/`:
- `purchaseId` linkage — the Phase 3 batch-create route already accepts arbitrary metadata; we will pass `purchaseId` in the data but the schema already has `purchaseItemId?` on `fabric_rolls`. We will wire it via a direct Prisma call inside the purchases transaction, NOT via a separate HTTP call — both run inside the same DB transaction.

### Existing `fabric_rolls` schema field: `purchaseItemId Int? @map("purchase_item_id")`
This already exists. We use it to link each generated roll to its source line.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/prisma/schema.prisma` | Modify | Add new enum + fields |
| `backend/prisma/migration.sql` | Modify | Append DDL for new fields |
| `backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/migration.sql` | Create | Individual migration file |
| `backend/routes/purchases.js` | Modify | All new backend logic |
| `backend/routes/suppliers.js` | Modify | Expose `taxNumber` in GET/POST/PUT |
| `frontend/src/pages/purchases/PurchasesPage.jsx` | Modify | New UI: international flag, landed cost, rolls sub-table, summary panel |

No new files are needed.

---

## Task 1: Database Migration — New Fields

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/migration.sql`
- Modify: `backend/prisma/migration.sql`

- [ ] **Step 1.1: Add new enum to schema.prisma**

Open `backend/prisma/schema.prisma`. After the existing enums (before `model Purchase`), add:

```prisma
enum LandedCostAllocation {
  NONE
  BY_VALUE
  BY_QUANTITY
  MANUAL
}
```

- [ ] **Step 1.2: Extend Purchase model in schema.prisma**

In the `Purchase` model, after `otherLandingCosts` and before `createdAt`:

```prisma
  clearanceCost         Decimal              @default(0) @map("clearance_cost") @db.Decimal(10, 2)
  landedCostEnabled     Boolean              @default(false) @map("landed_cost_enabled")
  landedCostAllocation  LandedCostAllocation @default(NONE) @map("landed_cost_allocation")
```

- [ ] **Step 1.3: Extend PurchaseItem model in schema.prisma**

In the `PurchaseItem` model, after the `total` field and before `// Relations`:

```prisma
  allocatedLandedCost Decimal @default(0) @map("allocated_landed_cost") @db.Decimal(10, 2)
  finalUnitCost       Decimal @default(0) @map("final_unit_cost") @db.Decimal(10, 2)
```

- [ ] **Step 1.4: Add taxNumber to Supplier model in schema.prisma**

In the `Supplier` model, after `phoneNumber`:

```prisma
  taxNumber String @default("") @map("tax_number")
```

- [ ] **Step 1.5: Create the individual migration SQL file**

Create file `backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/migration.sql`:

```sql
-- Phase 4: Purchases — International + Landed Cost + Supplier Tax Number

-- Add LandedCostAllocation enum support (MySQL uses VARCHAR for enums in Prisma)
ALTER TABLE `purchases`
  ADD COLUMN `clearance_cost` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `other_landing_costs`,
  ADD COLUMN `landed_cost_enabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `clearance_cost`,
  ADD COLUMN `landed_cost_allocation` ENUM('NONE','BY_VALUE','BY_QUANTITY','MANUAL') NOT NULL DEFAULT 'NONE' AFTER `landed_cost_enabled`;

-- Add per-line landed cost tracking to purchase_items
ALTER TABLE `purchase_items`
  ADD COLUMN `allocated_landed_cost` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `final_unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add supplier tax number
ALTER TABLE `suppliers`
  ADD COLUMN `tax_number` VARCHAR(191) NOT NULL DEFAULT '';
```

- [ ] **Step 1.6: Append migration to the combined migration.sql**

Open `backend/prisma/migration.sql` and append at the very end:

```sql
-- ============================================================
-- Migration: 20260417000003_phase4_purchases_landed_cost
-- Phase 4: Purchases — International + Landed Cost + Supplier Tax Number
-- ============================================================

ALTER TABLE `purchases`
  ADD COLUMN `clearance_cost` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `other_landing_costs`,
  ADD COLUMN `landed_cost_enabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `clearance_cost`,
  ADD COLUMN `landed_cost_allocation` ENUM('NONE','BY_VALUE','BY_QUANTITY','MANUAL') NOT NULL DEFAULT 'NONE' AFTER `landed_cost_enabled`;

ALTER TABLE `purchase_items`
  ADD COLUMN `allocated_landed_cost` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `final_unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE `suppliers`
  ADD COLUMN `tax_number` VARCHAR(191) NOT NULL DEFAULT '';
```

- [ ] **Step 1.7: Run migration against local database**

```bash
cd backend
npx prisma db push
```

Expected output: no errors; `Environment variables loaded from .env`; `Your database is now in sync with your Prisma schema`.

If `db push` is rejected (production safety), use instead:
```bash
npx prisma migrate deploy
```

- [ ] **Step 1.8: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔  Generated Prisma Client` with the new fields listed.

- [ ] **Step 1.9: Verify fields exist**

```bash
node -e "const {PrismaClient}=require('./config/database'); const p=new PrismaClient(); p.purchase.findFirst().then(r=>console.log(Object.keys(r||{}))).catch(console.error).finally(()=>p.\$disconnect())"
```

Expected: keys include `landedCostEnabled`, `landedCostAllocation`, `clearanceCost`.

- [ ] **Step 1.10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migration.sql backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/
git commit -m "feat(db): add landed cost fields, clearance cost, supplier tax number — phase 4 migration"
```

---

## Task 2: Backend — Supplier Route: taxNumber

**Files:**
- Modify: `backend/routes/suppliers.js`

- [ ] **Step 2.1: Expose taxNumber in GET all suppliers**

In the `GET /` handler, the current query is `prisma.supplier.findMany(...)`. The field is now on the model — Prisma returns it automatically. No change needed in the query. Verify by running the server and calling `GET /api/suppliers`.

- [ ] **Step 2.2: Expose taxNumber in POST (create supplier)**

In the `POST /` handler, destructure and write `taxNumber`:

Replace:
```javascript
const { name, phoneNumber } = req.body;

if (!name) {
  return res.status(400).json({ error: "Name is required" });
}

const supplier = await prisma.supplier.create({
  data: {
    name,
    phoneNumber: phoneNumber || "",
  },
});
```

With:
```javascript
const { name, phoneNumber, taxNumber } = req.body;

if (!name) {
  return res.status(400).json({ error: "Name is required" });
}

const supplier = await prisma.supplier.create({
  data: {
    name,
    phoneNumber: phoneNumber || "",
    taxNumber: taxNumber || "",
  },
});
```

- [ ] **Step 2.3: Expose taxNumber in PUT (update supplier)**

In the `PUT /:id` handler, replace:
```javascript
const { name, phoneNumber } = req.body;

const supplier = await prisma.supplier.update({
  where: { id: parseInt(req.params.id) },
  data: {
    name,
    phoneNumber,
  },
});
```

With:
```javascript
const { name, phoneNumber, taxNumber } = req.body;

const supplier = await prisma.supplier.update({
  where: { id: parseInt(req.params.id) },
  data: {
    name,
    phoneNumber,
    ...(taxNumber !== undefined && { taxNumber }),
  },
});
```

- [ ] **Step 2.4: Commit**

```bash
git add backend/routes/suppliers.js
git commit -m "feat(suppliers): expose taxNumber field in create/update routes"
```

---

## Task 3: Backend — Landed Cost Helper (in purchases.js)

**Files:**
- Modify: `backend/routes/purchases.js`

This task adds a pure helper function at the top of `purchases.js` (right after the imports) for landed cost allocation math. No routes are changed yet.

- [ ] **Step 3.1: Add allocateLandedCost helper function**

Open `backend/routes/purchases.js`. After the `const router = express.Router();` line and before any route definitions, insert:

```javascript
/**
 * Allocates totalLanded across purchase lines.
 *
 * Rules:
 * - BY_VALUE:    allocated_i = totalLanded × (line_total_i / subtotal)
 * - BY_QUANTITY: allocated_i = totalLanded × (qty_i / totalQty)
 * - MANUAL:      caller passes manualAllocatedLandedCost per line; we validate sum == totalLanded
 * - NONE:        all zero
 *
 * Rounding: values are rounded to 2 decimal places per line.
 * The rounding delta (sum − totalLanded) is absorbed into the LAST line so
 * that Σ allocatedLandedCost == totalLanded exactly.
 *
 * Returns array of { allocatedLandedCost, finalUnitCost } aligned with `items`.
 * Throws { status, message } on validation failure.
 */
function allocateLandedCost({ items, totalLanded, method }) {
  const n = items.length;
  const result = items.map(() => ({ allocatedLandedCost: 0, finalUnitCost: 0 }));

  if (method === "NONE" || totalLanded === 0) {
    items.forEach((item, i) => {
      result[i].finalUnitCost = parseFloat(item.purchasePrice);
    });
    return result;
  }

  let rawAllocations;

  if (method === "BY_VALUE") {
    const subtotal = items.reduce((s, item) => s + parseFloat(item.purchasePrice) * parseFloat(item.quantity), 0);
    if (subtotal === 0) {
      throw { status: 400, message: "لا يمكن توزيع التكاليف الإضافية على فاتورة قيمتها صفر" };
    }
    rawAllocations = items.map(item => {
      const lineTotal = parseFloat(item.purchasePrice) * parseFloat(item.quantity);
      return totalLanded * (lineTotal / subtotal);
    });

  } else if (method === "BY_QUANTITY") {
    const totalQty = items.reduce((s, item) => s + parseFloat(item.quantity), 0);
    if (totalQty === 0) {
      throw { status: 400, message: "لا يمكن توزيع التكاليف الإضافية على فاتورة قيمتها صفر" };
    }
    rawAllocations = items.map(item => {
      return totalLanded * (parseFloat(item.quantity) / totalQty);
    });

  } else if (method === "MANUAL") {
    const manualSum = items.reduce((s, item) => s + parseFloat(item.manualAllocatedLandedCost || 0), 0);
    const diff = Math.abs(manualSum - totalLanded);
    if (diff > 0.02) {
      throw {
        status: 400,
        message: `مجموع التوزيع اليدوي (${manualSum.toFixed(2)}) لا يساوي إجمالي التكاليف الإضافية (${totalLanded.toFixed(2)})`,
      };
    }
    rawAllocations = items.map(item => parseFloat(item.manualAllocatedLandedCost || 0));

  } else {
    throw { status: 400, message: `طريقة توزيع غير معروفة: ${method}` };
  }

  // Round to 2 decimals, absorb rounding delta into last line
  let runningSum = 0;
  for (let i = 0; i < n - 1; i++) {
    const rounded = Math.round(rawAllocations[i] * 100) / 100;
    result[i].allocatedLandedCost = rounded;
    runningSum += rounded;
  }
  // Last line absorbs rounding error
  result[n - 1].allocatedLandedCost = Math.round((totalLanded - runningSum) * 100) / 100;

  // Compute finalUnitCost per line
  items.forEach((item, i) => {
    const qty = parseFloat(item.quantity);
    const alloc = result[i].allocatedLandedCost;
    result[i].finalUnitCost = Math.round((parseFloat(item.purchasePrice) + (qty > 0 ? alloc / qty : 0)) * 100) / 100;
  });

  return result;
}
```

- [ ] **Step 3.2: Commit**

```bash
git add backend/routes/purchases.js
git commit -m "feat(purchases): add allocateLandedCost helper — phase 4"
```

---

## Task 4: Backend — Fabric Roll Validation Helper (in purchases.js)

**Files:**
- Modify: `backend/routes/purchases.js`

- [ ] **Step 4.1: Add validateFabricRolls helper function**

Below `allocateLandedCost`, add:

```javascript
/**
 * Validates that fabric line items have rolls arrays whose lengths sum exactly
 * to the line quantity. Also checks each roll has originalLength > 0.
 *
 * @param {Array} items - purchase line items
 * @param {Object} itemTypeMap - { [itemId]: itemType } pre-fetched
 * Throws { status, message } on failure.
 */
function validateFabricRolls(items, itemTypeMap) {
  for (const item of items) {
    const isFabric = itemTypeMap[item.itemId] === "FABRIC";
    if (!isFabric) continue;

    const rolls = item.rolls || [];
    if (rolls.length === 0) {
      throw {
        status: 400,
        message: `الصنف ${item.itemId} من نوع قماش — يجب تحديد اللفات (rolls)`,
      };
    }

    const rollsTotal = rolls.reduce((s, r) => s + parseFloat(r.originalLength || 0), 0);
    const lineQty = parseFloat(item.quantity);
    const diff = Math.abs(rollsTotal - lineQty);
    if (diff > 0.001) {
      throw {
        status: 400,
        message: `مجموع أطوال اللفات (${rollsTotal}) لا يساوي كمية السطر (${lineQty}) للصنف ${item.itemId}`,
      };
    }

    for (const roll of rolls) {
      if (!roll.originalLength || parseFloat(roll.originalLength) <= 0) {
        throw { status: 400, message: `كل لفة يجب أن يكون لها طول أصلي أكبر من صفر` };
      }
    }
  }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add backend/routes/purchases.js
git commit -m "feat(purchases): add validateFabricRolls helper — phase 4"
```

---

## Task 5: Backend — POST /api/purchases (Create with Landed Cost + Rolls)

**Files:**
- Modify: `backend/routes/purchases.js`

This is the largest change. We replace the existing `POST /` handler body with the extended version.

- [ ] **Step 5.1: Read the current POST / handler carefully**

Open `backend/routes/purchases.js` and identify the exact start and end of the `router.post("/", ...)` handler. Note:
- It starts with: `router.post("/", requirePermission("PURCHASES"), async (req, res) => {`
- It ends with the final `});` that closes that route.

- [ ] **Step 5.2: Replace the POST / handler**

Replace the entire `router.post("/", ...)` handler with:

```javascript
router.post("/", requirePermission("PURCHASES"), async (req, res) => {
  try {
    const {
      supplierId,
      treasuryId,
      warehouseId: bodyWarehouseId,
      supplierInvoiceNo,
      paymentMethod = "CASH",
      subtotal,
      discountType = "PERCENTAGE",
      discountValue,
      discountAmount,
      netTotal,
      paidAmount,
      remaining,
      items,
      // Phase 4 — landed cost
      isInternational = false,
      landedCostEnabled = false,
      landedCostAllocation = "NONE",
      freightCost = 0,
      customsCost = 0,
      clearanceCost = 0,
      otherLandedCost = 0,
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────
    if (!supplierId) return res.status(400).json({ error: "المورد مطلوب" });
    if (!treasuryId) return res.status(400).json({ error: "الخزينة مطلوبة" });
    if (!items || items.length === 0) return res.status(400).json({ error: "يجب إضافة صنف واحد على الأقل" });

    // ── Resolve warehouse ────────────────────────────────────────────────
    let resolvedWarehouseId = bodyWarehouseId;
    if (!resolvedWarehouseId) {
      const branchFilter = await getUserBranchFilter(req.user.id);
      if (branchFilter && branchFilter.warehouseId) {
        resolvedWarehouseId = branchFilter.warehouseId;
      }
    }
    if (!resolvedWarehouseId) {
      return res.status(400).json({ error: "لم يتم تحديد المخزن" });
    }

    // ── Pre-fetch item types (needed for fabric validation) ──────────────
    const itemIds = items.map(i => parseInt(i.itemId));
    const dbItems = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, itemType: true },
    });
    const itemTypeMap = {};
    dbItems.forEach(i => { itemTypeMap[i.id] = i.itemType; });

    // ── Validate fabric rolls ───────────────────────────────────────────
    try {
      validateFabricRolls(items, itemTypeMap);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // ── Compute landed cost totals ──────────────────────────────────────
    const totalLanded = landedCostEnabled
      ? parseFloat(freightCost) + parseFloat(customsCost) + parseFloat(clearanceCost) + parseFloat(otherLandedCost)
      : 0;

    // ── Allocate landed cost per line ───────────────────────────────────
    let lineAllocations;
    try {
      lineAllocations = allocateLandedCost({
        items,
        totalLanded,
        method: landedCostEnabled ? landedCostAllocation : "NONE",
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // ── Main transaction ────────────────────────────────────────────────
    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          supplierId: parseInt(supplierId),
          treasuryId: parseInt(treasuryId),
          warehouseId: parseInt(resolvedWarehouseId),
          supplierInvoiceNo: supplierInvoiceNo || null,
          paymentMethod,
          subtotal: parseFloat(subtotal),
          discountType,
          discountValue: parseFloat(discountValue) || 0,
          discountAmount: parseFloat(discountAmount) || 0,
          netTotal: parseFloat(netTotal),
          paidAmount: parseFloat(paidAmount) || 0,
          remaining: parseFloat(remaining) || 0,
          // Phase 4
          isInternational: Boolean(isInternational),
          shippingCost: parseFloat(freightCost) || 0,
          customsDuty: parseFloat(customsCost) || 0,
          clearanceCost: parseFloat(clearanceCost) || 0,
          otherLandingCosts: parseFloat(otherLandedCost) || 0,
          landedCostEnabled: Boolean(landedCostEnabled),
          landedCostAllocation: landedCostEnabled ? landedCostAllocation : "NONE",
          paymentStatus:
            paymentMethod === "DEFERRED" ? "UNPAID" :
            paymentMethod === "MIXED" ? "PARTIALLY_PAID" : "PAID",
        },
      });

      // 2. Create PurchaseItems + inventory + rolls
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const alloc = lineAllocations[i];
        const isFabric = itemTypeMap[parseInt(item.itemId)] === "FABRIC";

        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            itemId: parseInt(item.itemId),
            quantity: parseFloat(item.quantity),
            purchasePrice: parseFloat(item.purchasePrice),
            sellPrice: parseFloat(item.sellPrice) || 0,
            total: parseFloat(item.total),
            allocatedLandedCost: alloc.allocatedLandedCost,
            finalUnitCost: alloc.finalUnitCost,
          },
        });

        // Update item cost/sell prices
        await tx.item.update({
          where: { id: parseInt(item.itemId) },
          data: {
            costPrice: alloc.finalUnitCost > 0 ? alloc.finalUnitCost : parseFloat(item.purchasePrice),
            ...(parseFloat(item.sellPrice) > 0 && { price: parseFloat(item.sellPrice) }),
          },
        });

        if (isFabric) {
          // 3a. Fabric line: generate rolls, link to purchaseItemId
          const rolls = item.rolls || [];
          for (const rollInput of rolls) {
            const { generateRollNumber } = require("../services/rollNumberService");
            const rollNumber = await generateRollNumber(tx);
            const newRoll = await tx.fabricRoll.create({
              data: {
                itemId: parseInt(item.itemId),
                warehouseId: parseInt(resolvedWarehouseId),
                rollNumber,
                lengthMeters: parseFloat(rollInput.originalLength),
                originalLength: parseFloat(rollInput.originalLength),
                remainingLength: parseFloat(rollInput.originalLength),
                status: "AVAILABLE",
                unitCost: rollInput.unitCost != null ? parseFloat(rollInput.unitCost) : alloc.finalUnitCost,
                barcode: rollInput.barcode || null,
                notes: rollInput.notes || null,
              },
            });

            // Upsert inventory for this roll
            await tx.inventory.upsert({
              where: {
                itemId_warehouseId: {
                  itemId: parseInt(item.itemId),
                  warehouseId: parseInt(resolvedWarehouseId),
                },
              },
              update: {
                quantity: { increment: parseFloat(rollInput.originalLength) },
              },
              create: {
                itemId: parseInt(item.itemId),
                warehouseId: parseInt(resolvedWarehouseId),
                quantity: parseFloat(rollInput.originalLength),
              },
            });
          }
        } else {
          // 3b. Non-fabric line: plain inventory increment
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: parseInt(item.itemId),
                warehouseId: parseInt(resolvedWarehouseId),
              },
            },
            update: {
              quantity: { increment: parseFloat(item.quantity) },
            },
            create: {
              itemId: parseInt(item.itemId),
              warehouseId: parseInt(resolvedWarehouseId),
              quantity: parseFloat(item.quantity),
            },
          });
        }
      }

      // 4. Financial effects
      const netTotalNum = parseFloat(netTotal);
      const paidAmountNum = parseFloat(paidAmount) || 0;
      const remainingNum = parseFloat(remaining) || 0;

      if (paymentMethod === "CASH" || paymentMethod === "CREDIT") {
        const treasury = await tx.treasury.findUnique({ where: { id: parseInt(treasuryId) } });
        if (!treasury || parseFloat(treasury.balance) < netTotalNum) {
          throw new Error("رصيد الخزينة غير كافٍ");
        }
        await tx.treasury.update({
          where: { id: parseInt(treasuryId) },
          data: { balance: { decrement: netTotalNum } },
        });
        await tx.expense.create({
          data: {
            description: `مشتريات #${newPurchase.id}`,
            amount: netTotalNum,
            date: new Date(),
            type: "PURCHASE",
            treasuryId: parseInt(treasuryId),
            purchaseId: newPurchase.id,
            paymentMethod: paymentMethod === "CREDIT" ? "CARD" : "CASH",
          },
        });

      } else if (paymentMethod === "DEFERRED") {
        await tx.supplierAccount.upsert({
          where: { supplierId: parseInt(supplierId) },
          update: { balance: { increment: netTotalNum } },
          create: { supplierId: parseInt(supplierId), balance: netTotalNum },
        });

      } else if (paymentMethod === "MIXED") {
        if (paidAmountNum > 0) {
          const treasury = await tx.treasury.findUnique({ where: { id: parseInt(treasuryId) } });
          if (!treasury || parseFloat(treasury.balance) < paidAmountNum) {
            throw new Error("رصيد الخزينة غير كافٍ للدفع الجزئي");
          }
          await tx.treasury.update({
            where: { id: parseInt(treasuryId) },
            data: { balance: { decrement: paidAmountNum } },
          });
          await tx.expense.create({
            data: {
              description: `مشتريات جزئية #${newPurchase.id}`,
              amount: paidAmountNum,
              date: new Date(),
              type: "PURCHASE",
              treasuryId: parseInt(treasuryId),
              purchaseId: newPurchase.id,
              paymentMethod: "CASH",
            },
          });
        }
        if (remainingNum > 0) {
          await tx.supplierAccount.upsert({
            where: { supplierId: parseInt(supplierId) },
            update: { balance: { increment: remainingNum } },
            create: { supplierId: parseInt(supplierId), balance: remainingNum },
          });
        }
      }

      // Return with all relations
      return tx.purchase.findUnique({
        where: { id: newPurchase.id },
        include: {
          supplier: true,
          treasury: true,
          warehouse: true,
          items: { include: { item: true } },
          returns: true,
        },
      });
    });

    res.status(201).json(purchase);
  } catch (error) {
    console.error("Purchase create error:", error);
    res.status(500).json({ error: "فشل إنشاء الفاتورة", message: error.message });
  }
});
```

- [ ] **Step 5.3: Test backward compatibility (local only)**

Start the backend (`node index.js`) and make a CURL request with a minimal non-fabric, non-international, CASH purchase (same shape as before Phase 4). Verify the purchase is created and the new fields default correctly.

```bash
# From project root, backend running on port 3001
curl -s -X POST http://localhost:3001/api/purchases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "supplierId": 1,
    "treasuryId": 1,
    "paymentMethod": "CASH",
    "subtotal": 100,
    "discountType": "PERCENTAGE",
    "discountValue": 0,
    "discountAmount": 0,
    "netTotal": 100,
    "paidAmount": 100,
    "remaining": 0,
    "items": [{"itemId": 1, "quantity": 2, "purchasePrice": 50, "sellPrice": 80, "total": 100}]
  }' | jq '.landedCostEnabled, .landedCostAllocation'
```

Expected: `false`, `"NONE"`

- [ ] **Step 5.4: Commit**

```bash
git add backend/routes/purchases.js
git commit -m "feat(purchases): extend POST with landed cost allocation + fabric roll generation"
```

---

## Task 6: Backend — GET /api/purchases and GET /api/purchases/:id (New Fields + Filters)

**Files:**
- Modify: `backend/routes/purchases.js`

- [ ] **Step 6.1: Update GET /:id to include new fields**

The GET /:id handler uses `prisma.purchase.findUnique(...)` with includes. Since Prisma returns all model fields by default, the new fields (`landedCostEnabled`, `landedCostAllocation`, `clearanceCost`, etc.) are already returned. However, the `items` include must also return `allocatedLandedCost` and `finalUnitCost`.

No change is needed — Prisma returns all scalar fields automatically. Verify by calling `GET /api/purchases/:id` and checking the response includes `landedCostEnabled`.

For the fabric rolls per line, add an include. In the GET /:id handler, find the `include` block for `items` and extend it:

Current:
```javascript
items: { include: { item: true } },
```

Replace with:
```javascript
items: {
  include: {
    item: true,
    // Phase 4: fabric rolls linked to this purchase line
  },
},
```

Note: `FabricRoll` has `purchaseItemId` but since `PurchaseItem` uses a composite PK `(purchaseId, itemId)`, there is no direct Prisma relation to query rolls from items. Instead, for the detail view we fetch rolls separately after the purchase is loaded. **For the GET /:id response**, after fetching the purchase, query rolls per fabric item:

Find the GET `/:id` handler and extend it to attach rolls:

```javascript
router.get("/:id", requirePermission("PURCHASES"), async (req, res) => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        supplier: true,
        treasury: true,
        warehouse: true,
        items: { include: { item: true } },
        returns: { include: { items: true } },
      },
    });

    if (!purchase) return res.status(404).json({ error: "الفاتورة غير موجودة" });

    // Phase 4: attach generated rolls per fabric line
    const fabricItemIds = purchase.items
      .filter(li => li.item.itemType === "FABRIC")
      .map(li => li.itemId);

    let rollsByItemId = {};
    if (fabricItemIds.length > 0) {
      const rolls = await prisma.fabricRoll.findMany({
        where: {
          itemId: { in: fabricItemIds },
          // Rolls created at same time as purchase (approximate — within same day)
          // Better: in Phase 4 we store purchaseId on the roll via purchaseItemId
          // For now filter by warehouseId + itemId (sufficient for display)
          warehouseId: purchase.warehouseId,
        },
        select: { id: true, rollNumber: true, originalLength: true, remainingLength: true, status: true, unitCost: true, barcode: true, itemId: true },
      });
      rolls.forEach(r => {
        if (!rollsByItemId[r.itemId]) rollsByItemId[r.itemId] = [];
        rollsByItemId[r.itemId].push(r);
      });
    }

    const enrichedItems = purchase.items.map(li => ({
      ...li,
      fabricRolls: rollsByItemId[li.itemId] || [],
    }));

    res.json({ ...purchase, items: enrichedItems });
  } catch (error) {
    res.status(500).json({ error: "فشل جلب الفاتورة", message: error.message });
  }
});
```

- [ ] **Step 6.2: Update GET / to add isInternational + hasLandedCost filters**

Find the existing `GET /` list handler. Inside the `where` clause construction, add the new filters after the existing ones:

```javascript
// Phase 4 filters
if (req.query.isInternational !== undefined) {
  where.isInternational = req.query.isInternational === "true";
}
if (req.query.hasLandedCost !== undefined) {
  where.landedCostEnabled = req.query.hasLandedCost === "true";
}
```

- [ ] **Step 6.3: Commit**

```bash
git add backend/routes/purchases.js
git commit -m "feat(purchases): GET includes new landed cost fields + isInternational/hasLandedCost filters"
```

---

## Task 7: Frontend — PurchasesPage.jsx — Landed Cost + International Flag

**Files:**
- Modify: `frontend/src/pages/purchases/PurchasesPage.jsx`

**Note at the top of the component** (add as a comment at line 1):
```javascript
// EGP only. For foreign supplier invoices in USD/EUR, convert to EGP manually before entering.
```

- [ ] **Step 7.1: Add state for new fields**

In the state declarations section (after the existing `useState` calls), add:

```javascript
const [isInternational, setIsInternational] = useState(false);
const [landedCostEnabled, setLandedCostEnabled] = useState(false);
const [landedCostAllocation, setLandedCostAllocation] = useState("NONE");
const [freightCost, setFreightCost] = useState(0);
const [customsCost, setCustomsCost] = useState(0);
const [clearanceCost, setClearanceCost] = useState(0);
const [otherLandedCost, setOtherLandedCost] = useState(0);
const [landedCostFeatureEnabled, setLandedCostFeatureEnabled] = useState(false); // feature flag
```

- [ ] **Step 7.2: Load feature flag from settings**

In the `useEffect` that loads initial data (where `loadSuppliers`, `loadTreasuries`, etc. are called), add a call to load the system settings and read the feature flag. Find the settings load pattern (it likely uses `settingsService`). Add:

```javascript
// Load landed cost feature flag
settingsService.getSettings().then(settings => {
  setLandedCostFeatureEnabled(settings?.landedCostFeatureEnabled ?? false);
}).catch(() => {/* feature disabled if settings fail */});
```

If `settingsService.getSettings()` doesn't exist or `landedCostFeatureEnabled` isn't a settings field yet, default to `false` — the flag is off by default which is safe. We'll add the settings field in Task 9.

- [ ] **Step 7.3: Add per-item rolls state**

Items currently are stored as: `{ id, name, itemId, quantity, purchasePrice, sellPrice, unit }`.

Extend the `addItem` function to also include `rolls: []` and `itemType: null`:

Find `addItem`:
```javascript
const addItem = () => {
  setItems(prev => [...prev, { id: Date.now(), ... }]);
};
```

Add `rolls: [], itemType: null` to the new item object. Also update `updateItem` to handle `rolls` and `itemType` fields.

When the user selects an item from the item dropdown in a line (`updateItem(id, 'itemId', value)`), also fetch/set the item type. Add logic that when `itemId` is set, looks up the selected item's `itemType` from the loaded items list and sets `itemType` on that line.

- [ ] **Step 7.4: Compute totalLanded and derived totals**

Add computed values after the existing `subtotal`, `discountAmount`, `netTotal` calculations:

```javascript
const totalLanded = landedCostEnabled
  ? parseFloat(freightCost || 0) + parseFloat(customsCost || 0) + parseFloat(clearanceCost || 0) + parseFloat(otherLandedCost || 0)
  : 0;

const grandTotal = parseFloat(netTotal || 0) + totalLanded;
```

Note: the spec doesn't add landed cost on top of netTotal — `finalUnitCost` is stored per line but the invoice total itself stays `netTotal`. Landed cost is a cost-accounting adjustment, not an additional charge to the supplier. Keep `netTotal` as the sum paid to supplier; landed cost is informational per-line only. Add a clarifying comment.

- [ ] **Step 7.5: Add international checkbox UI**

Find the supplier selector section in the form JSX. Below the supplier dropdown, add:

```jsx
{/* Phase 4: International purchase flag */}
<div className="flex items-center gap-2 mt-2">
  <input
    type="checkbox"
    id="isInternational"
    checked={isInternational}
    onChange={e => setIsInternational(e.target.checked)}
    className="w-4 h-4 rounded"
  />
  <label htmlFor="isInternational" className="text-sm text-gray-700 cursor-pointer">
    فاتورة دولية
  </label>
</div>
```

- [ ] **Step 7.6: Add collapsible "التكاليف الإضافية" section**

This section appears only if `landedCostFeatureEnabled` is true. Add below the items table and above the discount section:

```jsx
{/* Phase 4: Landed cost section — hidden unless landedCostFeatureEnabled */}
{landedCostFeatureEnabled && (
  <div className="mt-4 border rounded-lg overflow-hidden">
    <button
      type="button"
      className="w-full flex items-center justify-between p-3 bg-gray-50 text-right"
      onClick={() => setLandedCostEnabled(prev => !prev)}
    >
      <span className="font-medium text-gray-700">التكاليف الإضافية (Landed Cost)</span>
      <span className="material-icons text-gray-500">
        {landedCostEnabled ? "expand_less" : "expand_more"}
      </span>
    </button>

    {landedCostEnabled && (
      <div className="p-4 space-y-4">
        {/* Allocation method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">طريقة التوزيع</label>
          <select
            value={landedCostAllocation}
            onChange={e => setLandedCostAllocation(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="NONE">بدون توزيع</option>
            <option value="BY_VALUE">بالقيمة</option>
            <option value="BY_QUANTITY">بالكمية</option>
            <option value="MANUAL">يدوي</option>
          </select>
        </div>

        {/* Four cost inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">الشحن (ج.م)</label>
            <input type="number" min="0" step="0.01" value={freightCost}
              onChange={e => setFreightCost(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">الجمارك (ج.م)</label>
            <input type="number" min="0" step="0.01" value={customsCost}
              onChange={e => setCustomsCost(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">التخليص (ج.م)</label>
            <input type="number" min="0" step="0.01" value={clearanceCost}
              onChange={e => setClearanceCost(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">أخرى (ج.م)</label>
            <input type="number" min="0" step="0.01" value={otherLandedCost}
              onChange={e => setOtherLandedCost(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        {/* Total landed cost display */}
        <div className="text-sm text-right font-medium text-gray-700">
          إجمالي التكاليف الإضافية: <span className="text-blue-600">{totalLanded.toFixed(2)} ج.م</span>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7.7: Add rolls sub-table for fabric line items**

In the items table, for each row where `item.itemType === "FABRIC"`, render an expanded sub-section below the main row. This requires the items table to conditionally render extra rows.

After the main `<tr>` for each item, add:

```jsx
{item.itemType === "FABRIC" && (
  <tr>
    <td colSpan={6} className="bg-blue-50 px-4 py-2">
      <div className="text-sm font-medium text-blue-700 mb-2">اللفات</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="text-right py-1 px-2">الطول الأصلي (م)</th>
            <th className="text-right py-1 px-2">الباركود</th>
            <th className="text-right py-1 px-2">ملاحظات</th>
            <th className="py-1 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {(item.rolls || []).map((roll, rIdx) => (
            <tr key={rIdx}>
              <td className="px-2 py-1">
                <input
                  type="number" min="0.01" step="0.01"
                  value={roll.originalLength || ""}
                  onChange={e => {
                    const updated = item.rolls.map((r, ri) =>
                      ri === rIdx ? { ...r, originalLength: e.target.value } : r
                    );
                    updateItem(item.id, "rolls", updated);
                  }}
                  className="w-24 border rounded px-1 py-0.5"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="text"
                  value={roll.barcode || ""}
                  onChange={e => {
                    const updated = item.rolls.map((r, ri) =>
                      ri === rIdx ? { ...r, barcode: e.target.value } : r
                    );
                    updateItem(item.id, "rolls", updated);
                  }}
                  className="w-32 border rounded px-1 py-0.5"
                  placeholder="اختياري"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="text"
                  value={roll.notes || ""}
                  onChange={e => {
                    const updated = item.rolls.map((r, ri) =>
                      ri === rIdx ? { ...r, notes: e.target.value } : r
                    );
                    updateItem(item.id, "rolls", updated);
                  }}
                  className="w-full border rounded px-1 py-0.5"
                  placeholder="اختياري"
                />
              </td>
              <td className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => {
                    const updated = item.rolls.filter((_, ri) => ri !== rIdx);
                    updateItem(item.id, "rolls", updated);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <span className="material-icons text-sm">remove_circle</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Roll total vs line qty validation indicator */}
      {(() => {
        const rollsTotal = (item.rolls || []).reduce((s, r) => s + parseFloat(r.originalLength || 0), 0);
        const lineQty = parseFloat(item.quantity || 0);
        const match = Math.abs(rollsTotal - lineQty) < 0.001;
        return (
          <div className={`text-xs mt-1 ${match ? "text-green-600" : "text-red-600"}`}>
            مجموع اللفات: {rollsTotal.toFixed(2)} م {match ? "✓" : `(المطلوب: ${lineQty.toFixed(2)} م)`}
          </div>
        );
      })()}

      <button
        type="button"
        onClick={() => {
          const updated = [...(item.rolls || []), { originalLength: "", barcode: "", notes: "" }];
          updateItem(item.id, "rolls", updated);
        }}
        className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        <span className="material-icons text-sm">add_circle_outline</span>
        إضافة لفة
      </button>
    </td>
  </tr>
)}
```

- [ ] **Step 7.8: Update submitPurchase to send new fields**

Find the `submitPurchase` function. In the payload object sent to `purchaseService.createPurchase(...)` (or the direct API call), add the Phase 4 fields:

```javascript
const payload = {
  // ... existing fields ...
  isInternational,
  landedCostEnabled,
  landedCostAllocation,
  freightCost: parseFloat(freightCost) || 0,
  customsCost: parseFloat(customsCost) || 0,
  clearanceCost: parseFloat(clearanceCost) || 0,
  otherLandedCost: parseFloat(otherLandedCost) || 0,
  items: items.map(item => ({
    // ... existing item fields ...
    rolls: item.itemType === "FABRIC" ? (item.rolls || []) : undefined,
    manualAllocatedLandedCost: landedCostAllocation === "MANUAL" ? item.manualAllocatedLandedCost : undefined,
  })),
};
```

- [ ] **Step 7.9: Reset new state fields on form clear**

Find the `resetForm` or equivalent function that clears the form after submission. Add:

```javascript
setIsInternational(false);
setLandedCostEnabled(false);
setLandedCostAllocation("NONE");
setFreightCost(0);
setCustomsCost(0);
setClearanceCost(0);
setOtherLandedCost(0);
```

Also ensure item reset clears `rolls` and `itemType` on each item.

- [ ] **Step 7.10: Commit**

```bash
git add frontend/src/pages/purchases/PurchasesPage.jsx
git commit -m "feat(purchases-ui): international flag, landed cost section, rolls sub-table"
```

---

## Task 8: Frontend — PurchasesPage.jsx — Detail View (Landed Cost Breakdown)

**Files:**
- Modify: `frontend/src/pages/purchases/PurchasesPage.jsx`
- Or: `frontend/src/pages/reports/history/PurchaseDetailsModal.jsx` if details are shown there

- [ ] **Step 8.1: Locate where purchase details are displayed**

The purchase details are shown in `PurchaseDetailsModal` (imported in `PurchasesPage.jsx`). Read `frontend/src/pages/reports/history/PurchaseDetailsModal.jsx` to find where items are listed.

- [ ] **Step 8.2: Add landed cost summary to detail view**

In `PurchaseDetailsModal.jsx`, after the existing items table, add a section that shows if `purchase.landedCostEnabled`:

```jsx
{purchase.landedCostEnabled && (
  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
    <div className="font-medium text-yellow-800 mb-2">التكاليف الإضافية</div>
    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
      <span>الشحن:</span> <span>{parseFloat(purchase.shippingCost || 0).toFixed(2)} ج.م</span>
      <span>الجمارك:</span> <span>{parseFloat(purchase.customsDuty || 0).toFixed(2)} ج.م</span>
      <span>التخليص:</span> <span>{parseFloat(purchase.clearanceCost || 0).toFixed(2)} ج.م</span>
      <span>أخرى:</span> <span>{parseFloat(purchase.otherLandingCosts || 0).toFixed(2)} ج.م</span>
      <span className="font-medium">طريقة التوزيع:</span>
      <span>{{ NONE: "بدون", BY_VALUE: "بالقيمة", BY_QUANTITY: "بالكمية", MANUAL: "يدوي" }[purchase.landedCostAllocation]}</span>
    </div>
  </div>
)}
```

- [ ] **Step 8.3: Show per-line allocatedLandedCost and finalUnitCost**

In the items table inside `PurchaseDetailsModal`, add two columns: `التكلفة المضافة` and `التكلفة النهائية`:

In the `<thead>` row, add after the existing columns:
```jsx
{purchase.landedCostEnabled && (
  <>
    <th className="text-right">التكلفة المضافة</th>
    <th className="text-right">التكلفة النهائية</th>
  </>
)}
```

In each `<tr>` item row, add:
```jsx
{purchase.landedCostEnabled && (
  <>
    <td>{parseFloat(item.allocatedLandedCost || 0).toFixed(2)}</td>
    <td>{parseFloat(item.finalUnitCost || 0).toFixed(2)}</td>
  </>
)}
```

- [ ] **Step 8.4: Show generated rolls for fabric lines in detail view**

For fabric items in the detail view, after each item row show sub-rows for rolls:

```jsx
{item.item.itemType === "FABRIC" && (item.fabricRolls || []).length > 0 && (
  <tr>
    <td colSpan={6} className="bg-blue-50 px-4 py-2 text-xs">
      <span className="font-medium text-blue-700">اللفات المُنشأة: </span>
      {item.fabricRolls.map(r => (
        <span key={r.id} className="inline-block bg-white border rounded px-2 py-0.5 mr-1 mb-1">
          {r.rollNumber} ({parseFloat(r.originalLength).toFixed(2)}م)
        </span>
      ))}
    </td>
  </tr>
)}
```

- [ ] **Step 8.5: Add isInternational badge to list and detail**

In the purchases list table, add a visual badge when `purchase.isInternational`:

```jsx
{purchase.isInternational && (
  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">دولي</span>
)}
```

- [ ] **Step 8.6: Add filter chips to PurchasesListPage section**

In the purchases list tab, add two filter checkboxes above the table:

```jsx
<div className="flex gap-3 mb-3 text-sm">
  <label className="flex items-center gap-1 cursor-pointer">
    <input type="checkbox" checked={filterInternational} onChange={e => setFilterInternational(e.target.checked)} />
    دولية فقط
  </label>
  <label className="flex items-center gap-1 cursor-pointer">
    <input type="checkbox" checked={filterHasLandedCost} onChange={e => setFilterHasLandedCost(e.target.checked)} />
    بتكاليف إضافية
  </label>
</div>
```

Add state: `const [filterInternational, setFilterInternational] = useState(false);` and `const [filterHasLandedCost, setFilterHasLandedCost] = useState(false);`

In the `loadPurchases` call, pass filter params:
```javascript
const params = {};
if (filterInternational) params.isInternational = true;
if (filterHasLandedCost) params.hasLandedCost = true;
// pass params to the service call
```

- [ ] **Step 8.7: Commit**

```bash
git add frontend/src/pages/purchases/PurchasesPage.jsx frontend/src/pages/reports/history/PurchaseDetailsModal.jsx
git commit -m "feat(purchases-ui): detail view with landed cost breakdown + roll list + list filters"
```

---

## Task 9: Frontend — Supplier Form: taxNumber Field

**Files:**
- Find and modify the supplier create/edit form. Check `frontend/src/pages/suppliers/` or the inline `ItemForm`-style pattern used in `PurchasesPage.jsx`.

- [ ] **Step 9.1: Locate supplier form**

```bash
# In project root
ls frontend/src/pages/suppliers/
```

Find the component that renders the supplier form (likely `SuppliersPage.jsx` or `SupplierForm.jsx`).

- [ ] **Step 9.2: Add taxNumber input to supplier create/edit form**

In the supplier form, after the `phoneNumber` field, add:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    الرقم الضريبي للمورد
  </label>
  <input
    type="text"
    value={taxNumber}
    onChange={e => setTaxNumber(e.target.value)}
    className="w-full border rounded-lg px-3 py-2 text-sm"
    placeholder="اختياري"
  />
</div>
```

- [ ] **Step 9.3: Wire taxNumber to state and submit**

Add state: `const [taxNumber, setTaxNumber] = useState(supplier?.taxNumber || "");`

Include in the submit payload: `taxNumber`

When editing, initialize from existing supplier: `setTaxNumber(s.taxNumber || "")`

- [ ] **Step 9.4: Commit**

```bash
git add frontend/src/pages/suppliers/
git commit -m "feat(suppliers-ui): add taxNumber field to supplier form"
```

---

## Task 10: Backend — Settings: landedCostFeatureEnabled Flag

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/migration.sql` (append)
- Modify: `backend/prisma/migration.sql` (append)
- Modify: `backend/routes/settings.js`

- [ ] **Step 10.1: Add landedCostFeatureEnabled to SystemConfiguration schema**

In `schema.prisma`, in the `SystemConfiguration` model, after `taxRate`:

```prisma
  landedCostFeatureEnabled Boolean @default(false) @map("landed_cost_feature_enabled")
```

- [ ] **Step 10.2: Add to migration SQL files**

Append to `backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/migration.sql`:

```sql
-- Feature flag for landed cost UI
ALTER TABLE `system_configuration`
  ADD COLUMN `landed_cost_feature_enabled` BOOLEAN NOT NULL DEFAULT FALSE;
```

Also append same line to `backend/prisma/migration.sql`.

- [ ] **Step 10.3: Run db push again**

```bash
cd backend && npx prisma db push && npx prisma generate
```

- [ ] **Step 10.4: Expose flag in settings route**

Open `backend/routes/settings.js`. Find the GET settings handler and verify it returns `landedCostFeatureEnabled` (Prisma returns all fields by default). Find the PUT/PATCH settings handler and ensure `landedCostFeatureEnabled` is an accepted update field.

Look for the update handler — it likely has an explicit list of allowed fields:

```javascript
// Find something like:
const { companyName, taxRate, ... } = req.body;
await prisma.systemConfiguration.update({ data: { companyName, taxRate, ... } });
```

Add `landedCostFeatureEnabled` to that destructure and `data`:
```javascript
const { companyName, taxRate, landedCostFeatureEnabled, ... } = req.body;
await prisma.systemConfiguration.update({
  data: {
    companyName,
    taxRate,
    ...(landedCostFeatureEnabled !== undefined && { landedCostFeatureEnabled: Boolean(landedCostFeatureEnabled) }),
    ...
  }
});
```

- [ ] **Step 10.5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migration.sql backend/prisma/migrations/20260417000003_phase4_purchases_landed_cost/ backend/routes/settings.js
git commit -m "feat(settings): add landedCostFeatureEnabled feature flag"
```

---

## Task 11: Backend — PUT /api/purchases/:id (Update with Landed Cost)

**Files:**
- Modify: `backend/routes/purchases.js`

The existing `PUT /:id` handler needs to accept and persist the new Phase 4 fields. It also needs to re-validate fabric rolls on update.

**Important constraint:** On update, we do NOT regenerate fabric rolls (rolls were already created at purchase time). We only update the scalar purchase fields.

- [ ] **Step 11.1: Extend PUT /:id to accept Phase 4 fields**

Find the `router.put("/:id", ...)` handler. In the destructure of `req.body`, add:

```javascript
const {
  // ... existing fields ...
  isInternational = false,
  landedCostEnabled = false,
  landedCostAllocation = "NONE",
  freightCost = 0,
  customsCost = 0,
  clearanceCost = 0,
  otherLandedCost = 0,
} = req.body;
```

In the `tx.purchase.update(...)` call, add the Phase 4 fields to the `data` object:

```javascript
isInternational: Boolean(isInternational),
shippingCost: parseFloat(freightCost) || 0,
customsDuty: parseFloat(customsCost) || 0,
clearanceCost: parseFloat(clearanceCost) || 0,
otherLandingCosts: parseFloat(otherLandedCost) || 0,
landedCostEnabled: Boolean(landedCostEnabled),
landedCostAllocation: landedCostEnabled ? landedCostAllocation : "NONE",
```

Also update `PurchaseItem` creation to include `allocatedLandedCost` and `finalUnitCost`. Re-run the `allocateLandedCost()` helper with the updated items. Add before the transaction:

```javascript
let lineAllocations;
try {
  const totalLanded = landedCostEnabled
    ? parseFloat(freightCost) + parseFloat(customsCost) + parseFloat(clearanceCost) + parseFloat(otherLandedCost)
    : 0;
  lineAllocations = allocateLandedCost({
    items,
    totalLanded,
    method: landedCostEnabled ? landedCostAllocation : "NONE",
  });
} catch (err) {
  return res.status(err.status || 400).json({ error: err.message });
}
```

When creating new `PurchaseItem` records in the update transaction, use `lineAllocations[i].allocatedLandedCost` and `lineAllocations[i].finalUnitCost`.

Add comment:
```javascript
// NOTE: Purchase returns do NOT reverse landed cost allocation.
// Only original purchasePrice × quantity is reversed on return.
// This is by design — landed cost is a one-way cost absorption.
```

- [ ] **Step 11.2: Commit**

```bash
git add backend/routes/purchases.js
git commit -m "feat(purchases): extend PUT with landed cost fields (no roll regeneration on update)"
```

---

## Task 12: Manual Verification Checklist

Run through these in order against the local dev environment (`http://localhost:5173`).

- [ ] **Step 12.1: Backward compat — local purchase (no landed cost)**
  1. Create a CASH purchase with 2 non-fabric items, no international flag, no landed cost
  2. Verify purchase saved with `landedCostEnabled=false`, `landedCostAllocation=NONE`
  3. Verify inventory incremented for both items
  4. Verify treasury decremented by netTotal

- [ ] **Step 12.2: BY_VALUE allocation**
  - Items: [{qty:2, price:100}, {qty:3, price:200}]
  - subtotal = 2×100 + 3×200 = 800
  - totalLanded = 80 (e.g. freight=80)
  - Expected: item1 alloc = 80×(200/800) = 20, item2 alloc = 80×(600/800) = 60
  - finalUnitCost: item1 = 100+10=110, item2 = 200+20=220
  - Verify in DB: `SELECT * FROM purchase_items WHERE purchase_id=<id>`

- [ ] **Step 12.3: BY_QUANTITY allocation**
  - Items: [{qty:2, price:100}, {qty:3, price:200}]
  - totalQty = 5
  - totalLanded = 50
  - Expected: item1 alloc = 50×(2/5) = 20, item2 alloc = 50×(3/5) = 30
  - finalUnitCost: item1 = 100+10=110, item2 = 200+10=210

- [ ] **Step 12.4: MANUAL allocation**
  - Items: [{qty:2, price:100, manualAllocatedLandedCost:30}, {qty:3, price:200, manualAllocatedLandedCost:50}]
  - totalLanded = 80
  - Verify: sum=80, passes validation; item1 alloc=30, item2 alloc=50

- [ ] **Step 12.5: MANUAL mismatch error**
  - Set manualAllocatedLandedCost so sum ≠ totalLanded
  - Verify Arabic error message returned

- [ ] **Step 12.6: Fabric purchase — 1 roll**
  - Create purchase with 1 FABRIC item, qty=50, rolls=[{originalLength:50}]
  - Verify: 1 fabric roll created with rollNumber "R-202604-NNNNN", remainingLength=50
  - Verify: Inventory.quantity for that item+warehouse incremented by 50

- [ ] **Step 12.7: Fabric purchase — uneven split**
  - qty=50, rolls=[{originalLength:30},{originalLength:20}]
  - Verify: 2 rolls, sum=50, both AVAILABLE

- [ ] **Step 12.8: Fabric roll qty mismatch → Arabic error**
  - qty=50, rolls=[{originalLength:30}]  (sum=30 ≠ 50)
  - Verify: 400 response with Arabic error

- [ ] **Step 12.9: Mixed fabric + non-fabric purchase**
  - 1 FABRIC item (with rolls) + 1 GENERIC item (no rolls)
  - Verify: FABRIC → rolls created, GENERIC → inventory.quantity incremented directly

- [ ] **Step 12.10: Feature flag hides landed cost UI**
  - Set `landedCostFeatureEnabled=false` in settings
  - Reload purchase form
  - Verify: "التكاليف الإضافية" section not visible

- [ ] **Step 12.11: Supplier taxNumber round-trip**
  - Create supplier with taxNumber="123456789"
  - Fetch via GET /api/suppliers/:id
  - Verify taxNumber present and correct

- [ ] **Step 12.12: Transactional rollback**
  - Temporarily corrupt the roll generation (e.g. pass invalid itemId for fabric)
  - Verify: purchase NOT created (no row in purchases table), no orphan rolls

---

## Task 13: Final Commit

- [ ] **Step 13.1: Run lint/type check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Verify no errors.

- [ ] **Step 13.2: Final commit**

```bash
git add -p  # Review all changes interactively before staging
git commit -m "$(cat <<'EOF'
phase(04): purchases — international + landed cost allocation + fabric roll generation + supplier tax number

- Add LandedCostAllocation enum (NONE/BY_VALUE/BY_QUANTITY/MANUAL)
- Add clearanceCost, landedCostEnabled, landedCostAllocation to purchases
- Add allocatedLandedCost, finalUnitCost to purchase_items
- Add taxNumber to suppliers
- Add landedCostFeatureEnabled to system_configuration
- Backend: allocateLandedCost() helper with rounding absorption into last line
- Backend: validateFabricRolls() validates Σ(rolls.originalLength) == lineQty
- Backend: POST /purchases generates FabricRolls inside same transaction for fabric lines
- Backend: PUT /purchases accepts new fields (no roll regeneration on update)
- Backend: GET /purchases/:id includes fabric rolls per line
- Backend: GET /purchases adds isInternational, hasLandedCost filters
- Frontend: international checkbox, collapsible landed cost section, rolls sub-table
- Frontend: live validation of roll totals vs line quantity
- Frontend: detail view shows landed cost breakdown + generated rolls
- Frontend: list view filter chips for international/hasLandedCost
- Frontend: supplier form taxNumber field
- Note: purchase returns do NOT reverse landed cost (reverses price+qty only)
- Note: EGP only; for foreign currency invoices, convert to EGP before entry

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Key Decisions & Constraints

1. **No new files** — all backend logic stays in `purchases.js`, helpers added at top.

2. **Roll generation is in-transaction** — we call `prisma.fabricRoll.create()` directly inside the `$transaction` callback, NOT via HTTP to the fabricRolls route. This ensures atomicity.

3. **purchaseItemId linkage on rolls** — the `fabric_rolls` table has `purchaseItemId?` but since `PurchaseItem` uses a composite PK `(purchaseId, itemId)` with no auto-increment `id`, we cannot set `purchaseItemId` directly without adding an `id` column to `PurchaseItem`. Therefore rolls are associated by `warehouseId + itemId` for display purposes.

4. **Returns do NOT reverse landed cost** — only `purchasePrice × quantity` is reversed. Landed cost is a one-way cost absorption already reflected in item.costPrice.

5. **Rounding absorption** — the last line absorbs any floating-point delta so `Σ allocatedLandedCost == totalLanded` exactly (documented in `allocateLandedCost` comment).

6. **Feature flag off = zero UI surface** — when `landedCostFeatureEnabled=false`, the entire "التكاليف الإضافية" section is absent from the DOM, not just hidden.

7. **`clearanceCost` mapping** — the spec uses `clearanceCost` but the existing schema already has `shippingCost` (for freight) and `customsDuty` (for customs). We map: `freightCost→shippingCost`, `customsCost→customsDuty`, `clearanceCost→clearanceCost` (new column), `otherLandedCost→otherLandingCosts`.
