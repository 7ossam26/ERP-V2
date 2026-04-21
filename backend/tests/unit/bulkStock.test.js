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
      // DEBIT now uses updateMany with a conditional quantity check.
      // Return count=1 (success) by default; individual tests override this.
      updateMany: jest.fn(async () => ({ count: 1 })),
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
  test("DEBIT does a conditional updateMany per line (atomic check-and-decrement)", async () => {
    const tx = makeInventoryTx({});
    await applyBulkOrderStockMovement(
      tx,
      { id: 1, warehouseId: 7, items: [{ itemId: 10, quantity: 4 }, { itemId: 11, quantity: 2 }] },
      "DEBIT",
    );
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(2);
    // First call: item 10, quantity >= 4 condition
    expect(tx.inventory.updateMany.mock.calls[0][0]).toMatchObject({
      where: { itemId: 10, warehouseId: 7, quantity: { gte: 4 } },
      data: { quantity: { decrement: 4 } },
    });
    // Second call: item 11, quantity >= 2 condition
    expect(tx.inventory.updateMany.mock.calls[1][0]).toMatchObject({
      where: { itemId: 11, warehouseId: 7, quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    });
    expect(tx.inventory.upsert).not.toHaveBeenCalled();
  });

  test("DEBIT throws INSUFFICIENT_STOCK when updateMany returns count=0", async () => {
    // count=0 means the conditional update found no matching row (stock gone)
    const tx = makeInventoryTx({ "10:7": "2" }); // has 2, need 5
    tx.inventory.updateMany = jest.fn(async () => ({ count: 0 }));

    await expect(
      applyBulkOrderStockMovement(
        tx,
        { id: 1, warehouseId: 7, items: [{ itemId: 10, quantity: 5 }] },
        "DEBIT",
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409 });
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
