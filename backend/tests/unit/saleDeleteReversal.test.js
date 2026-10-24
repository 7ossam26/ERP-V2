/**
 * DELETE /api/sales/:id must reverse EXACTLY what the sale credited.
 *
 * Creation credits `total` (routes/sales.js POST /). The delete used to take
 * back `paidAmount` — the cash the customer handed over, change included — so a
 * 95 sale paid with a 100 note removed 100. Dispatched delivery sales and
 * REFUND- rows never credited the treasury the way a counter sale does, so they
 * are refused rather than half-reversed.
 */

const mockState = { sale: null, treasury: new Map(), deleted: [] };

jest.mock("../../config/database", () => {
  const client = {
    sale: {
      findUnique: jest.fn(async () => (mockState.sale ? { ...mockState.sale } : null)),
      delete: jest.fn(async ({ where }) => {
        mockState.deleted.push(where.id);
        return {};
      }),
    },
    inventory: { upsert: jest.fn(async () => ({})) },
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

const saleRow = (overrides = {}) => ({
  id: 1,
  saleNumber: "S-1",
  total: 95,
  paidAmount: 100, // customer handed over a 100 note
  paymentMethod: "CASH",
  treasuryId: 7,
  warehouseId: null,
  deliveryManId: null,
  deliveryZoneId: null,
  deliveryStatus: null,
  items: [],
  ...overrides,
});

const del = () => request(app).delete("/api/sales/1");

beforeEach(() => {
  mockState.treasury.clear();
  mockState.deleted.length = 0;
});

test("a cash sale reverses its total, not the cash handed over", async () => {
  mockState.sale = saleRow();
  const res = await del();
  expect(res.status).toBe(204);
  expect(mockState.treasury.get(7)).toBe(-95);
});

test("a VISA sale reverses its total on the global treasury", async () => {
  mockState.sale = saleRow({ paymentMethod: "VISA" });
  await del();
  expect(mockState.treasury.get(20)).toBe(-95);
  expect(mockState.treasury.has(7)).toBe(false);
});

test("a pending delivery order (never credited) moves no money", async () => {
  mockState.sale = saleRow({ deliveryZoneId: 3, deliveryStatus: "PENDING" });
  const res = await del();
  expect(res.status).toBe(204);
  expect(mockState.treasury.size).toBe(0);
});

test("a dispatched delivery sale is refused", async () => {
  mockState.sale = saleRow({ deliveryManId: 5, deliveryStatus: "OUT_FOR_DELIVERY" });
  const res = await del();
  expect(res.status).toBe(400);
  expect(mockState.deleted).toHaveLength(0);
  expect(mockState.treasury.size).toBe(0);
});

test("a refund row is refused", async () => {
  mockState.sale = saleRow({ saleNumber: "REFUND-202609-00001", total: -40 });
  const res = await del();
  expect(res.status).toBe(400);
  expect(mockState.deleted).toHaveLength(0);
});
