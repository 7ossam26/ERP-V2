/**
 * productionService.js
 *
 * Shared production routine used by every path that turns BOM components into
 * a finished good, so they can't diverge:
 *   - manual production orders          (routes/bom.js  POST /:id/execute)
 *   - opening-inventory production       (routes/initialInventory.js POST /bom)
 *   - sell-time auto-production          (deductStockWithAutoProduceInTx below,
 *     used by the call-center and wholesale write paths)
 *   - (POS auto-produce in routes/sales.js keeps its own inline flow but mirrors
 *     the cost logic)
 *
 * It consumes component stock from a source warehouse, adds finished output to
 * a destination warehouse, records a ProductionOrder (+ items), and refreshes
 * the finished item's costPrice to the per-unit make-cost so COGS snapshots and
 * inventory valuation stay correct.
 *
 * MUST be called inside a Prisma interactive transaction (`tx`).
 */

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {Object} opts
 * @param {Object} opts.bom            BOM including items[].item (with costPrice)
 * @param {number} opts.sourceWarehouseId
 * @param {number} [opts.destWarehouseId]     defaults to sourceWarehouseId
 * @param {number} opts.targetOutputQty
 * @param {number} opts.actualOutputQty
 * @param {number} opts.createdById
 * @param {string} [opts.notes]
 * @param {boolean} [opts.validateStock=true] throw if a component is short
 * @param {Object} [opts.componentUnitCosts]  map itemId -> unit cost override
 * @param {boolean} [opts.updateOutputCost=true] refresh finished item costPrice
 * @returns {Promise<{order:Object,totalCost:number,unitCost:number,materialUsage:Array}>}
 */
async function executeProductionInTx(tx, opts) {
  const {
    bom,
    sourceWarehouseId,
    destWarehouseId = sourceWarehouseId,
    targetOutputQty,
    actualOutputQty,
    createdById,
    notes = null,
    validateStock = true,
    componentUnitCosts = null,
    updateOutputCost = true,
  } = opts;

  const source = parseInt(sourceWarehouseId);
  const dest = destWarehouseId != null ? parseInt(destWarehouseId) : null;
  const target = parseFloat(targetOutputQty);
  const actual = parseFloat(actualOutputQty);
  const waste = parseFloat((target - actual).toFixed(3));
  const multiplier = target / parseFloat(bom.outputQuantity);

  const overrideFor = (itemId) => {
    if (!componentUnitCosts) return undefined;
    const v =
      typeof componentUnitCosts.get === "function"
        ? componentUnitCosts.get(itemId)
        : componentUnitCosts[itemId];
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const materialUsage = bom.items.map((bi) => {
    const override = overrideFor(bi.itemId);
    return {
      itemId: bi.itemId,
      itemName: bi.item.name,
      quantityUsed: parseFloat((parseFloat(bi.quantity) * multiplier).toFixed(6)),
      costPrice:
        override !== undefined ? override : parseFloat(bi.item.costPrice || 0),
    };
  });

  if (validateStock) {
    const invs = await tx.inventory.findMany({
      where: {
        warehouseId: source,
        itemId: { in: materialUsage.map((m) => m.itemId) },
      },
    });
    const shortages = [];
    for (const mat of materialUsage) {
      const inv = invs.find((i) => i.itemId === mat.itemId);
      const available = inv ? parseFloat(inv.quantity) : 0;
      if (available < mat.quantityUsed) {
        shortages.push({
          itemId: mat.itemId,
          itemName: mat.itemName,
          available,
          required: mat.quantityUsed,
        });
      }
    }
    if (shortages.length > 0) {
      const err = new Error("رصيد غير كافٍ لبعض المواد الخام");
      err.status = 400;
      err.shortages = shortages;
      throw err;
    }
  }

  const totalCost = materialUsage.reduce(
    (sum, m) => sum + m.costPrice * m.quantityUsed,
    0,
  );
  const unitCost = actual > 0 ? totalCost / actual : 0;

  // 1. Deduct raw materials from the source warehouse.
  for (const mat of materialUsage) {
    await tx.inventory.upsert({
      where: {
        itemId_warehouseId: { itemId: mat.itemId, warehouseId: source },
      },
      update: { quantity: { decrement: mat.quantityUsed } },
      create: { itemId: mat.itemId, warehouseId: source, quantity: 0 },
    });
  }

  // 2. Add finished goods to the destination warehouse.
  if (bom.outputItemId && dest) {
    await tx.inventory.upsert({
      where: {
        itemId_warehouseId: { itemId: bom.outputItemId, warehouseId: dest },
      },
      update: { quantity: { increment: actual } },
      create: { itemId: bom.outputItemId, warehouseId: dest, quantity: actual },
    });
  }

  // 3. Refresh the finished item's cost so COGS/valuation use the make-cost.
  if (updateOutputCost && bom.outputItemId && actual > 0) {
    await tx.item.update({
      where: { id: bom.outputItemId },
      data: { costPrice: parseFloat(unitCost.toFixed(2)) },
    });
  }

  // 4. Record the production order (audit trail).
  const order = await tx.productionOrder.create({
    data: {
      bomId: bom.id,
      sourceWarehouseId: source,
      destWarehouseId: dest,
      targetOutputQty: target,
      actualOutputQty: actual,
      outputWasteQty: waste,
      totalCost: parseFloat(totalCost.toFixed(2)),
      notes,
      createdById,
      items: {
        create: materialUsage.map((m) => ({
          itemId: m.itemId,
          quantityUsed: m.quantityUsed,
        })),
      },
    },
    include: {
      bom: { select: { name: true } },
      sourceWarehouse: { select: { name: true } },
      destWarehouse: { select: { name: true } },
      items: { include: { item: { select: { name: true, unit: true } } } },
    },
  });

  return { order, totalCost, unitCost, materialUsage };
}

/**
 * Deduct a sold quantity from a warehouse and, when the finished good is short,
 * make up the difference from its BOM first.
 *
 * Made-to-order products sit at zero on-hand, so a plain conditional decrement
 * rejects every sale of them. POS solves this inline in routes/sales.js; this is
 * the shared version the call-center and wholesale write paths use.
 *
 * The authoritative operation stays a conditional `updateMany` gated on
 * `quantity >= qty`, so two concurrent sellers can never both pass the check and
 * oversell — production is inserted *between* a failed attempt and a retry
 * rather than replacing the check with a read-then-write.
 *
 * MUST be called inside a Prisma interactive transaction (`tx`).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {Object} opts
 * @param {number} opts.itemId
 * @param {number} opts.warehouseId
 * @param {number} opts.quantity        quantity being sold
 * @param {number} opts.createdById     actor, recorded on the ProductionOrder
 * @param {string} [opts.notes]         ProductionOrder.notes — channel-specific
 * @param {boolean} [opts.autoProduce=true] when false, behaves like a plain
 *   conditional decrement (no BOM lookup at all)
 * @returns {Promise<{produced:number, itemId:number, itemName:string|null,
 *   bomId:number|null, bomName:string|null, reorderPoint:number|null,
 *   onHandBefore:number|null}>} On the sufficient-stock path the descriptive
 *   fields are null — resolving them would cost a query nothing needs there.
 * @throws {Error} `.code = 'OUT_OF_STOCK'` (status 400) when short and
 *   unproducible; `.code = 'INSUFFICIENT_RAW_MATERIALS'` (status 400, `.details`
 *   listing shortages) when a BOM exists but its components are short.
 */
async function deductStockWithAutoProduceInTx(tx, opts) {
  const {
    itemId,
    warehouseId,
    quantity,
    createdById,
    notes = null,
    autoProduce = true,
  } = opts;

  const id = parseInt(itemId);
  const warehouse = parseInt(warehouseId);
  const qty = parseFloat(quantity);

  const decrement = () =>
    tx.inventory.updateMany({
      where: { itemId: id, warehouseId: warehouse, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });

  // Fast path — enough on hand. One query, exactly the conditional decrement
  // every caller used before, so the common case costs nothing extra. Name and
  // stock level are only looked up when something actually goes wrong.
  const first = await decrement();
  if (first.count > 0) {
    return {
      produced: 0,
      itemId: id,
      itemName: null,
      bomId: null,
      bomName: null,
      reorderPoint: null,
      onHandBefore: null,
    };
  }

  // Short. One read gives us the shelf quantity plus the name for messages.
  const inv = await tx.inventory.findUnique({
    where: { itemId_warehouseId: { itemId: id, warehouseId: warehouse } },
    select: { quantity: true, item: { select: { name: true, reorderPoint: true } } },
  });
  const onHand = inv ? Number(inv.quantity) : 0;
  let itemName = inv?.item?.name || null;
  let reorderPoint = inv?.item?.reorderPoint ?? null;
  if (!itemName) {
    // No inventory row at all — the item may still be producible.
    const item = await tx.item.findUnique({
      where: { id },
      select: { name: true, reorderPoint: true },
    });
    itemName = item ? item.name : `Item #${id}`;
    reorderPoint = item ? item.reorderPoint : null;
  }

  const bom = autoProduce
    ? await tx.bOM.findFirst({
        where: { outputItemId: id, isActive: true },
        include: { items: { include: { item: true } } },
      })
    : null;

  if (!bom) {
    const err = new Error(
      `Insufficient stock for ${itemName}. Available: ${onHand}, Requested: ${qty}`,
    );
    err.code = "OUT_OF_STOCK";
    err.status = 400;
    err.itemId = id;
    err.itemName = itemName;
    err.available = onHand;
    err.requested = qty;
    throw err;
  }

  // Produce whole runs — a BOM yields outputQuantity per run, so covering the
  // shortfall may leave a remainder as finished stock. Same as POS.
  const shortfall = qty - onHand;
  const outputPerRun = Number(bom.outputQuantity) || 1;
  const runs = Math.ceil(shortfall / outputPerRun);
  const producedQty = parseFloat((runs * outputPerRun).toFixed(4));

  try {
    await executeProductionInTx(tx, {
      bom,
      sourceWarehouseId: warehouse,
      destWarehouseId: warehouse,
      targetOutputQty: producedQty,
      actualOutputQty: producedQty,
      createdById,
      notes,
      validateStock: true,
      updateOutputCost: true,
    });
  } catch (err) {
    if (!Array.isArray(err.shortages)) throw err;
    // Reuse the wording POS users already recognise from routes/sales.js.
    const list = err.shortages
      .map(
        (s) =>
          `${s.itemName} (متاح: ${Number(s.available).toFixed(2)}, مطلوب: ${Number(s.required).toFixed(2)})`,
      )
      .join("، ");
    const wrapped = new Error(
      `لا يمكن إنتاج "${itemName}" تلقائياً — مواد خام غير كافية: ${list}`,
    );
    wrapped.code = "INSUFFICIENT_RAW_MATERIALS";
    wrapped.status = 400;
    wrapped.itemId = id;
    wrapped.itemName = itemName;
    wrapped.details = err.shortages;
    throw wrapped;
  }

  // Retry the same guarded decrement. A second miss means a concurrent seller
  // consumed what we just produced.
  const second = await decrement();
  if (second.count === 0) {
    const err = new Error(
      `Insufficient stock for ${itemName} after auto-production. Requested: ${qty}`,
    );
    err.code = "OUT_OF_STOCK";
    err.status = 400;
    err.itemId = id;
    err.itemName = itemName;
    err.requested = qty;
    throw err;
  }

  return {
    produced: producedQty,
    itemId: id,
    itemName,
    bomId: bom.id,
    bomName: bom.name,
    reorderPoint,
    onHandBefore: onHand,
  };
}

module.exports = { executeProductionInTx, deductStockWithAutoProduceInTx };
