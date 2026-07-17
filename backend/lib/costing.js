/**
 * costing.js
 *
 * Resolves the cost-per-unit to snapshot onto a sale line (SaleItem.costPrice)
 * so profit reporting can subtract COGS using the cost at the time of sale.
 *
 * Rules:
 *   - Plain item  -> Item.costPrice.
 *   - If that item is a manufactured good with a linked BOM and no cost set yet
 *     (costPrice = 0), fall back to the recipe make-cost so the very first sale
 *     (before any production has stamped a cost) still snapshots a real cost.
 *   - Line sold directly as a BOM (bomId, e.g. an unlinked phantom BOM) -> the
 *     recipe make-cost.
 */

/** Per-output-unit make-cost of a BOM from its components' current costPrice. */
function bomMakeUnitCost(bom) {
  if (!bom || !Array.isArray(bom.items)) return 0;
  const total = bom.items.reduce(
    (sum, bi) => sum + Number(bi.item?.costPrice || 0) * Number(bi.quantity),
    0,
  );
  const out = Number(bom.outputQuantity) || 1;
  return out > 0 ? total / out : 0;
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient|import('@prisma/client').PrismaClient} db
 * @param {{itemId?: number|null, bomId?: number|null}} line
 * @returns {Promise<number>} cost per unit (always >= 0)
 */
async function resolveSaleLineUnitCost(db, { itemId, bomId }) {
  if (itemId) {
    const it = await db.item.findUnique({
      where: { id: itemId },
      select: { costPrice: true },
    });
    const cost = Number(it?.costPrice || 0);
    if (cost > 0) return cost;

    // Manufactured item with no stamped cost yet — derive from its recipe.
    const linkedBom = await db.bOM.findFirst({
      where: { outputItemId: itemId },
      include: { items: { include: { item: true } } },
    });
    return linkedBom ? bomMakeUnitCost(linkedBom) : 0;
  }

  if (bomId) {
    const bom = await db.bOM.findUnique({
      where: { id: bomId },
      include: { items: { include: { item: true } } },
    });
    return bom ? bomMakeUnitCost(bom) : 0;
  }

  return 0;
}

module.exports = { bomMakeUnitCost, resolveSaleLineUnitCost };
