// services/bulkPricing.service.js
// Resolves the price to suggest for a (customer, item) pair: contract override
// first, item base price second. Reps may override at line level — that is
// recorded on the order line, not mutated back into the contract row.

/**
 * @param {object} tx Prisma transaction client (or the prisma singleton)
 * @param {number} customerId
 * @param {number} itemId
 * @returns {Promise<{ price: number, source: 'CONTRACT' | 'BASE' } | null>}
 *          null if the item itself does not exist
 */
async function resolvePrice(tx, customerId, itemId) {
  const override = await tx.bulkContractPrice.findUnique({
    where: { customerId_itemId: { customerId, itemId } },
    select: { price: true },
  });
  if (override) return { price: Number(override.price), source: "CONTRACT" };

  const item = await tx.item.findUnique({
    where: { id: itemId },
    select: { price: true },
  });
  if (!item) return null;
  return { price: Number(item.price), source: "BASE" };
}

module.exports = { resolvePrice };
