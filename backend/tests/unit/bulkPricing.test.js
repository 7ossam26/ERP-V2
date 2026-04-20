// Unit tests for services/bulkPricing.service.js

const { resolvePrice } = require("../../services/bulkPricing.service");

function makeTx({ override, item }) {
  return {
    bulkContractPrice: {
      findUnique: jest.fn(async () => override),
    },
    item: {
      findUnique: jest.fn(async () => item),
    },
  };
}

describe("bulkPricing.resolvePrice", () => {
  test("returns contract override when one exists", async () => {
    const tx = makeTx({ override: { price: "12.50" }, item: { price: "20.00" } });
    const result = await resolvePrice(tx, 1, 99);
    expect(result).toEqual({ price: 12.5, source: "CONTRACT" });
    expect(tx.bulkContractPrice.findUnique).toHaveBeenCalledWith({
      where: { customerId_itemId: { customerId: 1, itemId: 99 } },
      select: { price: true },
    });
    expect(tx.item.findUnique).not.toHaveBeenCalled();
  });

  test("falls back to item base price when no override", async () => {
    const tx = makeTx({ override: null, item: { price: "20.00" } });
    const result = await resolvePrice(tx, 1, 99);
    expect(result).toEqual({ price: 20, source: "BASE" });
    expect(tx.item.findUnique).toHaveBeenCalledWith({
      where: { id: 99 },
      select: { price: true },
    });
  });

  test("returns null when item missing", async () => {
    const tx = makeTx({ override: null, item: null });
    const result = await resolvePrice(tx, 1, 99);
    expect(result).toBeNull();
  });
});
