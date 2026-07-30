// Unit tests for lib/sellableCatalog.js — the BOM-aware availability shared by
// the call-center and wholesale catalogs.

const {
  computeAutoProducible,
  buildSellableCatalog,
} = require("../../lib/sellableCatalog");

describe("computeAutoProducible", () => {
  test("limits output to the scarcest component", () => {
    // 10 flour / 2 per run = 5 runs; 3 sugar / 1 per run = 3 runs → 3 runs.
    const bom = {
      outputQuantity: 1,
      items: [
        { itemId: 1, quantity: 2 },
        { itemId: 2, quantity: 1 },
      ],
    };
    const stock = new Map([[1, 10], [2, 3]]);
    expect(computeAutoProducible(bom, stock)).toBe(3);
  });

  test("multiplies by outputQuantity", () => {
    const bom = { outputQuantity: 4, items: [{ itemId: 1, quantity: 2 }] };
    expect(computeAutoProducible(bom, new Map([[1, 10]]))).toBe(20);
  });

  test("a component with no inventory row means nothing can be made", () => {
    const bom = {
      outputQuantity: 1,
      items: [
        { itemId: 1, quantity: 1 },
        { itemId: 2, quantity: 1 },
      ],
    };
    expect(computeAutoProducible(bom, new Map([[1, 100]]))).toBe(0);
  });

  test("skips components with a non-positive requirement", () => {
    const bom = {
      outputQuantity: 1,
      items: [
        { itemId: 1, quantity: 2 },
        { itemId: 2, quantity: 0 },
      ],
    };
    expect(computeAutoProducible(bom, new Map([[1, 6]]))).toBe(3);
  });

  test("a BOM with no components yields 0, not Infinity", () => {
    expect(computeAutoProducible({ outputQuantity: 1, items: [] }, new Map())).toBe(0);
    expect(computeAutoProducible(null, new Map())).toBe(0);
  });

  test("rounds to 4 decimal places", () => {
    const bom = { outputQuantity: 1, items: [{ itemId: 1, quantity: 3 }] };
    // 10 / 3 = 3.333333… → 3.3333
    expect(computeAutoProducible(bom, new Map([[1, 10]]))).toBe(3.3333);
  });
});

function makeDb({ inventory = [], items = [] }) {
  return {
    inventory: { findMany: jest.fn(async () => inventory) },
    item: { findMany: jest.fn(async () => items) },
  };
}

const itemRow = (over = {}) => ({
  id: 1,
  name: "item",
  price: "10.00",
  unit: "piece",
  showInPos: true,
  reorderPoint: 5,
  categories: [],
  bomOutputs: [],
  ...over,
});

describe("buildSellableCatalog", () => {
  test("uses exactly two queries regardless of how many BOMs are involved", async () => {
    const db = makeDb({
      inventory: [{ itemId: 50, quantity: "100" }],
      items: [
        itemRow({
          id: 1,
          bomOutputs: [{ id: 7, name: "b1", outputQuantity: 1, items: [{ itemId: 50, quantity: 1 }] }],
        }),
        itemRow({
          id: 2,
          bomOutputs: [{ id: 8, name: "b2", outputQuantity: 1, items: [{ itemId: 50, quantity: 1 }] }],
        }),
      ],
    });

    await buildSellableCatalog(db, { warehouseId: 3 });

    expect(db.inventory.findMany).toHaveBeenCalledTimes(1);
    expect(db.item.findMany).toHaveBeenCalledTimes(1);
  });

  test("a made-to-order item at zero on-hand is still available", async () => {
    const db = makeDb({
      // Only the raw material has stock; the finished item has no row at all.
      inventory: [{ itemId: 50, quantity: "12" }],
      items: [
        itemRow({
          id: 1,
          name: "كيك",
          bomOutputs: [
            { id: 7, name: "وصفة كيك", outputQuantity: 2, items: [{ itemId: 50, quantity: 3 }] },
          ],
        }),
      ],
    });

    const [row] = await buildSellableCatalog(db, { warehouseId: 3 });

    expect(row.stock).toBe(0);
    expect(row.autoProducible).toBe(8); // floor-free: 12/3 = 4 runs × 2 output
    expect(row.available).toBe(8);
    expect(row.hasBom).toBe(true);
    expect(row.bomId).toBe(7);
  });

  test("reads raw-material stock even when showInPos hides it from the item query", async () => {
    // The raw material is showInPos:false, so it is absent from `items` — its
    // stock must still come through the inventory sweep or availability is 0.
    const db = makeDb({
      inventory: [{ itemId: 50, quantity: "9" }],
      items: [
        itemRow({
          id: 1,
          bomOutputs: [{ id: 7, name: "b", outputQuantity: 1, items: [{ itemId: 50, quantity: 3 }] }],
        }),
      ],
    });

    const [row] = await buildSellableCatalog(db, { warehouseId: 3, onlyShowInPos: true });

    expect(db.item.findMany.mock.calls[0][0].where).toMatchObject({ showInPos: true });
    expect(row.autoProducible).toBe(3);
  });

  test("a plain item reports its on-hand and nothing producible", async () => {
    const db = makeDb({
      inventory: [{ itemId: 1, quantity: "7" }],
      items: [itemRow({ id: 1 })],
    });

    const [row] = await buildSellableCatalog(db, { warehouseId: 3 });

    expect(row).toMatchObject({
      stock: 7,
      autoProducible: 0,
      available: 7,
      hasBom: false,
      bomId: null,
    });
  });

  test("on-hand and producible stack into available", async () => {
    const db = makeDb({
      inventory: [{ itemId: 1, quantity: "2" }, { itemId: 50, quantity: "6" }],
      items: [
        itemRow({
          id: 1,
          bomOutputs: [{ id: 7, name: "b", outputQuantity: 1, items: [{ itemId: 50, quantity: 2 }] }],
        }),
      ],
    });

    const [row] = await buildSellableCatalog(db, { warehouseId: 3 });

    expect(row.stock).toBe(2);
    expect(row.autoProducible).toBe(3);
    expect(row.available).toBe(5);
  });

  test("omits the showInPos filter when onlyShowInPos is false", async () => {
    const db = makeDb({ inventory: [], items: [] });
    await buildSellableCatalog(db, { warehouseId: 3, onlyShowInPos: false });
    expect(db.item.findMany.mock.calls[0][0].where.showInPos).toBeUndefined();
  });

  test("categories come back as {id,name} objects and Decimals as numbers", async () => {
    const db = makeDb({
      inventory: [],
      items: [
        itemRow({
          price: "85.50",
          categories: [{ category: { id: 3, name: "مخبوزات" } }],
        }),
      ],
    });

    const [row] = await buildSellableCatalog(db, { warehouseId: 3 });

    expect(row.categories).toEqual([{ id: 3, name: "مخبوزات" }]);
    expect(row.price).toBe(85.5);
    expect(typeof row.price).toBe("number");
    expect(typeof row.stock).toBe("number");
  });
});
