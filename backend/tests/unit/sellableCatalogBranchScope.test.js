/**
 * Branch isolation for the sellable catalog.
 *
 * `available` (= on-hand + autoProducible) is what the call-center and wholesale
 * grids gate on, so it decides whether an operator can order an item at all. It
 * must be computed from ONE warehouse: the selected branch's. An item whose raw
 * materials sit in another branch has to read as unavailable, or the operator is
 * promised stock the write path will then refuse to produce.
 *
 * sellableCatalog.test.js covers the arithmetic, but its `makeDb` returns a canned
 * inventory array regardless of the `where` it is handed — so a query against the
 * wrong warehouse would still see stock. The fixture here filters on
 * `where.warehouseId` for real, which is what makes these assertions mean anything.
 */

const { buildSellableCatalog } = require("../../lib/sellableCatalog");

const WH_A = 100;
const WH_B = 300;

const CAKE = 1; // finished good, made to order (never any on-hand)
const FLOUR = 50; // its only raw material

/**
 * @param {Array<{itemId:number, warehouseId:number, quantity:any}>} inventory
 *   rows across ALL warehouses — the fixture narrows them like the DB would
 * @param {Array} items
 */
function makeDb(inventory, items) {
  return {
    inventory: {
      findMany: jest.fn(async ({ where }) =>
        inventory
          .filter((row) => row.warehouseId === where.warehouseId)
          .map(({ itemId, quantity }) => ({ itemId, quantity })),
      ),
    },
    item: { findMany: jest.fn(async () => items) },
  };
}

const itemRow = (over = {}) => ({
  id: CAKE,
  name: "كيك",
  price: 100,
  unit: "قطعة",
  showInPos: true,
  reorderPoint: 5,
  categories: [],
  bomOutputs: [],
  ...over,
});

const cakeWithBom = itemRow({
  bomOutputs: [
    {
      id: 7,
      name: "وصفة كيك",
      outputQuantity: 1,
      items: [{ itemId: FLOUR, quantity: 10 }],
    },
  ],
});

// One dataset, both branches: flour lives only at B.
const INVENTORY = [
  { itemId: CAKE, warehouseId: WH_A, quantity: "0" },
  { itemId: CAKE, warehouseId: WH_B, quantity: "0" },
  { itemId: FLOUR, warehouseId: WH_B, quantity: "500" },
];

describe("catalog availability is confined to the selected branch's warehouse", () => {
  test("reads stock from the selected warehouse only", async () => {
    const db = makeDb(INVENTORY, [cakeWithBom]);

    await buildSellableCatalog(db, { warehouseId: WH_A });

    expect(db.inventory.findMany).toHaveBeenCalledTimes(1);
    expect(db.inventory.findMany.mock.calls[0][0].where).toEqual({
      warehouseId: WH_A,
    });
  });

  // The requirement's negative case, on the read side: branch A has no flour, so
  // the item must not become sellable on the strength of branch B's flour.
  test("raw materials in another branch do not make an item sellable", async () => {
    const db = makeDb(INVENTORY, [cakeWithBom]);

    const [row] = await buildSellableCatalog(db, { warehouseId: WH_A });

    expect(row.stock).toBe(0);
    expect(row.autoProducible).toBe(0);
    expect(row.available).toBe(0);
    expect(row.hasBom).toBe(true); // producible in principle, just not here
  });

  // Same dataset, same BOM — only the branch differs. A leak would show up as
  // the two branches reporting the same availability.
  test("the same item is available at one branch and not the other", async () => {
    const [atA] = await buildSellableCatalog(makeDb(INVENTORY, [cakeWithBom]), {
      warehouseId: WH_A,
    });
    const [atB] = await buildSellableCatalog(makeDb(INVENTORY, [cakeWithBom]), {
      warehouseId: WH_B,
    });

    expect(atA.available).toBe(0);
    expect(atB.available).toBe(50); // 500 flour ÷ 10 per cake
  });

  test("another branch's finished stock is not counted", async () => {
    const db = makeDb(
      [
        { itemId: CAKE, warehouseId: WH_A, quantity: "0" },
        { itemId: CAKE, warehouseId: WH_B, quantity: "80" },
      ],
      [itemRow()], // no BOM: on-hand is the only possible source
    );

    const [row] = await buildSellableCatalog(db, { warehouseId: WH_A });

    expect(row.stock).toBe(0);
    expect(row.available).toBe(0);
  });

  test("a branch with no inventory rows at all reports nothing available", async () => {
    const db = makeDb(INVENTORY, [cakeWithBom]);

    const [row] = await buildSellableCatalog(db, { warehouseId: 999 });

    expect(row.available).toBe(0);
  });

  // The wholesale grid passes onlyShowInPos:false, which widens the ITEM query.
  // It must not widen the inventory scope.
  test("onlyShowInPos:false does not widen the warehouse scope", async () => {
    const db = makeDb(INVENTORY, [cakeWithBom]);

    const [row] = await buildSellableCatalog(db, {
      warehouseId: WH_A,
      onlyShowInPos: false,
    });

    expect(db.inventory.findMany.mock.calls[0][0].where).toEqual({
      warehouseId: WH_A,
    });
    expect(row.available).toBe(0);
  });
});
