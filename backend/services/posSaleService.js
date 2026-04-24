/**
 * POS Sale transaction helpers.
 *
 * Follows the strict 8-step transaction design in
 * docs/superpowers/plans/phase-6-pos.md.
 *
 * All mutating helpers receive a Prisma transaction client `tx`.
 */

const { Prisma } = require("@prisma/client");
const { resolveBulkPrices } = require("./pricingService");

// ── Sale number generator ──

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

  // Load client (null = walk-in)
  let client = null;
  if (clientId) {
    client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw Object.assign(new Error("العميل غير موجود"), { status: 400 });
    }
  }

  // Load all referenced items
  const itemIds = lineItems.filter((l) => l.itemId).map((l) => l.itemId);
  const items = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, price: true, itemType: true, unit: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  // Separate fabric vs non-fabric
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
        new Error(
          `يجب تحديد لفات القماش للصنف: ${itemMap.get(line.itemId)?.name}`
        ),
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
    rollsByLine.set(line.itemId, {
      line,
      rolls,
      allocations: line.rollAllocations,
    });
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

  // Lock the branch treasury
  const treasuryId = user.treasuryId;
  await tx.$queryRaw`
    SELECT id, balance FROM treasuries WHERE id = ${treasuryId} FOR UPDATE
  `;

  return {
    client,
    itemMap,
    rollsByLine,
    inventoryByLine,
    warehouseId,
    treasuryId,
  };
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
      throw Object.assign(
        new Error(`الصنف غير موجود: ${line.itemId}`),
        { status: 400 }
      );
    }

    if (item.itemType === "FABRIC") {
      // Validate allocations sum == quantity
      const allocSum = line.rollAllocations.reduce(
        (s, ra) => s + parseFloat(ra.length),
        0
      );
      const qty = parseFloat(line.quantity);
      if (Math.abs(allocSum - qty) > 0.001) {
        throw Object.assign(
          new Error(
            `إجمالي الأطوال المحددة (${allocSum}) لا يساوي الكمية المطلوبة (${qty}) للصنف: ${item.name}`
          ),
          { status: 400 }
        );
      }

      // Validate each roll allocation
      const rollData = rollsByLine.get(line.itemId);
      for (const alloc of line.rollAllocations) {
        const roll = rollData.rolls.find(
          (r) => Number(r.id) === alloc.rollId
        );
        if (!roll) {
          throw Object.assign(
            new Error(`اللفة غير موجودة: ${alloc.rollId}`),
            { status: 400 }
          );
        }
        if (!["AVAILABLE", "PARTIALLY_CUT"].includes(roll.status)) {
          throw Object.assign(
            new Error(
              `اللفة ${alloc.rollId} غير متاحة (الحالة: ${roll.status})`
            ),
            { status: 400 }
          );
        }
        const remaining = parseFloat(roll.remaining_length);
        if (parseFloat(alloc.length) > remaining) {
          throw Object.assign(
            new Error(
              `الطول المتاح غير كافٍ: ${remaining} متر في اللفة ${alloc.rollId}`
            ),
            { status: 400 }
          );
        }
      }
    } else {
      // Non-fabric: validate stock
      const invData = inventoryByLine.get(line.itemId);
      const available = invData?.inventory
        ? parseFloat(invData.inventory.quantity)
        : 0;
      const qty = parseFloat(line.quantity);
      if (qty > available) {
        throw Object.assign(
          new Error(
            `الكمية المتاحة غير كافية: ${available} ${item.unit || ""} من ${item.name}`
          ),
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

  const resolved = await resolveBulkPrices(
    tx,
    clientId || null,
    pricingLines,
    tierOverride || null
  );

  return lineItems.map((line) => {
    const resolvedPrice = resolved.get(line.itemId);
    const serverPrice = resolvedPrice
      ? resolvedPrice.effectivePrice
      : parseFloat(itemMap.get(line.itemId)?.price || 0);

    let finalPrice = serverPrice;
    let priceSource = resolvedPrice?.priceSource || "base_price";
    let priceOverrideReason = null;

    // If client sent a unitPrice that differs from resolved, require reason
    if (line.unitPrice !== undefined && line.unitPrice !== null) {
      const clientPrice = parseFloat(line.unitPrice);
      if (Math.abs(clientPrice - serverPrice) > 0.01) {
        if (!line.priceOverrideReason || !line.priceOverrideReason.trim()) {
          throw Object.assign(
            new Error(
              `سعر ${itemMap.get(line.itemId)?.name} يختلف عن السعر المحدد (${serverPrice}). يجب تحديد سبب تعديل السعر`
            ),
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
  const { itemMap, warehouseId } = context;
  const pendingRollCuts = []; // { cutId, lineItemId } for backfill in Step 6

  for (const line of resolvedLines) {
    const item = itemMap.get(line.itemId);

    if (item.itemType === "FABRIC") {
      // Cut each roll allocation (mirrors fabricRolls.js cut logic)
      for (const alloc of line.rollAllocations) {
        const cutLen = parseFloat(alloc.length);

        // Read current remaining to compute new status
        const roll = await tx.fabricRoll.findUnique({
          where: { id: alloc.rollId },
          select: { remainingLength: true, itemId: true, warehouseId: true },
        });
        const newRemaining = parseFloat(roll.remainingLength) - cutLen;
        const newStatus = newRemaining <= 0.001 ? "DEPLETED" : "PARTIALLY_CUT";

        // Update roll
        await tx.fabricRoll.update({
          where: { id: alloc.rollId },
          data: {
            remainingLength: newRemaining,
            status: newStatus,
            lastCutAt: new Date(),
          },
        });

        // Create cut record (saleItemId = null, backfilled in Step 6)
        const cut = await tx.fabricRollCut.create({
          data: {
            fabricRollId: alloc.rollId,
            lengthCut: cutLen,
            saleItemId: null,
            notes: "POS sale cut",
          },
        });

        pendingRollCuts.push({
          cutId: cut.id,
          lineItemId: line.itemId,
          rollId: alloc.rollId,
        });

        // Decrement inventory for fabric item
        await tx.inventory.update({
          where: {
            itemId_warehouseId: {
              itemId: roll.itemId,
              warehouseId: roll.warehouseId,
            },
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

async function createSaleAndItems(
  tx,
  resolvedLines,
  body,
  shift,
  user,
  config
) {
  const {
    clientId,
    paymentMethod,
    paidAmount,
    notes,
    tierOverride,
    tierOverrideReason,
  } = body;

  // Compute totals
  let subtotal = 0;
  for (const line of resolvedLines) {
    subtotal += line.resolvedUnitPrice * parseFloat(line.quantity);
  }
  subtotal = Math.round(subtotal * 100) / 100;

  // Tax
  const taxEnabled = config.taxEnabledOnSales !== false;
  const taxRateDecimal = taxEnabled ? parseFloat(config.taxRate) / 100 : 0;
  const taxAmount = Math.round(subtotal * taxRateDecimal * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Payment validation
  const paid = parseFloat(paidAmount);
  const method = paymentMethod || "CASH";
  if (method === "CASH" && paid < total - 0.01) {
    throw Object.assign(
      new Error(
        `المبلغ المدفوع (${paid}) أقل من إجمالي الفاتورة (${total})`
      ),
      { status: 400 }
    );
  }
  if (
    ["INSTAPAY", "VISA"].includes(method) &&
    Math.abs(paid - total) > 0.01
  ) {
    throw Object.assign(
      new Error(
        `يجب أن يكون المبلغ المدفوع مساوياً للإجمالي عند الدفع بـ ${method}`
      ),
      { status: 400 }
    );
  }
  const changeAmount =
    method === "CASH" ? Math.round((paid - total) * 100) / 100 : 0;

  const saleNumber = await generateSaleNumber(tx);

  // Walk-in defaults to client ID 1
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
      taxRate: taxRateDecimal,
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
          total:
            Math.round(
              line.resolvedUnitPrice * parseFloat(line.quantity) * 100
            ) / 100,
        })),
      },
    },
    include: {
      items: {
        include: {
          item: true,
          fabricRollCuts: { include: { fabricRoll: true } },
        },
      },
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
    priceOverrides: resolvedLines
      .filter((l) => l.priceOverrideReason)
      .map((l) => ({
        itemId: l.itemId,
        reason: l.priceOverrideReason,
        finalPrice: l.resolvedUnitPrice,
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
        new Error(
          "إعدادات النظام غير مكتملة — لا يوجد خزينة بنكية محددة"
        ),
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
    companyNameEnglish: config?.companyNameEnglish || "Ramex Store",
    taxNumber: config?.taxNumber || "",
    address: config?.address || "",
    phone: config?.phone || "",
    logoUrl: config?.logoUrl || "",
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
