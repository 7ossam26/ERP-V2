# Phase 6 — POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full POS sale flow with tier-based pricing, cashier override, fabric roll picker, Arabic receipts, hold/cancel/refund — extending the existing ElGhonemy POS system.

**Architecture:** Extend `backend/routes/sales.js` with a rewritten `POST /api/sales` that follows the strict 8-step transaction design in `docs/superpowers/plans/phase-6-pos.md`. Extract transaction helpers into `backend/services/posSaleService.js`. Create `backend/services/pricingService.js` for tier resolution. Frontend extends the existing 2367-line `POSPage.jsx` with fabric roll picker integration, tier override, per-line price override, enhanced search, and a new Arabic receipt template.

**Tech Stack:** Node.js/Express + Prisma (MySQL), React + Vite + Tailwind CSS, react-to-print for receipts

**Transaction Design Reference:** `docs/superpowers/plans/phase-6-pos.md` — read before implementing Task 3. The step ordering, locking, and rollback strategy are fixed.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `backend/services/pricingService.js` | Tier-based price resolution: `resolveBulkPrices(tx, clientId, itemIds, tierOverride)` |
| `backend/services/posSaleService.js` | Transaction helpers: loadAndLock, validate, applyStockChanges, createSaleAndItems, backfillRollCuts, updateTreasury |
| `frontend/src/pages/pos/ReceiptPrintTemplate.jsx` | Arabic RTL 80mm thermal receipt component |
| `frontend/src/pages/pos/TierOverrideModal.jsx` | Small modal for selecting tier override + reason |
| `frontend/src/pages/pos/PriceOverrideModal.jsx` | Small modal for per-line price override + reason |

### Modified Files
| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add `taxEnabledOnSales` Boolean to SystemConfiguration |
| `backend/routes/sales.js` | Rewrite POST handler to use posSaleService; extend refund to reject fabric; extend delete to reverse rolls; add GET /:id/receipt |
| `backend/routes/settings.js` | Expose `taxEnabledOnSales` in GET/PUT |
| `frontend/src/services/salesService.js` | Add `getReceipt(id)` method |
| `frontend/src/pages/pos/POSPage.jsx` | Fabric roll picker, tier override, price override, enhanced search, keyboard shortcuts, receipt integration, hold/recall revalidation, checkout payload changes |
| `frontend/src/pages/pos/RefundModal.jsx` | Show Arabic rejection message for fabric line refund attempts |

---

## Task 1: Schema Migration — Add `taxEnabledOnSales`

**Files:**
- Modify: `backend/prisma/schema.prisma` (SystemConfiguration model, ~line 785)

- [ ] **Step 1: Add field to schema**

In `backend/prisma/schema.prisma`, inside the `SystemConfiguration` model, after the `taxRate` line, add:

```prisma
  taxEnabledOnSales Boolean @default(true) @map("tax_enabled_on_sales")
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_tax_enabled_on_sales
```

Expected: Migration succeeds. New column `tax_enabled_on_sales` added to `system_configuration` table with default `true`.

- [ ] **Step 3: Verify settings route exposes the field**

Read `backend/routes/settings.js`. The GET and PUT endpoints likely return all SystemConfiguration fields. If not, add `taxEnabledOnSales` to the select/update. The existing pattern auto-includes all scalar fields, so this should work without changes. Verify by starting the backend and hitting `GET /api/settings`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "schema: add taxEnabledOnSales to SystemConfiguration"
```

---

## Task 2: Create Pricing Service

**Files:**
- Create: `backend/services/pricingService.js`

- [ ] **Step 1: Create the pricing service**

Create `backend/services/pricingService.js`:

```js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Resolve prices for a batch of items based on client tier.
 *
 * Resolution order per item:
 *   1. PriceTier matching (tierName, minQty <= quantity, isActive) — highest minQty wins
 *   2. Item.price (base sell price)
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx - Prisma transaction client
 * @param {number|null} clientId - Client ID (null = walk-in → RETAIL)
 * @param {Array<{itemId: number, quantity: number}>} lines - Items with quantities
 * @param {string|null} tierOverride - "RETAIL" or "WHOLESALE" (overrides client.tier)
 * @returns {Promise<Map<number, {effectivePrice: Decimal, priceSource: string, tierName: string|null}>>}
 */
async function resolveBulkPrices(tx, clientId, lines, tierOverride) {
  // Determine effective tier
  let tier = "RETAIL";
  if (tierOverride) {
    tier = tierOverride;
  } else if (clientId) {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { tier: true },
    });
    if (client?.tier) tier = client.tier;
  }

  const itemIds = lines.map((l) => l.itemId).filter(Boolean);
  if (itemIds.length === 0) return new Map();

  // Batch-load all items and their price tiers in one query
  const items = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      price: true,
      priceTiers: {
        where: { isActive: true },
        orderBy: { minQty: "desc" },
      },
    },
  });

  const result = new Map();

  for (const item of items) {
    const line = lines.find((l) => l.itemId === item.id);
    const qty = line ? parseFloat(line.quantity) : 1;

    // Find best matching tier price: tierName matches and minQty <= requested qty
    const matchingTier = item.priceTiers.find(
      (pt) =>
        pt.tierName === tier && parseFloat(pt.minQty) <= qty
    );

    if (matchingTier) {
      result.set(item.id, {
        effectivePrice: matchingTier.price,
        priceSource: "tier_price",
        tierName: matchingTier.tierName,
      });
    } else {
      result.set(item.id, {
        effectivePrice: item.price,
        priceSource: "base_price",
        tierName: null,
      });
    }
  }

  return result;
}

module.exports = { resolveBulkPrices };
```

- [ ] **Step 2: Verify it loads without errors**

```bash
cd backend && node -e "const ps = require('./services/pricingService'); console.log('OK:', typeof ps.resolveBulkPrices)"
```

Expected: `OK: function`

- [ ] **Step 3: Commit**

```bash
git add backend/services/pricingService.js
git commit -m "feat(pos): add pricingService for tier-based price resolution"
```

---

## Task 3: Create POS Sale Service (Backend Transaction Helpers)

**Files:**
- Create: `backend/services/posSaleService.js`

**IMPORTANT:** Read `docs/superpowers/plans/phase-6-pos.md` (transaction design) before implementing. The step ordering is fixed.

- [ ] **Step 1: Create the service file with all helpers**

Create `backend/services/posSaleService.js`:

```js
const { Prisma } = require("@prisma/client");
const { resolveBulkPrices } = require("./pricingService");

// ── Sale number generator (reuses existing pattern) ──

async function generateSaleNumber(tx) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999);

  const count = await tx.sale.count({
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
      saleNumber: { not: { startsWith: "REFUND-" } },
    },
  });

  return `SALE-${year}${month}-${String(count + 1).padStart(5, "0")}`;
}

// ── STEP 2: Load + Lock ──

async function loadAndLock(tx, body, user) {
  const { clientId, items: lineItems } = body;
  const warehouseId = user.warehouseId;

  // Load client
  let client = null;
  if (clientId) {
    client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) throw Object.assign(new Error("العميل غير موجود"), { status: 400 });
  }

  // Load items
  const itemIds = lineItems.filter((l) => l.itemId).map((l) => l.itemId);
  const items = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, price: true, itemType: true, unit: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  // Separate fabric vs non-fabric lines
  const fabricLines = lineItems.filter((l) => {
    const item = itemMap.get(l.itemId);
    return item && item.itemType === "FABRIC";
  });
  const nonFabricLines = lineItems.filter((l) => {
    const item = itemMap.get(l.itemId);
    return item && item.itemType !== "FABRIC";
  });

  // Lock fabric rolls with FOR UPDATE
  const rollsByLine = new Map();
  for (const line of fabricLines) {
    if (!line.rollAllocations || line.rollAllocations.length === 0) {
      throw Object.assign(
        new Error(`يجب تحديد لفات القماش للصنف: ${itemMap.get(line.itemId)?.name}`),
        { status: 400 }
      );
    }
    const rollIds = line.rollAllocations.map((ra) => ra.rollId);
    const rolls = await tx.$queryRaw`
      SELECT id, remaining_length, status, item_id, warehouse_id
      FROM fabric_rolls
      WHERE id IN (${Prisma.join(rollIds)})
      FOR UPDATE
    `;
    rollsByLine.set(line.itemId, { line, rolls, allocations: line.rollAllocations });
  }

  // Lock inventory rows for non-fabric items
  const inventoryByLine = new Map();
  for (const line of nonFabricLines) {
    const rows = await tx.$queryRaw`
      SELECT item_id, warehouse_id, quantity
      FROM inventory
      WHERE item_id = ${line.itemId} AND warehouse_id = ${warehouseId}
      FOR UPDATE
    `;
    inventoryByLine.set(line.itemId, {
      line,
      inventory: rows[0] || null,
    });
  }

  // Lock treasury
  const treasuryId = user.treasuryId;
  await tx.$queryRaw`
    SELECT id, balance FROM treasuries WHERE id = ${treasuryId} FOR UPDATE
  `;

  return { client, itemMap, rollsByLine, inventoryByLine, warehouseId, treasuryId };
}

// ── STEP 3: Validate ──

function validateSalePayload(body, context) {
  const { items: lineItems, tierOverride, tierOverrideReason } = body;
  const { itemMap, rollsByLine, inventoryByLine } = context;

  // Tier override requires reason
  if (tierOverride && (!tierOverrideReason || !tierOverrideReason.trim())) {
    throw Object.assign(
      new Error("يجب تحديد سبب تغيير مستوى التسعير"),
      { status: 400 }
    );
  }

  for (const line of lineItems) {
    const item = itemMap.get(line.itemId);
    if (!item) {
      throw Object.assign(new Error(`الصنف غير موجود: ${line.itemId}`), { status: 400 });
    }

    if (item.itemType === "FABRIC") {
      // Validate roll allocations sum == quantity
      const allocSum = line.rollAllocations.reduce(
        (s, ra) => s + parseFloat(ra.length), 0
      );
      const qty = parseFloat(line.quantity);
      if (Math.abs(allocSum - qty) > 0.001) {
        throw Object.assign(
          new Error(`إجمالي الأطوال المحددة (${allocSum}) لا يساوي الكمية المطلوبة (${qty}) للصنف: ${item.name}`),
          { status: 400 }
        );
      }

      // Validate each roll allocation
      const rollData = rollsByLine.get(line.itemId);
      for (const alloc of line.rollAllocations) {
        const roll = rollData.rolls.find((r) => Number(r.id) === alloc.rollId);
        if (!roll) {
          throw Object.assign(
            new Error(`اللفة غير موجودة: ${alloc.rollId}`),
            { status: 400 }
          );
        }
        if (!["AVAILABLE", "PARTIALLY_CUT"].includes(roll.status)) {
          throw Object.assign(
            new Error(`اللفة ${alloc.rollId} غير متاحة (الحالة: ${roll.status})`),
            { status: 400 }
          );
        }
        const remaining = parseFloat(roll.remaining_length);
        if (parseFloat(alloc.length) > remaining) {
          throw Object.assign(
            new Error(`الطول المتاح غير كافٍ: ${remaining} متر في اللفة ${alloc.rollId}`),
            { status: 400 }
          );
        }
      }
    } else {
      // Non-fabric: validate stock
      const invData = inventoryByLine.get(line.itemId);
      const available = invData?.inventory ? parseFloat(invData.inventory.quantity) : 0;
      const qty = parseFloat(line.quantity);
      if (qty > available) {
        throw Object.assign(
          new Error(`الكمية المتاحة غير كافية: ${available} ${item.unit || ""} من ${item.name}`),
          { status: 400 }
        );
      }
    }

    // Price override requires reason
    if (line.unitPrice !== undefined && line.unitPrice !== null) {
      // Will be checked against resolved price in Step 4
      // Just validate reason exists if provided
      if (line.priceOverrideReason !== undefined && !line.priceOverrideReason?.trim()) {
        throw Object.assign(
          new Error(`سبب تعديل السعر مطلوب للصنف: ${item.name}`),
          { status: 400 }
        );
      }
    }
  }
}

// ── STEP 4: Resolve prices ──

async function resolveLinePrices(tx, body, context) {
  const { items: lineItems, tierOverride, clientId } = body;
  const { itemMap } = context;

  const pricingLines = lineItems
    .filter((l) => l.itemId)
    .map((l) => ({ itemId: l.itemId, quantity: l.quantity }));

  const resolved = await resolveBulkPrices(tx, clientId || null, pricingLines, tierOverride || null);

  return lineItems.map((line) => {
    const resolvedPrice = resolved.get(line.itemId);
    const serverPrice = resolvedPrice
      ? parseFloat(resolvedPrice.effectivePrice)
      : parseFloat(itemMap.get(line.itemId)?.price || 0);

    let finalPrice = serverPrice;
    let priceSource = resolvedPrice?.priceSource || "base_price";
    let priceOverrideReason = null;

    if (line.unitPrice !== undefined && line.unitPrice !== null) {
      const clientPrice = parseFloat(line.unitPrice);
      if (Math.abs(clientPrice - serverPrice) > 0.01) {
        // Price differs — require reason
        if (!line.priceOverrideReason || !line.priceOverrideReason.trim()) {
          throw Object.assign(
            new Error(`سعر ${itemMap.get(line.itemId)?.name} يختلف عن السعر المحدد (${serverPrice}). يجب تحديد سبب تعديل السعر`),
            { status: 400 }
          );
        }
        finalPrice = clientPrice;
        priceSource = "override";
        priceOverrideReason = line.priceOverrideReason;
      } else {
        finalPrice = clientPrice;
      }
    }

    return {
      ...line,
      resolvedUnitPrice: finalPrice,
      priceSource,
      priceOverrideReason,
      tierName: resolvedPrice?.tierName || null,
    };
  });
}

// ── STEP 5: Apply stock changes ──

async function applyStockChanges(tx, resolvedLines, context) {
  const { itemMap, rollsByLine, warehouseId } = context;
  const pendingRollCuts = []; // { cutId, lineItemId } for backfill in Step 6

  for (const line of resolvedLines) {
    const item = itemMap.get(line.itemId);

    if (item.itemType === "FABRIC") {
      // Cut each roll allocation
      for (const alloc of line.rollAllocations) {
        const cutLen = parseFloat(alloc.length);

        // Update roll
        await tx.fabricRoll.update({
          where: { id: alloc.rollId },
          data: {
            remainingLength: { decrement: cutLen },
            status: await (async () => {
              const roll = await tx.fabricRoll.findUnique({
                where: { id: alloc.rollId },
                select: { remainingLength: true },
              });
              const newRemaining = parseFloat(roll.remainingLength) - cutLen;
              return newRemaining <= 0.001 ? "DEPLETED" : "PARTIALLY_CUT";
            })(),
            lastCutAt: new Date(),
          },
        });

        // Create cut record (saleItemId = null, backfilled in Step 6)
        const cut = await tx.fabricRollCut.create({
          data: {
            fabricRollId: alloc.rollId,
            lengthCut: cutLen,
            saleItemId: null,
            notes: `POS sale cut`,
          },
        });

        pendingRollCuts.push({
          cutId: cut.id,
          lineItemId: line.itemId,
          rollId: alloc.rollId,
        });

        // Decrement inventory for fabric
        await tx.inventory.update({
          where: {
            itemId_warehouseId: { itemId: line.itemId, warehouseId },
          },
          data: { quantity: { decrement: cutLen } },
        });
      }
    } else {
      // Non-fabric: simple inventory decrement
      const qty = parseFloat(line.quantity);
      await tx.inventory.update({
        where: {
          itemId_warehouseId: { itemId: line.itemId, warehouseId },
        },
        data: { quantity: { decrement: qty } },
      });
    }
  }

  return pendingRollCuts;
}

// ── STEP 6: Create Sale + SaleItem ──

async function createSaleAndItems(tx, resolvedLines, body, shift, user, config) {
  const { clientId, paymentMethod, paidAmount, notes, tierOverride, tierOverrideReason } = body;

  // Compute totals
  let subtotal = 0;
  for (const line of resolvedLines) {
    subtotal += line.resolvedUnitPrice * parseFloat(line.quantity);
  }
  subtotal = Math.round(subtotal * 100) / 100;

  // Tax
  const taxEnabled = config.taxEnabledOnSales !== false;
  const taxRate = taxEnabled ? parseFloat(config.taxRate) / 100 : 0;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Payment validation
  const paid = parseFloat(paidAmount);
  const method = paymentMethod || "CASH";
  if (method === "CASH" && paid < total) {
    throw Object.assign(
      new Error(`المبلغ المدفوع (${paid}) أقل من إجمالي الفاتورة (${total})`),
      { status: 400 }
    );
  }
  if (["INSTAPAY", "VISA"].includes(method) && Math.abs(paid - total) > 0.01) {
    throw Object.assign(
      new Error(`يجب أن يكون المبلغ المدفوع مساوياً للإجمالي عند الدفع بـ ${method}`),
      { status: 400 }
    );
  }
  const changeAmount = method === "CASH" ? Math.round((paid - total) * 100) / 100 : 0;

  const saleNumber = await generateSaleNumber(tx);

  // Determine clientId — walk-in defaults to ID 1
  const finalClientId = clientId || 1;

  const sale = await tx.sale.create({
    data: {
      saleNumber,
      clientId: finalClientId,
      userId: user.id,
      branchId: user.branchId,
      treasuryId: user.treasuryId,
      warehouseId: user.warehouseId,
      shiftId: shift.id,
      subtotal,
      taxRate: taxEnabled ? parseFloat(config.taxRate) / 100 : 0,
      taxAmount,
      total,
      paymentMethod: method,
      paidAmount: paid,
      changeAmount,
      status: "COMPLETED",
      notes: notes || null,
      items: {
        create: resolvedLines.map((line) => ({
          itemId: line.itemId,
          quantity: parseFloat(line.quantity),
          unitPrice: line.resolvedUnitPrice,
          total: Math.round(line.resolvedUnitPrice * parseFloat(line.quantity) * 100) / 100,
        })),
      },
    },
    include: {
      items: { include: { item: true, fabricRollCuts: true } },
      client: true,
      user: true,
      branch: true,
      shift: true,
    },
  });

  // Build audit details
  const auditDetails = {
    tierOverride: tierOverride || null,
    tierOverrideReason: tierOverrideReason || null,
    priceOverrideReasons: resolvedLines
      .filter((l) => l.priceOverrideReason)
      .map((l) => ({
        itemId: l.itemId,
        reason: l.priceOverrideReason,
        resolvedPrice: l.resolvedUnitPrice,
        priceSource: l.priceSource,
      })),
    linePriceSources: resolvedLines.map((l) => ({
      itemId: l.itemId,
      priceSource: l.priceSource,
      tierName: l.tierName,
    })),
  };

  return { sale, auditDetails };
}

// ── STEP 6b: Backfill roll cut saleItemIds ──

async function backfillRollCutsSaleItemIds(tx, pendingRollCuts, saleItems) {
  // Map lineItemId -> saleItem.id
  const saleItemByItemId = new Map();
  for (const si of saleItems) {
    if (si.itemId) saleItemByItemId.set(si.itemId, si.id);
  }

  for (const pc of pendingRollCuts) {
    const saleItemId = saleItemByItemId.get(pc.lineItemId);
    if (saleItemId) {
      await tx.fabricRollCut.update({
        where: { id: pc.cutId },
        data: { saleItemId },
      });
    }
  }
}

// ── STEP 7: Treasury update ──

async function updateTreasury(tx, treasuryId, paymentMethod, total) {
  const amount = parseFloat(total);
  const method = paymentMethod || "CASH";

  if (method === "CASH") {
    await tx.treasury.update({
      where: { id: treasuryId },
      data: { balance: { increment: amount } },
    });
  } else if (["INSTAPAY", "VISA", "CARD"].includes(method)) {
    const config = await tx.systemConfiguration.findFirst({
      select: { bankTreasuryId: true },
    });
    if (!config?.bankTreasuryId) {
      throw Object.assign(
        new Error("إعدادات النظام غير مكتملة — لا يوجد خزينة بنكية محددة"),
        { status: 400 }
      );
    }
    await tx.treasury.update({
      where: { id: config.bankTreasuryId },
      data: { balance: { increment: amount } },
    });
  }
}

// ── Receipt data builder ──

async function buildReceiptData(prismaClient, saleId) {
  const sale = await prismaClient.sale.findUnique({
    where: { id: saleId },
    include: {
      client: true,
      user: true,
      branch: true,
      items: {
        include: {
          item: true,
          fabricRollCuts: { include: { fabricRoll: true } },
        },
      },
    },
  });
  if (!sale) return null;

  const config = await prismaClient.systemConfiguration.findFirst();

  return {
    companyName: config?.companyName || "رامكس ستور",
    taxNumber: config?.taxNumber || "",
    taxEnabledOnSales: config?.taxEnabledOnSales !== false,
    branchName: sale.branch?.name || "",
    branchAddress: sale.branch?.address || "",
    saleNumber: sale.saleNumber,
    date: sale.createdAt,
    cashierName: sale.user?.name || "",
    clientName: sale.client?.name || "عميل عام",
    clientTier: sale.client?.tier || "RETAIL",
    items: sale.items.map((si) => ({
      name: si.item?.name || "",
      quantity: si.quantity,
      unitPrice: si.unitPrice,
      total: si.total,
      unit: si.item?.unit || "",
      rollCuts: si.fabricRollCuts.map((rc) => ({
        rollNumber: rc.fabricRoll?.rollNumber || "",
        length: rc.lengthCut,
      })),
    })),
    subtotal: sale.subtotal,
    taxRate: sale.taxRate,
    taxAmount: sale.taxAmount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    paidAmount: sale.paidAmount,
    changeAmount: sale.changeAmount,
  };
}

module.exports = {
  generateSaleNumber,
  loadAndLock,
  validateSalePayload,
  resolveLinePrices,
  applyStockChanges,
  createSaleAndItems,
  backfillRollCutsSaleItemIds,
  updateTreasury,
  buildReceiptData,
};
```

- [ ] **Step 2: Verify it loads without errors**

```bash
cd backend && node -e "const s = require('./services/posSaleService'); console.log('OK:', Object.keys(s))"
```

Expected: `OK: [ 'generateSaleNumber', 'loadAndLock', 'validateSalePayload', ... ]`

- [ ] **Step 3: Commit**

```bash
git add backend/services/posSaleService.js
git commit -m "feat(pos): add posSaleService with transaction helpers"
```

---

## Task 4: Rewrite POST /api/sales Route

**Files:**
- Modify: `backend/routes/sales.js` (~line 410-700, the POST `/` handler)

**IMPORTANT:** The existing POST handler has BOM logic, delivery logic, and employee-based sales. We must PRESERVE backward compatibility for delivery/BOM flows while adding the new POS flow. Strategy: **add a new `POST /api/sales/pos` endpoint** for the Phase 6 POS flow, keeping the existing `POST /api/sales` untouched for backward compatibility.

- [ ] **Step 1: Read the existing sales.js to find the right insertion point**

Read `backend/routes/sales.js` and identify the line where we can add a new route. Add the new `POST /pos` endpoint after the existing `POST /` endpoint.

- [ ] **Step 2: Add the new POS sale endpoint**

Add this **above** the existing `POST /` handler (after the `require` section at the top of the file) or at the end before `module.exports`:

First, add the require at the top of `backend/routes/sales.js`:

```js
const {
  loadAndLock,
  validateSalePayload,
  resolveLinePrices,
  applyStockChanges,
  createSaleAndItems,
  backfillRollCutsSaleItemIds,
  updateTreasury,
  buildReceiptData,
} = require("../services/posSaleService");
```

Then add the new endpoint:

```js
// ── Phase 6 POS sale endpoint ──
// No deferred/credit sales — all paid in full at POS.
router.post(
  "/pos",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      // STEP 1: Shift gate (outside transaction)
      const user = req.user;
      const openShift = await prisma.shift.findFirst({
        where: { userId: user.id, status: "OPEN" },
      });
      if (!openShift) {
        return res.status(400).json({
          error: "يجب فتح وردية قبل إجراء عمليات البيع",
        });
      }

      // Resolve user context
      const userWithBranch = await prisma.user.findUnique({
        where: { id: user.id },
        include: { branch: true },
      });
      if (!userWithBranch?.branch) {
        return res.status(400).json({ error: "المستخدم غير مرتبط بفرع" });
      }

      const userContext = {
        id: user.id,
        branchId: userWithBranch.branchId,
        treasuryId: userWithBranch.branch.treasuryId,
        warehouseId: userWithBranch.branch.warehouseId,
      };

      // Load system config
      const config = await prisma.systemConfiguration.findFirst();

      const result = await prisma.$transaction(
        async (tx) => {
          // STEP 2: Load + Lock
          const context = await loadAndLock(tx, req.body, userContext);

          // STEP 3: Validate
          validateSalePayload(req.body, context);

          // STEP 4: Resolve prices
          const resolvedLines = await resolveLinePrices(tx, req.body, context);

          // STEP 5: Cut rolls + decrement inventory
          const pendingRollCuts = await applyStockChanges(tx, resolvedLines, context);

          // STEP 6: Create Sale + SaleItem + backfill cut refs
          const { sale, auditDetails } = await createSaleAndItems(
            tx, resolvedLines, req.body, openShift, userContext, config
          );
          await backfillRollCutsSaleItemIds(tx, pendingRollCuts, sale.items);

          // STEP 7: Treasury
          await updateTreasury(tx, userContext.treasuryId, req.body.paymentMethod, sale.total);

          return { sale, auditDetails };
        },
        { timeout: 10000 }
      );

      // Attach audit details for middleware
      res._auditDetails = result.auditDetails;
      res.json(result.sale);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      next(err);
    }
  }
);
```

- [ ] **Step 3: Add receipt endpoint**

Add after the POS endpoint in `backend/routes/sales.js`:

```js
// ── Receipt data endpoint ──
router.get(
  "/:id/receipt",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      const saleId = parseInt(req.params.id);
      const receipt = await buildReceiptData(prisma, saleId);
      if (!receipt) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      res.json(receipt);
    } catch (err) {
      next(err);
    }
  }
);
```

- [ ] **Step 4: Test the new endpoint manually**

Start the backend and test with curl or Postman:

```bash
# Verify endpoint responds (will fail auth, that's OK — confirms route is registered)
curl -s http://localhost:3000/api/sales/pos -X POST -H "Content-Type: application/json" | head -20
```

Expected: 401 or 403 (not 404), confirming the route is registered.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/sales.js
git commit -m "feat(pos): add POST /api/sales/pos with tier pricing + fabric roll cuts"
```

---

## Task 5: Extend Refund — Reject Fabric Lines

**Files:**
- Modify: `backend/routes/sales.js` (the `POST /refund` handler)

- [ ] **Step 1: Read the refund handler**

Find the existing `POST /refund` handler in `backend/routes/sales.js`. Locate where it iterates through refund items to validate them.

- [ ] **Step 2: Add fabric rejection check**

Inside the refund handler, after validating that the refund item exists in the original sale and before processing the refund, add:

```js
// Check if item is fabric — reject fabric refunds
const refundedItem = await tx.item.findUnique({
  where: { id: item.itemId },
  select: { itemType: true, name: true },
});
if (refundedItem?.itemType === "FABRIC") {
  throw Object.assign(
    new Error(
      `لا يمكن استرجاع قماش مقطوع — قم بتسجيل تسوية مخزون بدلاً من ذلك (${refundedItem.name})`
    ),
    { status: 400 }
  );
}
```

Find the exact location: in the refund transaction, look for the loop where `refundData.items` are processed. The check should be the FIRST thing in the loop, before stock restoration.

- [ ] **Step 3: Test with curl**

Test by attempting to refund a sale that contains a fabric item. Should get 400 with the Arabic message.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/sales.js
git commit -m "feat(pos): reject fabric line refunds with Arabic message"
```

---

## Task 6: Extend Cancel/Delete — Reverse Fabric Roll Cuts

**Files:**
- Modify: `backend/routes/sales.js` (the `DELETE /:id` handler)

- [ ] **Step 1: Read the delete handler**

Find the existing `DELETE /:id` handler. It currently restocks inventory and refunds treasury but doesn't reverse fabric roll cuts.

- [ ] **Step 2: Add fabric roll reversal**

Inside the delete transaction, after fetching the sale with items, add before the inventory restoration:

```js
// Reverse fabric roll cuts for this sale's items
for (const saleItem of sale.items) {
  if (!saleItem.itemId) continue;

  const item = await tx.item.findUnique({
    where: { id: saleItem.itemId },
    select: { itemType: true },
  });

  if (item?.itemType === "FABRIC") {
    // Find all cuts linked to this sale item
    const cuts = await tx.fabricRollCut.findMany({
      where: { saleItemId: saleItem.id },
    });

    for (const cut of cuts) {
      // Restore roll remaining length
      await tx.fabricRoll.update({
        where: { id: cut.fabricRollId },
        data: {
          remainingLength: { increment: parseFloat(cut.lengthCut) },
          status: "AVAILABLE", // or PARTIALLY_CUT — recalculate
        },
      });

      // Recalculate status
      const updatedRoll = await tx.fabricRoll.findUnique({
        where: { id: cut.fabricRollId },
        select: { remainingLength: true, originalLength: true },
      });
      const isFullyRestored =
        Math.abs(parseFloat(updatedRoll.remainingLength) - parseFloat(updatedRoll.originalLength)) < 0.001;
      if (!isFullyRestored) {
        await tx.fabricRoll.update({
          where: { id: cut.fabricRollId },
          data: { status: "PARTIALLY_CUT" },
        });
      }

      // Delete the cut record
      await tx.fabricRollCut.delete({ where: { id: cut.id } });
    }

    // Note: inventory restoration for fabric items is handled by the existing
    // inventory upsert logic below (it increments by saleItem.quantity)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/sales.js
git commit -m "feat(pos): reverse fabric roll cuts on sale cancellation"
```

---

## Task 7: Frontend — Update Sales Service + New Components

**Files:**
- Modify: `frontend/src/services/salesService.js`
- Create: `frontend/src/pages/pos/TierOverrideModal.jsx`
- Create: `frontend/src/pages/pos/PriceOverrideModal.jsx`

- [ ] **Step 1: Add POS sale + receipt methods to salesService**

In `frontend/src/services/salesService.js`, add two new methods to the exported object:

```js
  async createPOS(saleData) {
    return await api.post(`${SALES_URL}/pos`, saleData);
  },

  async getReceipt(saleId) {
    return await api.get(`${SALES_URL}/${saleId}/receipt`);
  },
```

Add after the existing `create` method.

- [ ] **Step 2: Create TierOverrideModal**

Create `frontend/src/pages/pos/TierOverrideModal.jsx`:

```jsx
import { useState } from "react";
import { FaTags, FaTimes } from "react-icons/fa";

const REASONS = [
  "طلب العميل",
  "عميل دائم",
  "تصفية مخزون",
  "عرض خاص",
  "موافقة المدير",
];

export default function TierOverrideModal({ isOpen, onClose, currentTier, onConfirm }) {
  const [selectedTier, setSelectedTier] = useState(currentTier === "WHOLESALE" ? "RETAIL" : "WHOLESALE");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalReason = reason === "أخرى" ? customReason.trim() : reason;
    if (!finalReason) return;
    onConfirm(selectedTier, finalReason);
    setReason("");
    setCustomReason("");
  };

  const handleClear = () => {
    onConfirm(null, null); // Clear override
    setReason("");
    setCustomReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="bg-amber-500 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaTags />
            <h3 className="font-bold">تغيير مستوى التسعير</h3>
          </div>
          <button onClick={onClose} className="hover:bg-amber-600 rounded p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المستوى الجديد</label>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedTier("RETAIL")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition ${
                  selectedTier === "RETAIL"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                تجزئة (RETAIL)
              </button>
              <button
                onClick={() => setSelectedTier("WHOLESALE")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition ${
                  selectedTier === "WHOLESALE"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                جملة (WHOLESALE)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">سبب التغيير *</label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-amber-500"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="أخرى"
                  checked={reason === "أخرى"}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-amber-500"
                />
                <span className="text-sm">أخرى</span>
              </label>
              {reason === "أخرى" && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="اكتب السبب..."
                  className="w-full border rounded-lg p-2 text-sm mt-1"
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-3 justify-between">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-gray-500 hover:text-red-500"
          >
            إزالة التغيير
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!reason || (reason === "أخرى" && !customReason.trim())}
              className="px-6 py-2 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              تأكيد
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create PriceOverrideModal**

Create `frontend/src/pages/pos/PriceOverrideModal.jsx`:

```jsx
import { useState } from "react";
import { FaMoneyBillWave, FaTimes } from "react-icons/fa";

const REASONS = [
  "خصم خاص",
  "سعر متفق عليه مسبقاً",
  "تالف جزئياً",
  "تصفية",
  "موافقة المدير",
];

export default function PriceOverrideModal({
  isOpen,
  onClose,
  itemName,
  currentPrice,
  resolvedPrice,
  onConfirm,
}) {
  const [newPrice, setNewPrice] = useState(currentPrice?.toString() || "");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    const finalReason = reason === "أخرى" ? customReason.trim() : reason;
    if (Math.abs(price - resolvedPrice) > 0.01 && !finalReason) return;
    onConfirm(price, finalReason || null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="bg-blue-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaMoneyBillWave />
            <h3 className="font-bold text-sm">تعديل سعر: {itemName}</h3>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 rounded p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-500">
            السعر الأصلي: <span className="font-bold text-gray-700">{resolvedPrice} ج.م</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">السعر الجديد</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-full border rounded-lg p-2 text-left"
              dir="ltr"
              autoFocus
            />
          </div>

          {parseFloat(newPrice) !== resolvedPrice && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سبب التعديل *</label>
              <div className="space-y-1">
                {REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priceReason"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <span className="text-xs">{r}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceReason"
                    value="أخرى"
                    checked={reason === "أخرى"}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <span className="text-xs">أخرى</span>
                </label>
                {reason === "أخرى" && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="اكتب السبب..."
                    className="w-full border rounded p-1.5 text-xs mt-1"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              !newPrice ||
              (Math.abs(parseFloat(newPrice) - resolvedPrice) > 0.01 &&
                !reason &&
                !(reason === "أخرى" && customReason.trim()))
            }
            className="px-5 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/salesService.js frontend/src/pages/pos/TierOverrideModal.jsx frontend/src/pages/pos/PriceOverrideModal.jsx
git commit -m "feat(pos): add TierOverrideModal, PriceOverrideModal, and POS sale service methods"
```

---

## Task 8: Frontend — Receipt Print Template

**Files:**
- Create: `frontend/src/pages/pos/ReceiptPrintTemplate.jsx`

- [ ] **Step 1: Create the Arabic receipt template**

Create `frontend/src/pages/pos/ReceiptPrintTemplate.jsx`:

```jsx
import React from "react";

const ReceiptPrintTemplate = React.forwardRef(({ data }, ref) => {
  if (!data) return null;

  const {
    companyName,
    taxNumber,
    taxEnabledOnSales,
    branchName,
    branchAddress,
    saleNumber,
    date,
    cashierName,
    clientName,
    clientTier,
    items,
    subtotal,
    taxRate,
    taxAmount,
    total,
    paymentMethod,
    paidAmount,
    changeAmount,
  } = data;

  const paymentMethodAr = {
    CASH: "نقدي",
    INSTAPAY: "InstaPay",
    VISA: "فيزا",
    CARD: "بطاقة",
  };

  const tierBadge = clientTier === "WHOLESALE" ? " (جملة)" : "";

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(
      dt.getMinutes()
    ).padStart(2, "0")}`;
  };

  const formatNum = (n) => {
    const num = parseFloat(n);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        width: "80mm",
        fontFamily: "Arial, Tahoma, sans-serif",
        fontSize: "12px",
        lineHeight: "1.4",
        padding: "4mm",
        color: "#000",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "4mm" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>{companyName}</div>
        <div style={{ fontSize: "11px" }}>{branchName}</div>
        {branchAddress && <div style={{ fontSize: "10px", color: "#555" }}>{branchAddress}</div>}
        {taxNumber && (
          <div style={{ fontSize: "10px", color: "#555" }}>
            الرقم الضريبي: {taxNumber}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

      {/* Sale info */}
      <div style={{ fontSize: "11px" }}>
        <div>فاتورة: <span style={{ fontWeight: "bold" }}>{saleNumber}</span></div>
        <div>التاريخ: {formatDate(date)}</div>
        <div>الكاشير: {cashierName}</div>
        <div>
          العميل: {clientName}
          {tierBadge && <span style={{ color: "#7c3aed" }}>{tierBadge}</span>}
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

      {/* Items */}
      <div>
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: "2mm" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px" }}>{item.name}</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                paddingRight: "2mm",
              }}
            >
              <span>
                {formatNum(item.quantity)} × {formatNum(item.unitPrice)}
              </span>
              <span>{formatNum(item.total)}</span>
            </div>
            {/* Fabric roll info */}
            {item.rollCuts &&
              item.rollCuts.length > 0 &&
              item.rollCuts.map((rc, j) => (
                <div
                  key={j}
                  style={{ fontSize: "9px", color: "#666", paddingRight: "4mm" }}
                >
                  من لفة {rc.rollNumber} ({formatNum(rc.length)} م)
                </div>
              ))}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

      {/* Totals */}
      <div style={{ fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>المجموع:</span>
          <span>{formatNum(subtotal)}</span>
        </div>

        {taxEnabledOnSales && parseFloat(taxAmount) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الضريبة ({(parseFloat(taxRate) * 100).toFixed(0)}%):</span>
            <span>{formatNum(taxAmount)}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "13px",
            marginTop: "1mm",
          }}
        >
          <span>الإجمالي:</span>
          <span>{formatNum(total)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الدفع ({paymentMethodAr[paymentMethod] || paymentMethod}):</span>
          <span>{formatNum(paidAmount)}</span>
        </div>

        {paymentMethod === "CASH" && parseFloat(changeAmount) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الباقي:</span>
            <span>{formatNum(changeAmount)}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "11px" }}>شكرًا لتعاملكم</div>
    </div>
  );
});

ReceiptPrintTemplate.displayName = "ReceiptPrintTemplate";

export default ReceiptPrintTemplate;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/pos/ReceiptPrintTemplate.jsx
git commit -m "feat(pos): add Arabic RTL 80mm thermal receipt template"
```

---

## Task 9: Frontend — Extend POSPage.jsx (Cart + Fabric + Tier + Price Override)

**Files:**
- Modify: `frontend/src/pages/pos/POSPage.jsx`

This is the biggest task. The changes are spread across the existing 2367-line file. Apply changes in this order:

- [ ] **Step 1: Add imports at the top of POSPage.jsx**

Add these imports near the existing import block:

```js
import TierOverrideModal from "./TierOverrideModal";
import PriceOverrideModal from "./PriceOverrideModal";
import ReceiptPrintTemplate from "./ReceiptPrintTemplate";
import FabricRollPickerModal from "../../components/shared/FabricRollPickerModal";
```

Also add `useRef` to the React import if not already present, and import `useReactToPrint` from `react-to-print`:

```js
import { useReactToPrint } from "react-to-print";
```

- [ ] **Step 2: Add new state variables**

Add these state declarations near the existing state block (around lines 31-80):

```js
// Phase 6 — Tier Override
const [tierOverride, setTierOverride] = useState(null); // "RETAIL" | "WHOLESALE" | null
const [tierOverrideReason, setTierOverrideReason] = useState(null);
const [isTierOverrideModalOpen, setIsTierOverrideModalOpen] = useState(false);

// Phase 6 — Fabric Roll Picker
const [fabricPickerOpen, setFabricPickerOpen] = useState(false);
const [fabricPickerItem, setFabricPickerItem] = useState(null); // {itemId, warehouseId, requestedLength}
const [pendingFabricProduct, setPendingFabricProduct] = useState(null);

// Phase 6 — Price Override
const [priceOverrideModalOpen, setPriceOverrideModalOpen] = useState(false);
const [priceOverrideTarget, setPriceOverrideTarget] = useState(null); // cart item being edited

// Phase 6 — Receipt
const receiptRef = useRef(null);
const [receiptData, setReceiptData] = useState(null);
const [isSubmitting, setIsSubmitting] = useState(false);

// Phase 6 — Search
const searchInputRef = useRef(null);
const clientSearchRef = useRef(null);
```

- [ ] **Step 3: Add tier override handler**

Add a handler function:

```js
const handleTierOverrideConfirm = (tier, reason) => {
  setTierOverride(tier);
  setTierOverrideReason(reason);
  setIsTierOverrideModalOpen(false);
};
```

- [ ] **Step 4: Modify handleProductClick for fabric items**

In the existing `handleProductClick` function, add a check for fabric items. After the availability check and before setting the keypad mode:

```js
// Check if item is fabric — open roll picker instead of normal quantity entry
if (product.itemType === "FABRIC") {
  setPendingFabricProduct(product);
  setFabricPickerItem({
    itemId: product.id,
    warehouseId: /* user's warehouseId from branch */,
    requestedLength: null, // user will type length in picker
  });
  setFabricPickerOpen(true);
  return;
}
```

- [ ] **Step 5: Add fabric roll picker callback**

Add a handler for when rolls are picked:

```js
const handleFabricRollsPicked = (selection) => {
  // selection = [{rollId, rollNumber, allocated}]
  if (!pendingFabricProduct || !selection || selection.length === 0) return;

  const totalLength = selection.reduce((s, r) => s + r.allocated, 0);
  const product = pendingFabricProduct;
  const price = product.sellPrice || product.price || product.purchasePrice || 0;

  const rollAllocations = selection.map((s) => ({
    rollId: s.rollId,
    rollNumber: s.rollNumber,
    length: s.allocated,
  }));

  // Add to cart with roll info
  const existingIndex = cartItems.findIndex((ci) => ci.id === product.id);
  if (existingIndex >= 0) {
    // Fabric items: replace (don't accumulate) since roll allocations are specific
    const updated = [...cartItems];
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: totalLength,
      total: totalLength * price,
      rollAllocations,
    };
    setCartItems(updated);
  } else {
    setCartItems([
      ...cartItems,
      {
        id: product.id,
        name: product.name,
        price,
        quantity: totalLength,
        total: totalLength * price,
        unit: product.unit || "م",
        itemType: "FABRIC",
        rollAllocations,
      },
    ]);
  }

  setFabricPickerOpen(false);
  setPendingFabricProduct(null);
};
```

- [ ] **Step 6: Add per-line price override handler**

```js
const handleOpenPriceOverride = (cartItem) => {
  setPriceOverrideTarget(cartItem);
  setPriceOverrideModalOpen(true);
};

const handlePriceOverrideConfirm = (newPrice, reason) => {
  if (!priceOverrideTarget) return;
  setCartItems((prev) =>
    prev.map((ci) =>
      ci.id === priceOverrideTarget.id
        ? {
            ...ci,
            price: newPrice,
            total: newPrice * ci.quantity,
            priceOverrideReason: reason,
            priceOverridden: Math.abs(newPrice - (ci.originalPrice || ci.price)) > 0.01,
          }
        : ci
    )
  );
  setPriceOverrideModalOpen(false);
  setPriceOverrideTarget(null);
};
```

- [ ] **Step 7: Modify handleCompleteSale to use POST /api/sales/pos**

Replace the existing `handleCompleteSale` function's API call. Instead of `salesService.create(saleData)`, use `salesService.createPOS(posPayload)` with the new payload format:

```js
const posPayload = {
  clientId: selectedClient?.id || null,
  tierOverride: tierOverride || undefined,
  tierOverrideReason: tierOverrideReason || undefined,
  items: cartItems.map((ci) => ({
    itemId: ci.id,
    quantity: ci.quantity,
    unitPrice: ci.priceOverridden ? ci.price : undefined,
    priceOverrideReason: ci.priceOverrideReason || undefined,
    rollAllocations: ci.itemType === "FABRIC" && ci.rollAllocations
      ? ci.rollAllocations.map((ra) => ({ rollId: ra.rollId, length: ra.length }))
      : undefined,
  })),
  paymentMethod: paymentMethod === "visa" || paymentMethod === "instapay" ? "INSTAPAY" : "CASH",
  paidAmount: parseFloat(paidAmount) || total,
  notes: notes || undefined,
};

const response = await salesService.createPOS(posPayload);
```

After success, build receipt data from the response and set it:

```js
// Build receipt data from response
setReceiptData({
  companyName: /* from settings state */,
  taxNumber: /* from settings state */,
  taxEnabledOnSales: /* from settings state */,
  branchName: response.branch?.name || "",
  branchAddress: response.branch?.address || "",
  saleNumber: response.saleNumber,
  date: response.createdAt,
  cashierName: response.user?.name || currentUser?.name || "",
  clientName: response.client?.name || "عميل عام",
  clientTier: response.client?.tier || "RETAIL",
  items: response.items.map((si) => ({
    name: si.item?.name || "",
    quantity: si.quantity,
    unitPrice: si.unitPrice,
    total: si.total,
    unit: si.item?.unit || "",
    rollCuts: si.fabricRollCuts?.map((rc) => ({
      rollNumber: rc.fabricRoll?.rollNumber || "",
      length: rc.lengthCut,
    })) || [],
  })),
  subtotal: response.subtotal,
  taxRate: response.taxRate,
  taxAmount: response.taxAmount,
  total: response.total,
  paymentMethod: response.paymentMethod,
  paidAmount: response.paidAmount,
  changeAmount: response.changeAmount,
});
```

- [ ] **Step 8: Add double-submit protection**

Wrap the sale submission with `isSubmitting` guard:

```js
// At the start of handleConfirmPayment:
if (isSubmitting) return;
setIsSubmitting(true);

// In the try block, after success:
setIsSubmitting(false);

// In the catch block:
setIsSubmitting(false);
```

Disable the payment confirm button:
```jsx
<button disabled={isSubmitting} ...>
```

- [ ] **Step 9: Add keyboard shortcuts**

Add a `useEffect` for keyboard shortcuts:

```js
useEffect(() => {
  const handleKeyDown = (e) => {
    // F2 — focus client search
    if (e.key === "F2") {
      e.preventDefault();
      clientSearchRef.current?.focus();
    }
    // F3 — focus item search
    if (e.key === "F3") {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    // F4 — open payment
    if (e.key === "F4") {
      e.preventDefault();
      if (cartItems.length > 0) handleQuickPayment("cash");
    }
    // Esc — close keypad or remove last item
    if (e.key === "Escape") {
      if (keypadMode !== "default") {
        setKeypadMode("default");
        setSelectedProductForQuantity(null);
      } else if (cartItems.length > 0) {
        removeFromCart(cartItems[cartItems.length - 1].id);
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [cartItems, keypadMode]);
```

- [ ] **Step 10: Enhance product search for barcode/color/style**

Modify the `filteredProducts` computation. Currently it searches by name only. Add barcode, colorCode, and style code:

```js
const filteredProducts = products.filter((p) => {
  // Category filter
  if (activeCategory !== "All" && !p.categories?.includes(activeCategory)) return false;
  // Search filter
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  return (
    p.name?.toLowerCase().includes(term) ||
    p.barcode?.toLowerCase().includes(term) ||
    p.colorCode?.toLowerCase().includes(term) ||
    p.styleCode?.toLowerCase().includes(term) ||
    p.sku?.toLowerCase().includes(term)
  );
});
```

Also add `ref={searchInputRef}` to the search input element.

- [ ] **Step 11: Add hold/recall revalidation on retrieve**

In the existing `handleRetrieveCart` function, after restoring the cart items, add stock + tier revalidation:

```js
// Revalidate stock on recall
// (prices may have changed since hold — notify cashier)
const revalidated = heldCart.items.map((item) => {
  const currentProduct = products.find((p) => p.id === item.id);
  if (!currentProduct) return { ...item, warning: "الصنف لم يعد متاحاً" };

  // Check stock
  const available = currentProduct.quantity + (currentProduct.autoProducible || 0);
  if (item.quantity > available) {
    return { ...item, warning: `الكمية المتاحة تغيرت: ${available}`, quantity: Math.min(item.quantity, available) };
  }
  return item;
});

const warnings = revalidated.filter((i) => i.warning);
if (warnings.length > 0) {
  toast.warn(`تم تعديل بعض الأصناف بسبب تغيير المخزون: ${warnings.map((w) => w.warning).join(", ")}`);
}

setCartItems(revalidated.map(({ warning, ...rest }) => rest));
```

- [ ] **Step 12: Add modal renders in JSX**

At the bottom of the component's return JSX, add the new modals:

```jsx
{/* Tier Override Modal */}
<TierOverrideModal
  isOpen={isTierOverrideModalOpen}
  onClose={() => setIsTierOverrideModalOpen(false)}
  currentTier={tierOverride || selectedClient?.tier || "RETAIL"}
  onConfirm={handleTierOverrideConfirm}
/>

{/* Fabric Roll Picker Modal */}
{fabricPickerOpen && fabricPickerItem && (
  <FabricRollPickerModal
    isOpen={fabricPickerOpen}
    onClose={() => { setFabricPickerOpen(false); setPendingFabricProduct(null); }}
    itemId={fabricPickerItem.itemId}
    warehouseId={fabricPickerItem.warehouseId}
    requestedLength={fabricPickerItem.requestedLength}
    onPick={handleFabricRollsPicked}
  />
)}

{/* Price Override Modal */}
<PriceOverrideModal
  isOpen={priceOverrideModalOpen}
  onClose={() => { setPriceOverrideModalOpen(false); setPriceOverrideTarget(null); }}
  itemName={priceOverrideTarget?.name || ""}
  currentPrice={priceOverrideTarget?.price || 0}
  resolvedPrice={priceOverrideTarget?.originalPrice || priceOverrideTarget?.price || 0}
  onConfirm={handlePriceOverrideConfirm}
/>

{/* Receipt Print Template (hidden, for printing) */}
<div style={{ display: "none" }}>
  <ReceiptPrintTemplate ref={receiptRef} data={receiptData} />
</div>
```

- [ ] **Step 13: Add tier badge and override button to cart header**

In the cart sidebar, near the client selector, add a tier badge and override toggle:

```jsx
{/* Tier badge + override button */}
{selectedClient && (
  <div className="flex items-center gap-2 px-3 py-1">
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      (tierOverride || selectedClient.tier) === "WHOLESALE"
        ? "bg-purple-100 text-purple-700"
        : "bg-blue-100 text-blue-700"
    }`}>
      {(tierOverride || selectedClient.tier) === "WHOLESALE" ? "جملة" : "تجزئة"}
      {tierOverride && " ↻"}
    </span>
    <button
      onClick={() => setIsTierOverrideModalOpen(true)}
      className="text-xs text-amber-600 hover:text-amber-700 underline"
    >
      تغيير
    </button>
  </div>
)}
```

- [ ] **Step 14: Update cart item rows for fabric + price override**

In the cart items list, modify each cart item row to show:
1. Fabric roll info: "من لفة R-XXXXX" or "من X لفات"
2. Price override indicator
3. Click-to-edit price

```jsx
{/* In each cart item row, add after the name: */}
{item.itemType === "FABRIC" && item.rollAllocations && (
  <div className="text-[10px] text-gray-500">
    {item.rollAllocations.length === 1
      ? `من لفة ${item.rollAllocations[0].rollNumber}`
      : `من ${item.rollAllocations.length} لفات`}
  </div>
)}

{/* Price with override indicator — make clickable */}
<button
  onClick={(e) => { e.stopPropagation(); handleOpenPriceOverride(item); }}
  className={`text-xs ${item.priceOverridden ? "text-amber-600 font-bold" : "text-gray-500"}`}
>
  {item.quantity} × {item.price.toFixed(2)}
  {item.priceOverridden && " ✏"}
</button>
```

- [ ] **Step 15: Clear tier override on cart clear**

In the existing `clearCart` function, add:

```js
setTierOverride(null);
setTierOverrideReason(null);
```

- [ ] **Step 16: Commit all POSPage changes**

```bash
git add frontend/src/pages/pos/POSPage.jsx
git commit -m "feat(pos): extend POSPage with fabric rolls, tier override, price override, keyboard shortcuts"
```

---

## Task 10: Frontend — Extend RefundModal for Fabric Rejection

**Files:**
- Modify: `frontend/src/pages/pos/RefundModal.jsx`

- [ ] **Step 1: Handle fabric refund rejection in the refund response**

The backend now returns a 400 error with Arabic message when attempting to refund fabric items. The RefundModal should display this error gracefully.

In the `handleVerificationSuccess` function's catch block, check for fabric rejection:

```js
catch (err) {
  const msg = err.response?.data?.error || err.message;
  toast.error(msg);
}
```

The existing error handling likely already does this. Verify it displays Arabic error messages from the backend.

Additionally, in the refund items table, add a visual indicator for fabric items:

```jsx
{/* In the refund items table, add a check: */}
{refundItem.itemType === "FABRIC" && (
  <span className="text-xs text-red-500 block">
    ⚠ لا يمكن استرجاع قماش مقطوع
  </span>
)}
```

To get `itemType`, include it when loading the sale's items. The backend already returns item details via the `include` chain.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/pos/RefundModal.jsx
git commit -m "feat(pos): show fabric refund rejection warning in RefundModal"
```

---

## Task 11: Install react-to-print + Wire Up Printing

**Files:**
- Modify: `frontend/package.json` (install dependency)
- Modify: `frontend/src/pages/pos/POSPage.jsx` (wire up print)

- [ ] **Step 1: Install react-to-print**

```bash
cd frontend && npm install react-to-print
```

- [ ] **Step 2: Wire up useReactToPrint in POSPage**

After the `receiptRef` and `receiptData` state declarations, add:

```js
const handlePrintReceipt = useReactToPrint({
  contentRef: receiptRef,
  documentTitle: receiptData?.saleNumber || "receipt",
});
```

In the sale completion flow (after `setReceiptData(...)`), replace the existing `window.print()` call with:

```js
// Wait for state to update, then print
setTimeout(() => {
  if (receiptRef.current) handlePrintReceipt();
}, 500);
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add package.json package-lock.json
cd .. && git add frontend/src/pages/pos/POSPage.jsx
git commit -m "feat(pos): wire react-to-print for Arabic thermal receipt"
```

---

## Task 12: Integration Testing & Final Polish

**Files:**
- All modified files

- [ ] **Step 1: Start backend + frontend**

```bash
cd backend && node index.js &
cd frontend && npm run dev &
```

- [ ] **Step 2: Verify POS loads and search works**

Open http://localhost:5173/pos. Verify:
- Shift modal appears
- Product search by name, barcode, color works
- Categories filter correctly
- F2/F3/F4/Esc shortcuts work

- [ ] **Step 3: Test fabric item flow**

1. Search for a fabric item
2. Click it → FabricRollPickerModal should open
3. Select roll(s) and allocate lengths
4. Confirm → cart shows "من لفة R-XXXXX"
5. Complete sale → rolls should be cut in DB

- [ ] **Step 4: Test tier override**

1. Select a wholesale client → tier badge shows "جملة"
2. Click "تغيير" → TierOverrideModal opens
3. Select RETAIL with reason → badge shows "تجزئة ↻"
4. Complete sale → prices should be retail tier

- [ ] **Step 5: Test price override**

1. Add item to cart
2. Click price in cart → PriceOverrideModal opens
3. Change price, provide reason
4. Cart shows new price with ✏ indicator
5. Complete sale → audit log should contain price override reason

- [ ] **Step 6: Test payment methods**

1. CASH with change calculation
2. INSTAPAY (paidAmount must equal total)
3. VISA (same as INSTAPAY)
4. Verify treasury updates correctly for each method

- [ ] **Step 7: Test hold/recall**

1. Add items to cart
2. Click "تعليق" → cart held
3. Add different items
4. Click "فواتير معلقة" → recall held cart
5. Verify stock revalidation occurs on recall

- [ ] **Step 8: Test refund (non-fabric)**

1. Complete a sale with non-fabric items
2. Open refund modal → select sale
3. Refund some items → should succeed
4. Stock and treasury should be reversed

- [ ] **Step 9: Test refund (fabric — rejection)**

1. Complete a sale with fabric items
2. Open refund modal → select sale
3. Try to refund fabric line → should get Arabic rejection message

- [ ] **Step 10: Test cancel**

1. Complete a sale with both fabric and non-fabric items
2. Delete/cancel the sale
3. Verify fabric rolls are restored (remainingLength incremented)
4. Verify non-fabric inventory restored
5. Verify treasury balance reversed

- [ ] **Step 11: Test receipt**

1. Complete a sale
2. Verify receipt shows in Arabic RTL
3. Verify company info, items, totals, tax (or hidden if disabled)
4. Verify fabric roll info appears on receipt

- [ ] **Step 12: Test shift-not-open rejection**

1. Close the shift
2. Try to complete a sale → should get Arabic "يجب فتح وردية" error

- [ ] **Step 13: Test tax toggle**

1. In settings, set `taxEnabledOnSales = false`
2. Complete a sale → tax should be 0
3. Receipt should NOT show tax line

- [ ] **Step 14: Final commit**

```bash
git add -A
git commit -m "phase(06): pos — tier pricing + roll picker + Arabic receipts + hold/cancel/refund"
```

---

## Exit Criteria Checklist

- [ ] POS loads, search works, all item types addable
- [ ] Fabric add opens picker; cart shows roll info; sale cuts correct rolls
- [ ] Tier resolution from walk-in (RETAIL), wholesale client (WHOLESALE), override works with reason required
- [ ] Per-line price override requires reason; both reasons land in audit
- [ ] Stock + treasury update correctly; shift-gated
- [ ] Hold/recall, cancel (reverses everything), refund (non-fabric only; fabric rejected with Arabic message)
- [ ] Receipt prints in Arabic RTL with company info + logo
- [ ] Tax toggle off → no tax line on receipt
- [ ] Permission matrix enforced
- [ ] Double-submit prevented
- [ ] Keyboard shortcuts: F2 client, F3 item, F4 payment, Esc cancel-last
