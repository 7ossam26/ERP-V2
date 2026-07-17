/**
 * productionService.js
 *
 * Shared production routine used by every path that turns BOM components into
 * a finished good, so they can't diverge:
 *   - manual production orders          (routes/bom.js  POST /:id/execute)
 *   - opening-inventory production       (routes/initialInventory.js POST /bom)
 *   - (POS auto-produce keeps its own inline flow but mirrors the cost logic)
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

module.exports = { executeProductionInTx };
