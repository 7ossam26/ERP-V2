// services/bulkStock.service.js
// Stock movement helpers for Bulk POS. Mirrors the inventory.update pattern
// used by routes/sales.js — no backorders, hard reject if any line goes
// negative on confirm.
//
// With `autoProduce: true`, a short line whose item has an active BOM is
// produced from raw materials first (the same thing POS does), so made-to-order
// products can be sold wholesale instead of always failing the stock check.

const { deductStockWithAutoProduceInTx } = require("../lib/productionService");

/**
 * Verify every line has enough on-hand stock at the order's warehouse.
 * Throws an Error with .code = 'INSUFFICIENT_STOCK' and .details listing the
 * offending lines.
 *
 * @param {object} tx Prisma transaction client
 * @param {{ warehouseId: number, items: { itemId: number, quantity: number }[] }} order
 */
async function assertStockAvailable(tx, order) {
  const offenders = [];
  for (const line of order.items) {
    const inv = await tx.inventory.findUnique({
      where: {
        itemId_warehouseId: {
          itemId: line.itemId,
          warehouseId: order.warehouseId,
        },
      },
      select: { quantity: true, item: { select: { name: true } } },
    });
    const available = inv ? Number(inv.quantity) : 0;
    if (available < Number(line.quantity)) {
      offenders.push({
        itemId: line.itemId,
        itemName: inv?.item?.name || `#${line.itemId}`,
        requested: Number(line.quantity),
        available,
      });
    }
  }
  if (offenders.length > 0) {
    const err = new Error(
      `Insufficient stock for ${offenders.length} line(s): ${offenders
        .map((o) => `${o.itemName} (need ${o.requested}, have ${o.available})`)
        .join("; ")}`,
    );
    err.code = "INSUFFICIENT_STOCK";
    err.status = 409;
    err.details = offenders;
    throw err;
  }
}

/**
 * Apply a stock movement for a confirmed bulk order.
 *
 * DEBIT (confirm): uses a conditional updateMany so the check-and-decrement is
 * atomic — two concurrent confirms cannot both pass the stock check and oversell.
 * Throws INSUFFICIENT_STOCK (status 409) if any line lacks stock at deduct time.
 *
 * CREDIT (return): upserts inventory back to the warehouse.
 *
 * @param {object} tx Prisma transaction client
 * @param {{ id: number, warehouseId: number, items: { itemId: number, quantity: number }[] }} order
 * @param {'DEBIT' | 'CREDIT'} direction
 * @param {object} [opts]
 * @param {boolean} [opts.autoProduce=false] produce short lines from their BOM
 * @param {number} [opts.createdById] actor recorded on any ProductionOrder
 * @param {string} [opts.notes] ProductionOrder.notes
 * @returns {Promise<Array<{itemId:number, itemName:string, produced:number}>>}
 *   what was auto-produced (empty for CREDIT or when nothing needed making)
 */
async function applyBulkOrderStockMovement(tx, order, direction, opts = {}) {
  if (direction !== "DEBIT" && direction !== "CREDIT") {
    throw new Error(`applyBulkOrderStockMovement: invalid direction ${direction}`);
  }

  const { autoProduce = false, createdById = null, notes = null } = opts;
  const produced = [];

  for (const line of order.items) {
    const qty = Number(line.quantity);

    if (direction === "DEBIT") {
      // Atomic check-and-decrement: only succeeds when quantity >= qty. When it
      // can't and the item is manufacturable, the helper makes up the shortfall
      // and retries the same guarded write — so the oversell guarantee holds.
      try {
        const r = await deductStockWithAutoProduceInTx(tx, {
          itemId: line.itemId,
          warehouseId: order.warehouseId,
          quantity: qty,
          createdById,
          notes,
          autoProduce,
        });
        if (r.produced > 0) {
          produced.push({ itemId: r.itemId, itemName: r.itemName, produced: r.produced });
        }
      } catch (e) {
        // Keep bulk's established error contract: a plain shortage stays
        // INSUFFICIENT_STOCK/409 with .details, so existing callers and UI
        // handling don't change. Missing raw materials is a distinct case.
        if (e.code === "OUT_OF_STOCK") {
          const itemName = e.itemName || `item #${line.itemId}`;
          const available = Number(e.available) || 0;
          const err = new Error(
            `Insufficient stock for ${itemName}: need ${qty}, have ${available}`,
          );
          err.code = "INSUFFICIENT_STOCK";
          err.status = 409;
          err.details = [{ itemId: line.itemId, itemName, requested: qty, available }];
          throw err;
        }
        if (e.code === "INSUFFICIENT_RAW_MATERIALS") {
          e.status = 409;
        }
        throw e;
      }
    } else {
      await tx.inventory.upsert({
        where: {
          itemId_warehouseId: {
            itemId: line.itemId,
            warehouseId: order.warehouseId,
          },
        },
        create: { itemId: line.itemId, warehouseId: order.warehouseId, quantity: qty },
        update: { quantity: { increment: qty } },
      });
    }
  }

  return produced;
}

module.exports = { assertStockAvailable, applyBulkOrderStockMovement };
