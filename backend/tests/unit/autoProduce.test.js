// Unit tests for productionService.deductStockWithAutoProduceInTx — the shared
// "decrement, and if short make it from the BOM first" routine used by the
// call-center and wholesale write paths.

const {
  deductStockWithAutoProduceInTx,
} = require("../../lib/productionService");

const WAREHOUSE = 7;

/**
 * @param {object} o
 * @param {number} o.onHand              finished-good stock at the warehouse
 * @param {object|null} o.bom            BOM returned for the item, if any
 * @param {Record<number, number>} o.rawStock  componentItemId → quantity
 * @param {number[]} o.decrementCounts   updateMany().count per call, in order
 */
function makeTx({ onHand = 0, bom = null, rawStock = {}, decrementCounts = [] }) {
  let call = 0;
  return {
    inventory: {
      updateMany: jest.fn(async () => ({
        count: decrementCounts[call++] ?? 0,
      })),
      findUnique: jest.fn(async ({ where }) => {
        const { itemId, warehouseId } = where.itemId_warehouseId;
        if (itemId in rawStock) {
          return { itemId, warehouseId, quantity: rawStock[itemId] };
        }
        if (onHand === null) return null;
        return {
          quantity: onHand,
          item: { name: "كيك", reorderPoint: 5 },
        };
      }),
      // executeProductionInTx validates components via findMany then upserts.
      findMany: jest.fn(async ({ where }) =>
        where.itemId.in
          .filter((id) => id in rawStock)
          .map((id) => ({ itemId: id, warehouseId: WAREHOUSE, quantity: rawStock[id] })),
      ),
      upsert: jest.fn(async () => ({})),
    },
    item: {
      findUnique: jest.fn(async () => ({ name: "كيك", reorderPoint: 5 })),
      update: jest.fn(async () => ({})),
    },
    bOM: { findFirst: jest.fn(async () => bom) },
    productionOrder: { create: jest.fn(async () => ({ id: 99 })) },
  };
}

const bomFor = (components, outputQuantity = 1) => ({
  id: 7,
  name: "وصفة كيك",
  outputItemId: 1,
  outputQuantity,
  items: components.map(([itemId, quantity, costPrice = 1]) => ({
    itemId,
    quantity,
    item: { id: itemId, name: `مادة-${itemId}`, costPrice },
  })),
});

const base = { itemId: 1, warehouseId: WAREHOUSE, createdById: 3 };

describe("deductStockWithAutoProduceInTx — sufficient stock", () => {
  test("decrements once and never touches the BOM", async () => {
    const tx = makeTx({ onHand: 10, decrementCounts: [1] });

    const r = await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 4 });

    expect(r.produced).toBe(0);
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.inventory.updateMany.mock.calls[0][0]).toMatchObject({
      where: { itemId: 1, warehouseId: WAREHOUSE, quantity: { gte: 4 } },
      data: { quantity: { decrement: 4 } },
    });
    expect(tx.bOM.findFirst).not.toHaveBeenCalled();
    expect(tx.productionOrder.create).not.toHaveBeenCalled();
  });

  test("costs no extra reads on the happy path", async () => {
    const tx = makeTx({ onHand: 10, decrementCounts: [1] });
    await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 1 });
    expect(tx.inventory.findUnique).not.toHaveBeenCalled();
    expect(tx.item.findUnique).not.toHaveBeenCalled();
  });
});

describe("deductStockWithAutoProduceInTx — short, producible", () => {
  test("produces whole runs then retries the same guarded decrement", async () => {
    // Need 5, have 0, BOM makes 2 per run → 3 runs → 6 produced.
    const tx = makeTx({
      onHand: 0,
      bom: bomFor([[50, 3]], 2),
      rawStock: { 50: 100 },
      decrementCounts: [0, 1],
    });

    const r = await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 5 });

    expect(r.produced).toBe(6);
    expect(r.bomId).toBe(7);
    expect(r.itemName).toBe("كيك");
    expect(tx.productionOrder.create).toHaveBeenCalledTimes(1);
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(2);
    // Both attempts must carry the same conditional guard — that's what keeps
    // two concurrent sellers from overselling.
    expect(tx.inventory.updateMany.mock.calls[0][0].where).toEqual(
      tx.inventory.updateMany.mock.calls[1][0].where,
    );
  });

  test("only produces the shortfall, not the whole ordered quantity", async () => {
    // Need 5, have 3 → shortfall 2 → 2 runs of 1.
    const tx = makeTx({
      onHand: 3,
      bom: bomFor([[50, 1]], 1),
      rawStock: { 50: 100 },
      decrementCounts: [0, 1],
    });

    const r = await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 5 });

    expect(r.produced).toBe(2);
  });

  test("only considers active BOMs", async () => {
    const tx = makeTx({
      onHand: 0,
      bom: bomFor([[50, 1]]),
      rawStock: { 50: 10 },
      decrementCounts: [0, 1],
    });

    await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 1 });

    expect(tx.bOM.findFirst.mock.calls[0][0].where).toMatchObject({
      outputItemId: 1,
      isActive: true,
    });
  });

  test("works when the finished good has no inventory row at all", async () => {
    const tx = makeTx({
      onHand: null, // findUnique returns null for the finished good
      bom: bomFor([[50, 1]]),
      rawStock: { 50: 10 },
      decrementCounts: [0, 1],
    });

    const r = await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 2 });

    expect(r.produced).toBe(2);
    expect(tx.item.findUnique).toHaveBeenCalled(); // name came from the item row
  });
});

describe("deductStockWithAutoProduceInTx — failures", () => {
  test("raw materials short → INSUFFICIENT_RAW_MATERIALS with the Arabic detail", async () => {
    const tx = makeTx({
      onHand: 0,
      bom: bomFor([[50, 10]]),
      rawStock: { 50: 4 }, // need 10, have 4
      decrementCounts: [0],
    });

    const err = await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 1 })
      .then(() => null)
      .catch((e) => e);

    expect(err).toBeTruthy();
    expect(err.code).toBe("INSUFFICIENT_RAW_MATERIALS");
    expect(err.status).toBe(400);
    expect(err.itemId).toBe(1);
    expect(err.message).toMatch(/مواد خام غير كافية/);
    expect(err.message).toMatch(/\(متاح: 4\.00, مطلوب: 10\.00\)/);
    expect(err.details).toEqual([
      expect.objectContaining({ itemId: 50, available: 4, required: 10 }),
    ]);
    // Nothing was decremented off the finished good.
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
  });

  test("short with no BOM → OUT_OF_STOCK carrying the shortfall", async () => {
    const tx = makeTx({ onHand: 2, bom: null, decrementCounts: [0] });

    const err = await deductStockWithAutoProduceInTx(tx, { ...base, quantity: 5 })
      .then(() => null)
      .catch((e) => e);

    expect(err.code).toBe("OUT_OF_STOCK");
    expect(err.status).toBe(400);
    expect(err.itemId).toBe(1);
    expect(err.available).toBe(2);
    expect(err.requested).toBe(5);
  });

  test("autoProduce:false never looks for a BOM", async () => {
    const tx = makeTx({
      onHand: 0,
      bom: bomFor([[50, 1]]),
      rawStock: { 50: 100 },
      decrementCounts: [0],
    });

    await expect(
      deductStockWithAutoProduceInTx(tx, { ...base, quantity: 1, autoProduce: false }),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });

    expect(tx.bOM.findFirst).not.toHaveBeenCalled();
  });

  test("a concurrent seller taking the fresh output → OUT_OF_STOCK, not a silent oversell", async () => {
    const tx = makeTx({
      onHand: 0,
      bom: bomFor([[50, 1]]),
      rawStock: { 50: 100 },
      decrementCounts: [0, 0], // retry also finds nothing to take
    });

    await expect(
      deductStockWithAutoProduceInTx(tx, { ...base, quantity: 1 }),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });

    expect(tx.productionOrder.create).toHaveBeenCalledTimes(1);
  });
});
