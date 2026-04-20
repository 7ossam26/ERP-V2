// Unit tests for services/bulkStock.service.js

const {
  assertStockAvailable,
  applyBulkOrderStockMovement,
} = require("../../services/bulkStock.service");

function makeInventoryTx(stockMap) {
  return {
    inventory: {
      findUnique: jest.fn(async ({ where }) => {
        const k = `${where.itemId_warehouseId.itemId}:${where.itemId_warehouseId.warehouseId}`;
        if (!(k in stockMap)) return null;
        return { quantity: stockMap[k], item: { name: `item-${where.itemId_warehouseId.itemId}` } };
      }),
      update: jest.fn(async () => ({})),
      upsert: jest.fn(async () => ({})),
    },
  };
}

describe("bulkStock.assertStockAvailable", () => {
  test("passes when every line has enough stock", async () => {
    const tx = makeInventoryTx({ "1:5": "10", "2:5": "3" });
    await expect(
      assertStockAvailable(tx, {
        warehouseId: 5,
        items: [
          { itemId: 1, quantity: 5 },
          { itemId: 2, quantity: 3 },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  test("throws INSUFFICIENT_STOCK with offending line details", async () => {
    const tx = makeInventoryTx({ "1:5": "2" });
    await expect(
      assertStockAvailable(tx, {
        warehouseId: 5,
        items: [{ itemId: 1, quantity: 5 }],
      }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      status: 409,
      details: [{ itemId: 1, requested: 5, available: 2 }],
    });
  });

  test("treats missing inventory row as zero stock", async () => {
    const tx = makeInventoryTx({});
    await expect(
      assertStockAvailable(tx, {
        warehouseId: 5,
        items: [{ itemId: 99, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });
});

describe("bulkStock.applyBulkOrderStockMovement", () => {
  test("DEBIT decrements every line at the order's warehouse", async () => {
    const tx = makeInventoryTx({});
    await applyBulkOrderStockMovement(
      tx,
      {
        id: 1,
        warehouseId: 7,
        items: [
          { itemId: 10, quantity: 4 },
          { itemId: 11, quantity: 2 },
        ],
      },
      "DEBIT",
    );
    expect(tx.inventory.update).toHaveBeenCalledTimes(2);
    expect(tx.inventory.update.mock.calls[0][0]).toEqual({
      where: { itemId_warehouseId: { itemId: 10, warehouseId: 7 } },
      data: { quantity: { decrement: 4 } },
    });
    expect(tx.inventory.update.mock.calls[1][0].data).toEqual({ quantity: { decrement: 2 } });
    expect(tx.inventory.upsert).not.toHaveBeenCalled();
  });

  test("CREDIT upserts and increments every line", async () => {
    const tx = makeInventoryTx({});
    await applyBulkOrderStockMovement(
      tx,
      { id: 1, warehouseId: 7, items: [{ itemId: 10, quantity: 4 }] },
      "CREDIT",
    );
    expect(tx.inventory.upsert).toHaveBeenCalledTimes(1);
    const args = tx.inventory.upsert.mock.calls[0][0];
    expect(args.create).toEqual({ itemId: 10, warehouseId: 7, quantity: 4 });
    expect(args.update).toEqual({ quantity: { increment: 4 } });
  });

  test("rejects unknown direction", async () => {
    const tx = makeInventoryTx({});
    await expect(
      applyBulkOrderStockMovement(tx, { id: 1, warehouseId: 1, items: [] }, "SIDEWAYS"),
    ).rejects.toThrow(/invalid direction/);
  });
});
