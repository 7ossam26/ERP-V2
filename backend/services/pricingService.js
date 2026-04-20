/**
 * Tier-based price resolution service.
 *
 * Resolution order per item:
 *   1. PriceTier matching (tierName, minQty <= quantity, isActive) — highest minQty wins
 *   2. Item.price (base sell price)
 */

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {number|null} clientId - null = walk-in → RETAIL
 * @param {Array<{itemId: number, quantity: number}>} lines
 * @param {string|null} tierOverride - "RETAIL" | "WHOLESALE"
 * @returns {Promise<Map<number, {effectivePrice: number, priceSource: string, tierName: string|null}>>}
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

  // Batch-load all items and their active price tiers (highest minQty first)
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

    // Best match: tierName matches AND minQty <= requested qty (already sorted desc)
    const matchingTier = item.priceTiers.find(
      (pt) => pt.tierName === tier && parseFloat(pt.minQty) <= qty
    );

    if (matchingTier) {
      result.set(item.id, {
        effectivePrice: parseFloat(matchingTier.price),
        priceSource: "tier_price",
        tierName: matchingTier.tierName,
      });
    } else {
      result.set(item.id, {
        effectivePrice: parseFloat(item.price),
        priceSource: "base_price",
        tierName: null,
      });
    }
  }

  return result;
}

module.exports = { resolveBulkPrices };
