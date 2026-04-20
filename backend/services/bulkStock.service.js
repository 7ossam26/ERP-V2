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
 * direction = 'DEBIT' on confirm (deduct), 'CREDIT' on return (restore).
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
      await tx.inventory.update({
        where: {
          itemId_warehouseId: {
            itemId: line.itemId,
            warehouseId: order.warehouseId,
          },
        },
        data: { quantity: { decrement: qty } },
      });
    } else {
      await tx.inventory.upsert({
        where: {
          itemId_warehouseId: {
            itemId: line.itemId,
            warehouseId: order.warehouseId,
          },
        },
        create: {
          itemId: line.itemId,
          warehouseId: order.warehouseId,
          quantity: qty,
        },
        update: { quantity: { increment: qty } },
      });
    }
  }
}

module.exports = { assertStockAvailable, applyBulkOrderStockMovement };
