// services/bulkStock.service.js
// Stock movement helpers for Bulk POS. Mirrors the inventory.update pattern
// used by routes/sales.js — no backorders, hard reject if any line goes
// negative on confirm.

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
 */
async function applyBulkOrderStockMovement(tx, order, direction) {
  if (direction !== "DEBIT" && direction !== "CREDIT") {
    throw new Error(`applyBulkOrderStockMovement: invalid direction ${direction}`);
  }

  for (const line of order.items) {
    const qty = Number(line.quantity);

    if (direction === "DEBIT") {
      // Atomic check-and-decrement: only succeeds when quantity >= qty.
      // If count=0, either no inventory row exists or stock was exhausted by a
      // concurrent confirm — either way, reject with a clear error.
      const result = await tx.inventory.updateMany({
        where: {
          itemId: line.itemId,
          warehouseId: order.warehouseId,
          quantity: { gte: qty },
        },
        data: { quantity: { decrement: qty } },
      });
      if (result.count === 0) {
        const inv = await tx.inventory.findUnique({
          where: { itemId_warehouseId: { itemId: line.itemId, warehouseId: order.warehouseId } },
          select: { quantity: true, item: { select: { name: true } } },
        });
        const available = inv ? Number(inv.quantity) : 0;
        const itemName = inv?.item?.name || `item #${line.itemId}`;
        const err = new Error(
          `Insufficient stock for ${itemName}: need ${qty}, have ${available}`,
        );
        err.code = "INSUFFICIENT_STOCK";
        err.status = 409;
        err.details = [{ itemId: line.itemId, itemName, requested: qty, available }];
        throw err;
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
}

module.exports = { assertStockAvailable, applyBulkOrderStockMovement };
