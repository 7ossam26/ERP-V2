const { bomMakeUnitCost, resolveSaleLineUnitCost } = require("../../lib/costing");

describe("bomMakeUnitCost", () => {
  test("sums component cost × qty divided by output quantity", () => {
    const bom = {
      outputQuantity: 2,
      items: [
        { quantity: 3, item: { costPrice: 4 } }, // 12
        { quantity: 1, item: { costPrice: 10 } }, // 10
      ],
    };
    // (12 + 10) / 2 = 11
    expect(bomMakeUnitCost(bom)).toBe(11);
  });

  test("returns 0 for a bom with no items", () => {
    expect(bomMakeUnitCost({ outputQuantity: 1, items: [] })).toBe(0);
    expect(bomMakeUnitCost(null)).toBe(0);
  });

  test("treats missing component cost as 0", () => {
    const bom = {
      outputQuantity: 1,
      items: [{ quantity: 5, item: {} }],
    };
    expect(bomMakeUnitCost(bom)).toBe(0);
  });
});

describe("resolveSaleLineUnitCost", () => {
  const makeDb = ({ item, linkedBom, bom } = {}) => ({
    item: { findUnique: async () => item ?? null },
    bOM: {
      findFirst: async () => linkedBom ?? null,
      findUnique: async () => bom ?? null,
    },
  });

  test("plain item returns its stored costPrice", async () => {
    const db = makeDb({ item: { costPrice: 7.5 } });
    await expect(resolveSaleLineUnitCost(db, { itemId: 1 })).resolves.toBe(7.5);
  });

  test("manufactured item with 0 cost falls back to recipe make-cost", async () => {
    const db = makeDb({
      item: { costPrice: 0 },
      linkedBom: {
        outputQuantity: 1,
        items: [{ quantity: 2, item: { costPrice: 3 } }], // 6
      },
    });
    await expect(resolveSaleLineUnitCost(db, { itemId: 1 })).resolves.toBe(6);
  });

  test("item with 0 cost and no BOM returns 0", async () => {
    const db = makeDb({ item: { costPrice: 0 }, linkedBom: null });
    await expect(resolveSaleLineUnitCost(db, { itemId: 1 })).resolves.toBe(0);
  });

  test("line sold directly as a BOM returns the recipe make-cost", async () => {
    const db = makeDb({
      bom: {
        outputQuantity: 4,
        items: [{ quantity: 8, item: { costPrice: 2 } }], // 16 / 4 = 4
      },
    });
    await expect(resolveSaleLineUnitCost(db, { bomId: 9 })).resolves.toBe(4);
  });

  test("neither item nor bom returns 0", async () => {
    const db = makeDb({});
    await expect(resolveSaleLineUnitCost(db, {})).resolves.toBe(0);
  });
});
