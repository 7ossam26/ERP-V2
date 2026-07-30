/**
 * Branch scoping on the wholesale order routes.
 *
 * Confirming a bulk order is the moment stock is deducted and — since
 * auto-production was added — raw materials are consumed at `order.warehouseId`.
 * The route is gated only on the BULK_POS permission, which every branch's
 * wholesale operator holds, so without a branch check an operator standing in
 * branch B could confirm branch A's draft and manufacture from branch A's raw
 * materials: stock the catalog they were looking at never showed them.
 *
 * These tests pin the guard, and pin that nothing is deducted or produced on the
 * reject paths. `list` and `detail` are covered too, since cross-branch
 * visibility is what makes such a confirm reachable in the first place.
 */

jest.mock("../../config/database", () => {
  const client = {
    bulkOrder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bulkDocument: { create: jest.fn() },
    bulkPayment: { create: jest.fn() },
    treasury: { findUnique: jest.fn(), update: jest.fn() },
    systemConfiguration: { findFirst: jest.fn() },
    bulkCustomer: { findUnique: jest.fn() },
    // Run the callback against the same mocks, mirroring how the interactive
    // transaction sees the tx client.
    $transaction: jest.fn(async (cb) => cb(client)),
  };
  return client;
});

jest.mock("../../middleware/auth", () => {
  const actual = jest.requireActual("../../middleware/auth");
  return {
    ...actual,
    // Bypass JWT verification; the identity is injected per test.
    authenticateToken: (req, res, next) => {
      req.user = req.testUser;
      next();
    },
    // The permission gate is not what's under test here — every wholesale
    // operator legitimately holds BULK_POS, which is precisely the problem.
    requirePermission: () => (req, res, next) => next(),
    resolveOperatingBranch: jest.fn(),
  };
});

jest.mock("../../services/bulkStock.service", () => ({
  applyBulkOrderStockMovement: jest.fn(async () => []),
  assertStockAvailable: jest.fn(),
}));
jest.mock("../../services/bulkNumbering.service", () => ({
  allocateNumber: jest.fn(async (tx, kind) => `${kind}-1`),
}));
jest.mock("../../services/bulkCredit.service", () => ({
  assertCreditLimitOk: jest.fn(async () => {}),
}));
jest.mock("../../utils/auditLogger", () => ({
  writeAudit: jest.fn(async () => {}),
}));

const express = require("express");
const request = require("supertest");

const prisma = require("../../config/database");
const auth = require("../../middleware/auth");
const errorHandler = require("../../middleware/errorHandler");
const { applyBulkOrderStockMovement } = require("../../services/bulkStock.service");

const WH_A = 100;
const WH_B = 300;
const BRANCH_A = { id: 1, name: "فرع أ", warehouseId: WH_A, treasuryId: 11 };
const BRANCH_B = { id: 2, name: "فرع ب", warehouseId: WH_B, treasuryId: 22 };

const ORDER_ID = 77;

// A branch-A order that passes every other guard, so each test breaks exactly one
// thing: the branch it is confirmed from.
const orderRow = (over = {}) => ({
  id: ORDER_ID,
  warehouseId: WH_A,
  status: "DRAFT",
  customerId: 5,
  taxRate: "0.14",
  netAmount: "877.19",
  taxAmount: "122.81",
  total: "1000.00",
  paidAmount: "0",
  balanceDue: "1000.00",
  customer: { id: 5, companyName: "شركة الجملة", taxNumber: "123456" },
  items: [{ id: 1, itemId: 1, quantity: 3, unitPrice: "333.33" }],
  ...over,
});

let app;

const buildApp = () => {
  const server = express();
  server.use(express.json());
  server.use((req, res, next) => {
    req.testUser = server.locals.testUser;
    next();
  });
  server.use("/api/bulk/orders", require("../../routes/bulk/orders"));
  server.use(errorHandler);
  server.locals.testUser = { id: 3, role: "Wholesale", branchId: BRANCH_A.id };
  return server;
};

// paidAmount 0 keeps the payment branch out of the way (method becomes CREDIT,
// so no treasury is required) and leaves the order CONFIRMED.
const confirm = (body = { paidAmount: 0 }) =>
  request(app).post(`/api/bulk/orders/${ORDER_ID}/confirm`).send(body);

beforeAll(() => {
  app = buildApp();
});

beforeEach(() => {
  jest.clearAllMocks();

  auth.resolveOperatingBranch.mockResolvedValue(BRANCH_A);
  prisma.bulkOrder.findUnique.mockResolvedValue(orderRow());
  prisma.bulkOrder.findMany.mockResolvedValue([]);
  prisma.bulkOrder.update.mockImplementation(async ({ data }) => ({
    ...orderRow(),
    ...data,
  }));
  prisma.bulkDocument.create.mockResolvedValue({ id: 1 });
  prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  applyBulkOrderStockMovement.mockResolvedValue([]);
});

describe("POST /api/bulk/orders/:id/confirm — branch guard", () => {
  test("confirms an order belonging to the operator's own branch", async () => {
    const res = await confirm();

    expect(res.status).toBe(200);
    expect(applyBulkOrderStockMovement).toHaveBeenCalledTimes(1);
    // Auto-production is on, and scoped to the order's own warehouse.
    const [, order, direction, opts] = applyBulkOrderStockMovement.mock.calls[0];
    expect(order.warehouseId).toBe(WH_A);
    expect(direction).toBe("DEBIT");
    expect(opts.autoProduce).toBe(true);
  });

  // The core regression: branch B must not be able to spend branch A's raw
  // materials, even though it holds the same BULK_POS permission.
  test("refuses to confirm another branch's order, and deducts nothing", async () => {
    auth.resolveOperatingBranch.mockResolvedValue(BRANCH_B);

    const res = await confirm();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Order belongs to another branch");
    // Nothing was deducted and nothing was produced, at either warehouse.
    expect(applyBulkOrderStockMovement).not.toHaveBeenCalled();
    expect(prisma.bulkOrder.update).not.toHaveBeenCalled();
    expect(prisma.bulkDocument.create).not.toHaveBeenCalled();
  });

  test("the guard runs before the credit check and the document number", async () => {
    auth.resolveOperatingBranch.mockResolvedValue(BRANCH_B);
    const { assertCreditLimitOk } = require("../../services/bulkCredit.service");
    const { allocateNumber } = require("../../services/bulkNumbering.service");

    await confirm();

    expect(assertCreditLimitOk).not.toHaveBeenCalled();
    expect(allocateNumber).not.toHaveBeenCalled();
  });

  // A global role on "All Branches" resolves to no single warehouse. Order create
  // already refuses that; confirm must too, since it is the side that moves stock.
  test("requires a selected branch when none resolves", async () => {
    auth.resolveOperatingBranch.mockResolvedValue(null);

    const res = await confirm();

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Branch selection required");
    expect(applyBulkOrderStockMovement).not.toHaveBeenCalled();
    // Refused before the transaction was even opened.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a status rejection is still reported for the operator's own branch", async () => {
    prisma.bulkOrder.findUnique.mockResolvedValue(orderRow({ status: "PAID" }));

    const res = await confirm();

    expect(res.status).toBe(409);
    expect(applyBulkOrderStockMovement).not.toHaveBeenCalled();
  });
});

describe("GET /api/bulk/orders — branch scope", () => {
  test("narrows the list to the operating branch's warehouse", async () => {
    await request(app).get("/api/bulk/orders").expect(200);

    expect(prisma.bulkOrder.findMany.mock.calls[0][0].where).toMatchObject({
      warehouseId: WH_A,
    });
  });

  test("keeps other filters alongside the warehouse scope", async () => {
    await request(app).get("/api/bulk/orders?status=DRAFT").expect(200);

    expect(prisma.bulkOrder.findMany.mock.calls[0][0].where).toMatchObject({
      status: "DRAFT",
      warehouseId: WH_A,
    });
  });

  // Reads fall back broad where writes stay strict: a global role on "All
  // Branches" is still allowed the company-wide list.
  test("does not narrow when no single branch resolves", async () => {
    auth.resolveOperatingBranch.mockResolvedValue(null);

    await request(app).get("/api/bulk/orders").expect(200);

    expect(
      prisma.bulkOrder.findMany.mock.calls[0][0].where,
    ).not.toHaveProperty("warehouseId");
  });
});

describe("GET /api/bulk/orders/:id — branch scope", () => {
  test("returns the operator's own branch order", async () => {
    const res = await request(app).get(`/api/bulk/orders/${ORDER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ORDER_ID);
  });

  // 404 rather than 403 so order ids in other branches can't be probed.
  test("hides another branch's order behind a 404", async () => {
    auth.resolveOperatingBranch.mockResolvedValue(BRANCH_B);

    const res = await request(app).get(`/api/bulk/orders/${ORDER_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  test("stays visible to a global role with no branch selected", async () => {
    auth.resolveOperatingBranch.mockResolvedValue(null);

    await request(app).get(`/api/bulk/orders/${ORDER_ID}`).expect(200);
  });
});
