/**
 * POST /api/sales/refund — which shift a return lands on, and which stock it
 * puts back.
 *
 * A return used to be booked to the ORIGINAL invoice's shift while its cash
 * left the drawer open at return time, so returning yesterday's invoice showed
 * as an unexplained shortage today. It now lands on the caller's open shift
 * (same branch), and carries refundOfSaleId so the close report can list it
 * under "مرتجع فواتير سابقة".
 *
 * Lines are resolved to the stored sale line: a BOM-only line has itemId=null,
 * and a line sold through a BOM consumed raw materials, so restocking follows
 * the stored bomId — never the client's.
 */

const mockState = {
  sale: null,
  activeShift: null,
  boms: new Map(),
  upserts: [],
  created: null,
  treasury: new Map(),
};

jest.mock("../../config/database", () => {
  const client = {
    sale: {
      findUnique: jest.fn(async () => (mockState.sale ? { ...mockState.sale } : null)),
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }) => {
        mockState.created = data;
        return { id: 99, ...data };
      }),
    },
    shift: {
      findFirst: jest.fn(async () => mockState.activeShift),
    },
    bOM: {
      findUnique: jest.fn(async ({ where }) => mockState.boms.get(where.id) || null),
    },
    inventory: {
      upsert: jest.fn(async ({ where, update }) => {
        mockState.upserts.push({
          itemId: where.itemId_warehouseId.itemId,
          qty: update.quantity.increment,
        });
        return {};
      }),
    },
    treasury: {
      update: jest.fn(async ({ where, data }) => {
        const cur = mockState.treasury.get(where.id) || 0;
        mockState.treasury.set(where.id, cur - Number(data.balance.decrement || 0));
        return {};
      }),
    },
    systemConfiguration: {
      findFirst: jest.fn(async () => ({ visaTreasuryId: 20, instapayTreasuryId: 21 })),
    },
    $transaction: jest.fn(async (cb) => cb(client)),
  };
  return client;
});

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1 };
    next();
  },
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  getUserBranchFilter: jest.fn(async () => null),
  verifyManagerApproval: jest.fn(async () => ({ id: 3, username: "mgr", role: "Manager" })),
}));

jest.mock("../../lib/orderService", () => ({
  createOrderInTx: jest.fn(),
  broadcastStatusChange: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const errorHandler = require("../../middleware/errorHandler");

const app = express();
app.use(express.json());
app.use("/api/sales", require("../../routes/sales"));
app.use(errorHandler);

// Yesterday's invoice, sold on (now closed) shift 10 of branch 2.
const saleRow = (overrides = {}) => ({
  id: 50,
  saleNumber: "SALE-202611-00050",
  clientId: 1,
  employeeId: null,
  userId: 4,
  branchId: 2,
  treasuryId: 7,
  warehouseId: 8,
  shiftId: 10,
  subtotal: 100,
  discountAmount: null,
  taxRate: 0,
  total: 100,
  items: [
    { id: 501, itemId: 30, bomId: null, quantity: 2, unitPrice: 50, costPrice: 20, item: { name: "Coffee" }, bom: null },
  ],
  ...overrides,
});

const refund = (items, extra = {}) =>
  request(app)
    .post("/api/sales/refund")
    .send({ saleId: 50, items, managerUsername: "mgr", managerPassword: "x", ...extra });

beforeEach(() => {
  mockState.sale = saleRow();
  mockState.activeShift = null;
  mockState.boms.clear();
  mockState.upserts.length = 0;
  mockState.created = null;
  mockState.treasury.clear();
});

describe("which shift a return is booked to", () => {
  test("an open shift in the invoice's branch takes the return", async () => {
    mockState.activeShift = { id: 11, branchId: 2 };
    const res = await refund([{ saleItemId: 501, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(mockState.created.shiftId).toBe(11);
    expect(mockState.created.refundOfSaleId).toBe(50);
    // Cash still leaves the invoice's branch treasury.
    expect(mockState.treasury.get(7)).toBe(-50);
  });

  test("no open shift falls back to the invoice's shift", async () => {
    const res = await refund([{ saleItemId: 501, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(mockState.created.shiftId).toBe(10);
    expect(mockState.created.refundOfSaleId).toBe(50);
  });

  test("an open shift in another branch falls back to the invoice's shift", async () => {
    mockState.activeShift = { id: 12, branchId: 3 };
    const res = await refund([{ saleItemId: 501, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(mockState.created.shiftId).toBe(10);
  });
});

describe("which stock a return puts back", () => {
  test("a BOM-only line (itemId null) restocks its raw materials", async () => {
    mockState.sale = saleRow({
      items: [
        { id: 601, itemId: null, bomId: 5, quantity: 2, unitPrice: 40, costPrice: 10, item: null, bom: { name: "Latte" } },
      ],
    });
    mockState.boms.set(5, { id: 5, outputQuantity: 1, items: [{ itemId: 70, quantity: 0.2 }, { itemId: 71, quantity: 1 }] });

    const res = await refund([{ saleItemId: 601, itemId: null, quantity: 2 }]);
    expect(res.status).toBe(201);
    expect(mockState.upserts).toEqual([
      { itemId: 70, qty: 0.4 },
      { itemId: 71, qty: 2 },
    ]);
    expect(mockState.created.items.create).toEqual([
      expect.objectContaining({ itemId: null, bomId: 5, quantity: -2, unitPrice: 40, total: -80 }),
    ]);
  });

  test("an item sold through its BOM restocks raw materials, not the finished item", async () => {
    mockState.sale = saleRow({
      items: [
        { id: 701, itemId: 30, bomId: 5, quantity: 1, unitPrice: 50, costPrice: 20, item: { name: "Coffee" }, bom: { name: "Coffee BOM" } },
      ],
    });
    mockState.boms.set(5, { id: 5, outputQuantity: 1, items: [{ itemId: 70, quantity: 0.5 }] });

    const res = await refund([{ saleItemId: 701, itemId: 30, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(mockState.upserts).toEqual([{ itemId: 70, qty: 0.5 }]);
  });

  test("a legacy payload with only itemId still works", async () => {
    const res = await refund([{ itemId: 30, quantity: 2 }]);
    expect(res.status).toBe(201);
    expect(mockState.upserts).toEqual([{ itemId: 30, qty: 2 }]);
    expect(mockState.created.total).toBe(-100);
  });
});

describe("refused returns", () => {
  test("more than was sold is a 400 and moves nothing", async () => {
    const res = await refund([{ saleItemId: 501, quantity: 3 }]);
    expect(res.status).toBe(400);
    expect(mockState.created).toBeNull();
    expect(mockState.upserts).toHaveLength(0);
    expect(mockState.treasury.size).toBe(0);
  });

  test("a line that is not on the invoice is a 400", async () => {
    const res = await refund([{ saleItemId: 999, quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(mockState.created).toBeNull();
  });

  test("a refund row cannot itself be returned", async () => {
    mockState.sale = saleRow({ saleNumber: "REFUND-202611-00001", total: -50 });
    const res = await refund([{ saleItemId: 501, quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(mockState.created).toBeNull();
  });
});
