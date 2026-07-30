/**
 * sellableCatalog.js
 *
 * The single BOM-aware "what can this warehouse sell right now" calculation,
 * shared by every non-POS channel (call center, wholesale) so availability can't
 * drift between screens.
 *
 * A made-to-order product sits at zero on-hand until someone actually orders it,
 * so on-hand alone reports it as نفد and the operator can never sell it. POS
 * solves this client-side by adding `autoProducible` — how many units the raw
 * materials could still make — on top of real stock. This module is the
 * server-side equivalent of POSPage.loadInventory()'s BOM pass, so the other
 * channels get the same number without reimplementing it per page.
 *
 * Rows are keyed by Item.id, never by POS's `bom_<id>` pseudo-ids: both write
 * paths (SaleItem.itemId, BulkOrderItem.itemId) store integer item ids, so the
 * catalog and the order payload stay in one key space. Only BOMs with a linked
 * outputItemId contribute — that is every BOM the UI can create, since
 * POST/PUT /bom auto-create the output Item when none is supplied.
 */

/**
 * How many extra units of a BOM's output the raw materials on hand could make.
 * Mirrors POSPage.jsx's BOM pass, including its edge cases: components with a
 * non-positive requirement are skipped, a BOM with no components yields 0, and
 * a component with no inventory row counts as zero stock.
 *
 * @param {{outputQuantity: any, items: {itemId: number, quantity: any}[]}} bom
 * @param {Map<number, number>} stockByItemId
 * @returns {number} producible output units, rounded to 4 dp
 */
function computeAutoProducible(bom, stockByItemId) {
  if (!bom || !Array.isArray(bom.items) || bom.items.length === 0) return 0;

  const maxRuns = bom.items.reduce((min, component) => {
    const required = Number(component.quantity);
    if (!(required > 0)) return min;
    const available = Number(stockByItemId.get(component.itemId) || 0);
    return Math.min(min, available / required);
  }, Infinity);

  if (maxRuns === Infinity) return 0;

  const outputPerRun = Number(bom.outputQuantity) || 1;
  return parseFloat((maxRuns * outputPerRun).toFixed(4));
}

/**
 * Build the sellable catalog for one warehouse.
 *
 * Two queries, never one per BOM: the inventory sweep is unfiltered by item so
 * raw-material stock is available even when `onlyShowInPos` excludes those rows
 * from the item query — without it every `autoProducible` would come out zero.
 *
 * @param {import('@prisma/client').PrismaClient} db prisma or a tx client
 * @param {Object} opts
 * @param {number} opts.warehouseId
 * @param {boolean} [opts.onlyShowInPos=true] restrict to items flagged for sale
 * @param {Object} [opts.itemWhere] extra Prisma `where` merged into the item query
 * @returns {Promise<Array>} catalog rows (see module docs for the shape)
 */
async function buildSellableCatalog(db, { warehouseId, onlyShowInPos = true, itemWhere }) {
  const warehouse = parseInt(warehouseId);

  const [inventoryRows, items] = await Promise.all([
    db.inventory.findMany({
      where: { warehouseId: warehouse },
      select: { itemId: true, quantity: true },
    }),
    db.item.findMany({
      where: {
        ...(onlyShowInPos ? { showInPos: true } : {}),
        ...(itemWhere || {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        showInPos: true,
        reorderPoint: true,
        categories: {
          select: { category: { select: { id: true, name: true } } },
        },
        // Same relation + filter routes/inventory.js uses to derive `hasBom`.
        bomOutputs: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            name: true,
            outputQuantity: true,
            items: { select: { itemId: true, quantity: true } },
          },
        },
      },
    }),
  ]);

  const stockByItemId = new Map(
    inventoryRows.map((row) => [row.itemId, Number(row.quantity)]),
  );

  return items.map((item) => {
    const bom = item.bomOutputs[0] || null;
    const stock = Number(stockByItemId.get(item.id) || 0);
    const autoProducible = bom ? computeAutoProducible(bom, stockByItemId) : 0;

    return {
      id: item.id,
      name: item.name,
      price: Number(item.price),
      unit: item.unit,
      categories: item.categories.map((c) => c.category),
      stock,
      autoProducible,
      // What the UI gates on. Everything else is for badges and diagnostics.
      available: parseFloat((stock + autoProducible).toFixed(4)),
      hasBom: !!bom,
      bomId: bom ? bom.id : null,
      bomName: bom ? bom.name : null,
      showInPos: item.showInPos,
      reorderPoint: item.reorderPoint,
    };
  });
}

module.exports = { computeAutoProducible, buildSellableCatalog };
