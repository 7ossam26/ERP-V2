/**
 * Branch isolation for sell-time auto-production.
 *
 * The requirement: a selected branch resolves to exactly one warehouse, and the
 * finished-stock check, the BOM raw-material check, the production itself and the
 * final deduction all happen in THAT warehouse. Raw materials sitting in another
 * branch must never be consumed and must never make an item sellable.
 *
 * autoProduce.test.js covers the production logic but its fixture is deliberately
 * warehouse-blind — it serves `rawStock` keyed by itemId alone, so a query against
 * the wrong warehouse would still find stock and every test would still pass. This
 * file exists to close that hole: the fixture below is a real per-(item, warehouse)
 * ledger that MUTATES, so a cross-branch read or write is observable as a changed
 * quantity in a branch that should never have been touched.
 */

const {
  deductStockWithAutoProduceInTx,
} = require("../../lib/productionService");

// Branch A and branch B, each with its own warehouse (Branch.warehouseId is a
// unique 1:1 FK, so one warehouse per branch is the real schema shape).
const WH_A = 100;
const WH_B = 300;

const CAKE = 1; // finished good, made to order
const FLOUR = 50; // its only raw material

/**
 * A mutating inventory ledger keyed "itemId:warehouseId".
 *
 * Every read and write honours warehouseId, which is the whole point: if the code
 * under test ever queried or wrote the wrong warehouse, the assertions on the
 * other branch's untouched quantities would fail.
 *
 * @param {Record<string, number>} seed  "itemId:warehouseId" → quantity
 * @param {object|null} bom             BOM returned for the finished good
 */
function makeLedgerTx(seed, bom = null) {
  const stock = new Map(Object.entries(seed).map(([k, v]) => [k, Number(v)]));
  const key = (itemId, warehouseId) => `${itemId}:${warehouseId}`;
  const names = { [CAKE]: "كيك", [FLOUR]: "دقيق" };

  const tx = {
    inventory: {
      // The authoritative conditional decrement. Only succeeds when THIS
      // warehouse holds enough — stock in another branch must not help.
      updateMany: jest.fn(async ({ where, data }) => {
        const k = key(where.itemId, where.warehouseId);
        const have = stock.get(k);
        const need = where.quantity.gte;
        if (have === undefined || have < need) return { count: 0 };
        stock.set(k, have - Number(data.quantity.decrement));
        return { count: 1 };
      }),

      findUnique: jest.fn(async ({ where }) => {
        const { itemId, warehouseId } = where.itemId_warehouseId;
        const k = key(itemId, warehouseId);
        if (!stock.has(k)) return null;
        return {
          itemId,
          warehouseId,
          quantity: stock.get(k),
          item: { name: names[itemId] || `item-${itemId}`, reorderPoint: 5 },
        };
      }),

      // Raw-material availability check inside executeProductionInTx.
      findMany: jest.fn(async ({ where }) =>
        where.itemId.in
          .map((itemId) => ({
            itemId,
            warehouseId: where.warehouseId,
            quantity: stock.get(key(itemId, where.warehouseId)),
          }))
          .filter((row) => row.quantity !== undefined),
      ),

      // Raw-material deduction and finished-good credit.
      upsert: jest.fn(async ({ where, update, create }) => {
        const { itemId, warehouseId } = where.itemId_warehouseId;
        const k = key(itemId, warehouseId);
        if (!stock.has(k)) {
          stock.set(k, Number(create.quantity));
          return { itemId, warehouseId, quantity: stock.get(k) };
        }
        const delta = update.quantity.increment ?? -update.quantity.decrement;
        stock.set(k, stock.get(k) + Number(delta));
        return { itemId, warehouseId, quantity: stock.get(k) };
      }),
    },
    item: {
      findUnique: jest.fn(async ({ where }) => ({
        name: names[where.id] || `item-${where.id}`,
        reorderPoint: 5,
      })),
      update: jest.fn(async () => ({})),
    },
    bOM: { findFirst: jest.fn(async () => bom) },
    productionOrder: { create: jest.fn(async () => ({ id: 99 })) },
  };

  tx.qty = (itemId, warehouseId) => stock.get(key(itemId, warehouseId));
  return tx;
}

const bomFor = (components, outputQuantity = 1) => ({
  id: 7,
  name: "وصفة كيك",
  outputItemId: CAKE,
  outputQuantity,
  items: components.map(([itemId, quantity, costPrice = 1]) => ({
    itemId,
    quantity,
    item: { id: itemId, name: `مادة-${itemId}`, costPrice },
  })),
});

/** Every warehouse id this tx was ever asked about, across every inventory call. */
function warehousesTouched(tx) {
  const seen = new Set();
  for (const [{ where }] of tx.inventory.updateMany.mock.calls) seen.add(where.warehouseId);
  for (const [{ where }] of tx.inventory.findUnique.mock.calls) {
    seen.add(where.itemId_warehouseId.warehouseId);
  }
  for (const [{ where }] of tx.inventory.findMany.mock.calls) seen.add(where.warehouseId);
  for (const [{ where }] of tx.inventory.upsert.mock.calls) {
    seen.add(where.itemId_warehouseId.warehouseId);
  }
  return [...seen];
}

describe("auto-production is confined to the selected branch's warehouse", () => {
  // The scenario from the requirement: branch A has no finished stock but enough
  // raw materials of its own; branch B also has raw materials. Selecting A must
  // produce from A and leave B completely alone.
  test("produces from the selected branch when its own raw materials suffice", async () => {
    const tx = makeLedgerTx(
      {
        [`${CAKE}:${WH_A}`]: 0,
        [`${FLOUR}:${WH_A}`]: 100,
        [`${FLOUR}:${WH_B}`]: 1000, // must not move
      },
      bomFor([[FLOUR, 1]]),
    );

    const r = await deductStockWithAutoProduceInTx(tx, {
      itemId: CAKE,
      warehouseId: WH_A,
      quantity: 5,
      createdById: 3,
    });

    expect(r.produced).toBe(5);
    // Branch A paid for it: 100 flour − 5 consumed.
    expect(tx.qty(FLOUR, WH_A)).toBe(95);
    // Produced 5, sold 5 — net zero, all inside branch A.
    expect(tx.qty(CAKE, WH_A)).toBe(0);
    // Branch B is untouched, to the unit.
    expect(tx.qty(FLOUR, WH_B)).toBe(1000);
    expect(warehousesTouched(tx)).toEqual([WH_A]);
  });

  test("source and destination warehouse are always the selected one", async () => {
    const tx = makeLedgerTx(
      { [`${CAKE}:${WH_A}`]: 0, [`${FLOUR}:${WH_A}`]: 50, [`${FLOUR}:${WH_B}`]: 50 },
      bomFor([[FLOUR, 2]]),
    );

    await deductStockWithAutoProduceInTx(tx, {
      itemId: CAKE,
      warehouseId: WH_A,
      quantity: 3,
      createdById: 3,
    });

    // The ProductionOrder audit row must not straddle two branches.
    const { data } = tx.productionOrder.create.mock.calls[0][0];
    expect(data.sourceWarehouseId).toBe(WH_A);
    expect(data.destWarehouseId).toBe(WH_A);
  });

  // The opposite case from the requirement, and the one that matters most:
  // branch A cannot cover it, branch B could — selecting A must still fail.
  test("refuses to produce using another branch's raw materials", async () => {
    const tx = makeLedgerTx(
      {
        [`${CAKE}:${WH_A}`]: 0,
        [`${FLOUR}:${WH_A}`]: 1, // needs 10
        [`${FLOUR}:${WH_B}`]: 1000, // plentiful, and irrelevant
      },
      bomFor([[FLOUR, 10]]),
    );

    const err = await deductStockWithAutoProduceInTx(tx, {
      itemId: CAKE,
      warehouseId: WH_A,
      quantity: 1,
      createdById: 3,
    })
      .then(() => null)
      .catch((e) => e);

    expect(err).toBeTruthy();
    expect(err.code).toBe("INSUFFICIENT_RAW_MATERIALS");
    // The shortage is reported from branch A's shelf, not the company total.
    expect(err.details).toEqual([
      expect.objectContaining({ itemId: FLOUR, available: 1, required: 10 }),
    ]);
    // Nothing was produced and nothing moved, in either branch.
    expect(tx.productionOrder.create).not.toHaveBeenCalled();
    expect(tx.inventory.upsert).not.toHaveBeenCalled();
    expect(tx.qty(FLOUR, WH_A)).toBe(1);
    expect(tx.qty(FLOUR, WH_B)).toBe(1000);
    expect(warehousesTouched(tx)).toEqual([WH_A]);
  });

  test("another branch's finished stock does not satisfy the sale", async () => {
    const tx = makeLedgerTx(
      {
        [`${CAKE}:${WH_A}`]: 0,
        [`${CAKE}:${WH_B}`]: 50, // plenty at B, none at A
      },
      null, // no BOM — so the only way to succeed would be B's shelf
    );

    const err = await deductStockWithAutoProduceInTx(tx, {
      itemId: CAKE,
      warehouseId: WH_A,
      quantity: 4,
      createdById: 3,
    })
      .then(() => null)
      .catch((e) => e);

    expect(err.code).toBe("OUT_OF_STOCK");
    expect(err.available).toBe(0); // A's figure, not 50
    expect(tx.qty(CAKE, WH_B)).toBe(50);
  });

  // Same data, same BOM, only the selected branch differs — so any leak would
  // show up as the two branches behaving alike.
  test("the same item is producible at one branch and not the other", async () => {
    const seed = {
      [`${CAKE}:${WH_A}`]: 0,
      [`${CAKE}:${WH_B}`]: 0,
      [`${FLOUR}:${WH_A}`]: 2, // needs 10 → cannot
      [`${FLOUR}:${WH_B}`]: 500, // → can
    };
    const call = (warehouseId) =>
      deductStockWithAutoProduceInTx(
        makeLedgerTx(seed, bomFor([[FLOUR, 10]])),
        { itemId: CAKE, warehouseId, quantity: 1, createdById: 3 },
      );

    await expect(call(WH_A)).rejects.toMatchObject({
      code: "INSUFFICIENT_RAW_MATERIALS",
    });
    // One run makes one cake out of ten flour, which only branch B can afford.
    await expect(call(WH_B)).resolves.toMatchObject({ produced: 1 });
  });
});
