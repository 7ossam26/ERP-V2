/**
 * services/stockWriteOff.service.js — the invariants that keep إهلاك from
 * corrupting the money math.
 *
 * The two most important tests in this file are the ones asserting a NEGATIVE:
 * that Item.costPrice is never written, and that the auto-produce helper is
 * never called. Both are silent, delayed failures — nothing breaks at write-off
 * time, but every subsequent COGS snapshot is wrong.
 */

const mockTx = {
  item: { findUnique: jest.fn(), update: jest.fn() },
  warehouse: { findUnique: jest.fn() },
  inventory: { updateMany: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  stockWriteOff: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  bOM: { findFirst: jest.fn(), findUnique: jest.fn() },
};

jest.mock("../../config/database", () => ({
  $transaction: jest.fn(async (fn) => fn(mockTx)),
  item: { findUnique: jest.fn() },
  inventory: { findMany: jest.fn() },
  stockWriteOff: { findMany: jest.fn() },
}));

// If the service ever reaches for this helper, the mock records it. For a short
// BOM item the real one manufactures the shortfall and restamps Item.costPrice.
jest.mock("../../lib/productionService", () => ({
  executeProductionInTx: jest.fn(),
  deductStockWithAutoProduceInTx: jest.fn(),
}));

jest.mock("../../utils/auditLogger", () => ({ writeAudit: jest.fn() }));

const productionService = require("../../lib/productionService");
const { writeAudit } = require("../../utils/auditLogger");
const service = require("../../services/stockWriteOff.service");
const { parseDateStart, cairoTodayISO } = require("../../utils/dateRange");

const ACTOR = { userId: 5, branchId: 1, ipAddress: "127.0.0.1" };

const validBody = {
  itemId: 42,
  warehouseId: 3,
  quantity: 10,
  reason: "INTERNAL_USE",
  date: "2026-08-27",
  notes: "علب مناديل",
};

/** Wire the happy path: item + warehouse exist, cost is 25, stock is sufficient. */
const happyPath = ({ costPrice = 25 } = {}) => {
  mockTx.item.findUnique.mockResolvedValue({ id: 42, name: "علبة مناديل", costPrice });
  mockTx.warehouse.findUnique.mockResolvedValue({ id: 3, isActive: true });
  mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });
  mockTx.bOM.findFirst.mockResolvedValue(null);
  mockTx.stockWriteOff.create.mockImplementation(async ({ data }) => ({
    id: 100,
    ...data,
    item: { id: 42, name: "علبة مناديل" },
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  // resolveSaleLineUnitCost reads item.costPrice through the tx client.
  mockTx.item.findUnique.mockResolvedValue({ costPrice: 25 });
});

// ── invariants ──────────────────────────────────────────────────────────────

describe("INVARIANT: never touches Item.costPrice", () => {
  test("a successful write-off does not update the item", async () => {
    happyPath();
    await service.createWriteOff(validBody, ACTOR);

    // Item.costPrice is a single global last-wins value feeding every future
    // COGS snapshot. Writing it here would re-price every later sale and, via
    // the POS edit path, retroactively re-price any invoice later edited.
    expect(mockTx.item.update).not.toHaveBeenCalled();
  });

  test("an explicit unit-cost override still does not update the item", async () => {
    happyPath();
    await service.createWriteOff({ ...validBody, unitCost: 40 }, ACTOR);

    expect(mockTx.item.update).not.toHaveBeenCalled();
    expect(mockTx.stockWriteOff.create.mock.calls[0][0].data.unitCost).toBe(40);
  });
});

describe("INVARIANT: never auto-produces", () => {
  test("the deduct-with-auto-produce helper is never called", async () => {
    happyPath();
    await service.createWriteOff(validBody, ACTOR);

    // That helper manufactures a short BOM item from raw materials and restamps
    // Item.costPrice. A write-off destroys stock; it must never create any.
    expect(productionService.deductStockWithAutoProduceInTx).not.toHaveBeenCalled();
    expect(productionService.executeProductionInTx).not.toHaveBeenCalled();
  });
});

describe("the stock decrement is guarded", () => {
  test("it uses updateMany with a gte predicate, not a bare update", async () => {
    happyPath();
    await service.createWriteOff(validBody, ACTOR);

    const call = mockTx.inventory.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      itemId: 42,
      warehouseId: 3,
      quantity: { gte: 10 },
    });
    expect(call.data).toEqual({ quantity: { decrement: 10 } });

    // An upsert would CREATE a missing inventory row and take it negative.
    expect(mockTx.inventory.upsert).not.toHaveBeenCalled();
    expect(mockTx.inventory.update).not.toHaveBeenCalled();
  });

  test("insufficient stock rejects with 409 and writes no row", async () => {
    happyPath();
    mockTx.inventory.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.createWriteOff(validBody, ACTOR)).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
    });
    expect(mockTx.stockWriteOff.create).not.toHaveBeenCalled();
  });

  test("no inventory row at all is treated as insufficient, not as zero", async () => {
    happyPath();
    // count === 0 covers both "not enough" and "row does not exist".
    mockTx.inventory.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.createWriteOff(validBody, ACTOR)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
  });
});

describe("the cost snapshot", () => {
  test("is resolved through the transaction client, not the root prisma", async () => {
    happyPath();
    await service.createWriteOff(validBody, ACTOR);

    // Reading outside the transaction could snapshot a cost a parallel purchase
    // has already replaced.
    expect(mockTx.item.findUnique).toHaveBeenCalled();
    expect(require("../../config/database").item.findUnique).not.toHaveBeenCalled();
  });

  test("is rounded to 2dp to match SaleItem.costPrice", async () => {
    happyPath();
    await service.createWriteOff({ ...validBody, unitCost: 3.999 }, ACTOR);

    expect(mockTx.stockWriteOff.create.mock.calls[0][0].data.unitCost).toBe(4);
  });

  test("a zero-cost item is REJECTED rather than silently written off for nothing", async () => {
    happyPath({ costPrice: 0 });
    mockTx.item.findUnique
      .mockResolvedValueOnce({ id: 42, name: "علبة مناديل" }) // existence check
      .mockResolvedValueOnce({ costPrice: 0 }); // cost resolution
    mockTx.bOM.findFirst.mockResolvedValue(null);

    await expect(service.createWriteOff(validBody, ACTOR)).rejects.toMatchObject({
      status: 400,
      code: "ZERO_COST",
    });
    // Decrementing stock for zero cost would re-create the exact hole this
    // feature exists to close.
    expect(mockTx.stockWriteOff.create).not.toHaveBeenCalled();
  });

  test("an override rescues a zero-cost item", async () => {
    happyPath({ costPrice: 0 });
    await service.createWriteOff({ ...validBody, unitCost: 12.5 }, ACTOR);

    expect(mockTx.stockWriteOff.create.mock.calls[0][0].data.unitCost).toBe(12.5);
    expect(mockTx.item.update).not.toHaveBeenCalled();
  });
});

describe("the business date", () => {
  test("is stored as a Cairo-midnight instant", async () => {
    happyPath();
    await service.createWriteOff(validBody, ACTOR);

    const stored = mockTx.stockWriteOff.create.mock.calls[0][0].data.date;
    expect(stored.toISOString()).toBe("2026-08-26T22:00:00.000Z");
    expect(stored.toISOString()).toBe(parseDateStart("2026-08-27").toISOString());
  });

  test("defaults to today in Cairo when omitted", async () => {
    happyPath();
    const { date, ...noDate } = validBody;
    await service.createWriteOff(noDate, ACTOR);

    const stored = mockTx.stockWriteOff.create.mock.calls[0][0].data.date;
    expect(stored.toISOString()).toBe(parseDateStart(cairoTodayISO()).toISOString());
  });

  test("a future date is rejected", async () => {
    happyPath();
    await expect(
      service.createWriteOff({ ...validBody, date: "2099-01-01" }, ACTOR),
    ).rejects.toMatchObject({ status: 400, code: "FUTURE_DATE" });
  });
});

describe("input validation", () => {
  const cases = [
    ["a zero quantity", { quantity: 0 }, "INVALID_QUANTITY"],
    ["a negative quantity", { quantity: -5 }, "INVALID_QUANTITY"],
    ["a non-numeric quantity", { quantity: "abc" }, "INVALID_QUANTITY"],
    ["an unknown reason", { reason: "BECAUSE" }, "INVALID_REASON"],
    ["a missing reason", { reason: undefined }, "INVALID_REASON"],
    ["a missing item", { itemId: undefined }, "INVALID_ITEM"],
    ["a missing warehouse", { warehouseId: undefined }, "INVALID_WAREHOUSE"],
    ["a zero unit-cost override", { unitCost: 0 }, "INVALID_UNIT_COST"],
    ["a negative unit-cost override", { unitCost: -3 }, "INVALID_UNIT_COST"],
  ];

  test.each(cases)("rejects %s", async (_label, patch, code) => {
    happyPath();
    await expect(
      service.createWriteOff({ ...validBody, ...patch }, ACTOR),
    ).rejects.toMatchObject({ status: 400, code });
  });
});

describe("reversal is a contra row, never a delete", () => {
  const original = {
    id: 100,
    itemId: 42,
    warehouseId: 3,
    quantity: 10,
    unitCost: 25,
    reason: "INTERNAL_USE",
    reversal: null,
    item: { id: 42, name: "علبة مناديل" },
  };

  const primeReversal = (row = original) => {
    mockTx.stockWriteOff.findUnique.mockResolvedValue(row);
    mockTx.inventory.upsert.mockResolvedValue({});
    mockTx.stockWriteOff.create.mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
    }));
  };

  test("writes a negative row and never deletes the original", async () => {
    primeReversal();
    await service.reverseWriteOff(100, ACTOR);

    const data = mockTx.stockWriteOff.create.mock.calls[0][0].data;
    expect(data.quantity).toBe(-10);
    expect(data.reversesId).toBe(100);
    // Deleting would rewrite the closed month the original landed in.
    expect(mockTx.stockWriteOff.delete).not.toHaveBeenCalled();
  });

  test("COPIES the original unit cost instead of re-resolving it", async () => {
    primeReversal();
    // Item.costPrice has since moved to 40. Re-resolving would make the pair
    // net to −150 instead of 0 — permanent phantom COGS.
    mockTx.item.findUnique.mockResolvedValue({ costPrice: 40 });

    await service.reverseWriteOff(100, ACTOR);

    expect(mockTx.stockWriteOff.create.mock.calls[0][0].data.unitCost).toBe(25);
  });

  test("is dated today, not the original's date", async () => {
    primeReversal();
    await service.reverseWriteOff(100, ACTOR);

    const stored = mockTx.stockWriteOff.create.mock.calls[0][0].data.date;
    expect(stored.toISOString()).toBe(parseDateStart(cairoTodayISO()).toISOString());
  });

  test("restores stock with upsert+increment so a deleted row still works", async () => {
    primeReversal();
    await service.reverseWriteOff(100, ACTOR);

    const call = mockTx.inventory.upsert.mock.calls[0][0];
    expect(call.update).toEqual({ quantity: { increment: 10 } });
    expect(call.create).toMatchObject({ itemId: 42, warehouseId: 3, quantity: 10 });
  });

  test("a reversal cannot itself be reversed", async () => {
    primeReversal({ ...original, quantity: -10 });

    await expect(service.reverseWriteOff(100, ACTOR)).rejects.toMatchObject({
      status: 400,
      code: "CANNOT_REVERSE_REVERSAL",
    });
  });

  test("a write-off cannot be reversed twice", async () => {
    primeReversal({ ...original, reversal: { id: 101 } });

    await expect(service.reverseWriteOff(100, ACTOR)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_REVERSED",
    });
    expect(mockTx.inventory.upsert).not.toHaveBeenCalled();
  });

  test("a missing row is a 404", async () => {
    mockTx.stockWriteOff.findUnique.mockResolvedValue(null);

    await expect(service.reverseWriteOff(999, ACTOR)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("audit trail", () => {
  test("records the P&L impact and flags a back-dated row", async () => {
    happyPath();
    await service.createWriteOff(validBody, ACTOR);

    const audit = writeAudit.mock.calls[0][0];
    expect(audit.targetEntity).toBe("stock_write_off");
    expect(audit.action).toBe("CREATE");
    expect(audit.newValues.cogsImpact).toBe(250);
    expect(audit.newValues.backdated).toBe(validBody.date !== cairoTodayISO());
  });
});
