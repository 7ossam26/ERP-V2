/**
 * GET /api/call-center/clients/:id/last-order — the "repeat last order" card.
 *
 * The call-center catalog is keyed by Item.id, so every returned line must carry
 * the id the agent can re-add. POS BOM-only lines store itemId = null and only a
 * bomId; they have to come back as the BOM's output item or the card shows them
 * as unorderable. Refunds (negative REFUND- rows), voided/held sales and
 * cancelled orders must never be offered as "the last order".
 */

jest.mock("../../config/database", () => ({
  sale: { findFirst: jest.fn() },
}));

const prisma = require("../../config/database");
const { getClientLastOrder } = require("../../controllers/callCenter.controller");

const call = async (id) => {
  const res = { status: jest.fn(() => res), json: jest.fn() };
  const next = jest.fn();
  await getClientLastOrder({ params: { id: String(id) } }, res, next);
  return { res, next };
};

beforeEach(() => prisma.sale.findFirst.mockReset());

test("filters out refunds, voided/held sales and cancelled orders", async () => {
  prisma.sale.findFirst.mockResolvedValue(null);

  await call(7);

  const { where, orderBy } = prisma.sale.findFirst.mock.calls[0][0];
  expect(where).toMatchObject({
    clientId: 7,
    status: "COMPLETED",
    isVoided: false,
    NOT: { saleNumber: { startsWith: "REFUND-" } },
    OR: [{ order: { is: null } }, { order: { is: { status: { not: "CANCELLED" } } } }],
  });
  expect(orderBy).toEqual({ createdAt: "desc" });
});

test("responds null when the client has no previous order", async () => {
  prisma.sale.findFirst.mockResolvedValue(null);
  const { res } = await call(7);
  expect(res.json).toHaveBeenCalledWith(null);
});

test("rejects a non-numeric id without querying", async () => {
  const { res } = await call("abc");
  expect(res.status).toHaveBeenCalledWith(400);
  expect(prisma.sale.findFirst).not.toHaveBeenCalled();
});

test("maps decimals to numbers and resolves BOM-only lines to their output item", async () => {
  prisma.sale.findFirst.mockResolvedValue({
    id: 55,
    saleNumber: "SALE-202611-00042",
    createdAt: new Date("2026-11-07T10:00:00Z"),
    deliveryAddress: "Nasr City",
    subtotal: "210.00",
    discountAmount: null,
    deliveryFee: "25.00",
    total: "235.00",
    branch: { id: 1, name: "Maadi" },
    deliveryZone: { id: 3, name: "Zamalek" },
    order: null, // a POS sale has no Order row
    items: [
      {
        itemId: 10, quantity: "2.0000", unitPrice: "60.00", total: "120.00",
        item: { id: 10, name: "Kunafa", unit: "piece" }, bom: null,
      },
      {
        itemId: null, quantity: "1.5000", unitPrice: "60.00", total: "90.00",
        item: null, bom: { name: "Basbousa BOM", outputItem: { id: 20, name: "Basbousa", unit: "kg" } },
      },
      {
        itemId: null, quantity: "1.0000", unitPrice: "0.00", total: "0.00",
        item: null, bom: null,
      },
    ],
  });

  const { res } = await call(7);
  const body = res.json.mock.calls[0][0];

  expect(body).toMatchObject({
    id: 55,
    channel: "POS",
    orderStatus: null,
    subtotal: 210,
    discountAmount: 0,
    deliveryFee: 25,
    total: 235,
    branch: { id: 1, name: "Maadi" },
  });
  expect(body.items).toEqual([
    { itemId: 10, name: "Kunafa", unit: "piece", quantity: 2, unitPrice: 60, total: 120 },
    { itemId: 20, name: "Basbousa", unit: "kg", quantity: 1.5, unitPrice: 60, total: 90 },
    { itemId: null, name: "صنف محذوف", unit: null, quantity: 1, unitPrice: 0, total: 0 },
  ]);
});
