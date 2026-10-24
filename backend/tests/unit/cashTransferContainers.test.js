/**
 * Cash transfers and the two containers a branch treasury covers —
 * routes/treasuries.js + lib/branchCash.js.
 *
 * A branch treasury is drawer + safe in ONE account. The sender of a transfer
 * says which container the cash physically left (`fromDrawer`), the receiver
 * which one it arrived in (`toDrawer`); a drawer transfer is stamped with the
 * branch's OPEN shift so calculateSystemExpectedCash can count it. Pinned here:
 *
 *   - the container flags and shift stamps are written correctly;
 *   - a drawer transfer needs an OPEN shift;
 *   - per-container limits warn (409 CONTAINER_LIMIT) and `force` overrides;
 *   - the debit is a compare-and-set, never a read-then-write;
 *   - approve / reject are single-shot claims: a second one moves no money.
 */

const TREASURY_BRANCH = 7;
const TREASURY_MAIN = 1;
const BRANCH_ID = 4;
const SHIFT_ID = 55;

const mockState = {
  treasuries: new Map(),
  transfers: [],
  shift: null,
  expected: 0,
  nextTransferId: 1,
};

const mockMatch = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && "gte" in v) return Number(row[k]) >= Number(v.gte);
    if (v && typeof v === "object" && "in" in v) return v.in.includes(row[k]);
    return row[k] === v;
  });

jest.mock("../../config/database", () => {
  const client = {
    systemConfiguration: { findFirst: jest.fn(async () => ({ mainTreasuryId: 1 })) },
    treasury: {
      findUnique: jest.fn(async ({ where }) => {
        const t = mockState.treasuries.get(where.id);
        return t ? { ...t } : null;
      }),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async ({ where, data }) => {
        const t = mockState.treasuries.get(where.id);
        if (data.balance?.increment !== undefined) t.balance += Number(data.balance.increment);
        if (data.balance?.decrement !== undefined) t.balance -= Number(data.balance.decrement);
        return { ...t };
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const t = mockState.treasuries.get(where.id);
        if (!t || !mockMatch(t, { balance: where.balance })) return { count: 0 };
        t.balance -= Number(data.balance.decrement);
        return { count: 1 };
      }),
    },
    shift: {
      findFirst: jest.fn(async ({ where }) => {
        const s = mockState.shift;
        if (!s || s.branchId !== where.branchId) return null;
        return where.status.in.includes(s.status) ? { ...s, user: { name: "Cashier" } } : null;
      }),
    },
    cashTransfer: {
      create: jest.fn(async ({ data }) => {
        const row = { id: mockState.nextTransferId++, createdAt: new Date(), ...data };
        mockState.transfers.push(row);
        return { ...row };
      }),
      findUnique: jest.fn(async ({ where }) => {
        const r = mockState.transfers.find((t) => t.id === where.id);
        return r ? { ...r } : null;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const r = mockState.transfers.find((t) => t.id === where.id && t.status === where.status);
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      }),
    },
    $transaction: jest.fn(async (cb) => cb(client)),
  };
  return client;
});

jest.mock("../../routes/shifts", () => ({
  calculateSystemExpectedCash: jest.fn(async () => ({ expected: mockState.expected })),
}));

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 9 };
    next();
  },
  requirePermission: () => (req, res, next) => next(),
  requireCreatePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  getUserBranchFilter: jest.fn(async () => null),
}));

const express = require("express");
const request = require("supertest");

const app = express();
app.use(express.json());
app.use("/api/treasuries", require("../../routes/treasuries"));

/** Branch account 10,000: drawer 3,000 (open shift) + safe 7,000. */
const seed = ({ shiftStatus = "OPEN", balance = 10000, drawer = 3000 } = {}) => {
  mockState.treasuries.clear();
  mockState.treasuries.set(TREASURY_BRANCH, {
    id: TREASURY_BRANCH,
    name: "خزنة الفرع",
    scope: "BRANCH_CASH",
    balance,
    branch: { id: BRANCH_ID, name: "مكه" },
  });
  mockState.treasuries.set(TREASURY_MAIN, {
    id: TREASURY_MAIN,
    name: "الخزينة الرئيسية",
    scope: "MAIN",
    balance: 0,
    branch: null,
  });
  mockState.transfers.length = 0;
  mockState.nextTransferId = 1;
  mockState.expected = drawer;
  mockState.shift = shiftStatus
    ? {
        id: SHIFT_ID,
        branchId: BRANCH_ID,
        status: shiftStatus,
        userId: 9,
        startTime: new Date(),
        actualCash: shiftStatus === "PENDING_REVIEW" ? drawer - 50 : null,
        systemExpectedCash: shiftStatus === "PENDING_REVIEW" ? drawer : null,
        shortage: shiftStatus === "PENDING_REVIEW" ? -50 : null,
      }
    : null;
};

const send = (body) =>
  request(app)
    .post("/api/treasuries/transfer")
    .send({ fromTreasuryId: TREASURY_BRANCH, toTreasuryId: TREASURY_MAIN, ...body });

const balanceOf = (id) => mockState.treasuries.get(id).balance;

beforeEach(() => seed());

describe("GET /:id/cash-split", () => {
  test("an OPEN shift splits the balance into drawer + safe", async () => {
    const res = await request(app).get(`/api/treasuries/${TREASURY_BRANCH}/cash-split`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      balance: 10000,
      drawerCash: 3000,
      safeCash: 7000,
      shift: { id: SHIFT_ID, status: "OPEN" },
    });
  });

  test("PENDING_REVIEW: drawer is the count, safe excludes the frozen expected", async () => {
    seed({ shiftStatus: "PENDING_REVIEW" });
    const res = await request(app).get(`/api/treasuries/${TREASURY_BRANCH}/cash-split`);
    expect(res.body).toMatchObject({ drawerCash: 2950, safeCash: 7000, pendingVariance: -50 });
  });

  test("no live shift: the split is unknown, not guessed", async () => {
    seed({ shiftStatus: null });
    const res = await request(app).get(`/api/treasuries/${TREASURY_BRANCH}/cash-split`);
    expect(res.body).toMatchObject({ balance: 10000, drawerCash: null, safeCash: null, shift: null });
  });
});

describe("POST /transfer", () => {
  test("from the drawer: stamped with the open shift and debited", async () => {
    const res = await send({ amount: 2500, fromDrawer: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromDrawer: true, fromShiftId: SHIFT_ID, status: "PENDING" });
    expect(balanceOf(TREASURY_BRANCH)).toBe(7500);
  });

  test("from the safe (default): no shift stamp", async () => {
    const res = await send({ amount: 6000 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromDrawer: false, fromShiftId: null });
  });

  test("a drawer transfer needs an OPEN shift", async () => {
    seed({ shiftStatus: null });
    const res = await send({ amount: 100, fromDrawer: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_OPEN_SHIFT");
    expect(balanceOf(TREASURY_BRANCH)).toBe(10000);
  });

  test("a counted (PENDING_REVIEW) drawer cannot be drawn on", async () => {
    seed({ shiftStatus: "PENDING_REVIEW" });
    const res = await send({ amount: 100, fromDrawer: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_OPEN_SHIFT");
  });

  test("more than the drawer holds warns, and force overrides", async () => {
    const warn = await send({ amount: 3500, fromDrawer: true });
    expect(warn.status).toBe(409);
    expect(warn.body.code).toBe("CONTAINER_LIMIT");
    expect(warn.body.details).toMatchObject({ container: "DRAWER", drawerCash: 3000 });
    expect(balanceOf(TREASURY_BRANCH)).toBe(10000);

    const forced = await send({ amount: 3500, fromDrawer: true, force: true });
    expect(forced.status).toBe(201);
    expect(balanceOf(TREASURY_BRANCH)).toBe(6500);
  });

  test("more than the safe holds (with the till open) warns — that cash is in the drawer", async () => {
    const res = await send({ amount: 8000 });

    expect(res.status).toBe(409);
    expect(res.body.details).toMatchObject({ container: "SAFE", safeCash: 7000, drawerCash: 3000 });
    expect(mockState.transfers).toHaveLength(0);
  });

  test("with no open shift the whole balance is transferable from the safe", async () => {
    seed({ shiftStatus: null });
    const res = await send({ amount: 10000 });
    expect(res.status).toBe(201);
    expect(balanceOf(TREASURY_BRANCH)).toBe(0);
  });

  test("the debit is a compare-and-set: overdrawing is refused even when forced", async () => {
    const res = await send({ amount: 10001, force: true });

    expect(res.status).toBe(400);
    expect(balanceOf(TREASURY_BRANCH)).toBe(10000);
    expect(mockState.transfers).toHaveLength(0);
  });
});

describe("approve / reject", () => {
  const pending = async (body = {}) => (await send({ amount: 1000, ...body })).body.id;

  test("approve credits the destination once; a replay is refused and moves nothing", async () => {
    const id = await pending();

    const first = await request(app).post(`/api/treasuries/transfer/${id}/approve`).send({});
    expect(first.status).toBe(200);
    expect(first.body.resolvedAt).toBeTruthy();
    expect(balanceOf(TREASURY_MAIN)).toBe(1000);

    const replay = await request(app).post(`/api/treasuries/transfer/${id}/approve`).send({});
    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect(balanceOf(TREASURY_MAIN)).toBe(1000);
  });

  test("approve racing reject: exactly one of them moves money", async () => {
    const id = await pending();

    const [a, b] = await Promise.all([
      request(app).post(`/api/treasuries/transfer/${id}/approve`).send({}),
      request(app).post(`/api/treasuries/transfer/${id}/reject`).send({}),
    ]);

    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    // Either the destination got it or the source got it back — never both.
    const total = balanceOf(TREASURY_MAIN) + balanceOf(TREASURY_BRANCH);
    expect(total).toBe(10000);
  });

  test("reject refunds the source and stamps resolvedAt", async () => {
    const id = await pending({ fromDrawer: true });

    const res = await request(app).post(`/api/treasuries/transfer/${id}/reject`).send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    expect(res.body.resolvedAt).toBeTruthy();
    expect(balanceOf(TREASURY_BRANCH)).toBe(10000);
  });

  test("received into the drawer: stamped with the destination's open shift", async () => {
    // HQ → branch, approved by the branch into its register.
    mockState.treasuries.get(TREASURY_MAIN).balance = 5000;
    const sent = await request(app)
      .post("/api/treasuries/transfer")
      .send({ fromTreasuryId: TREASURY_MAIN, toTreasuryId: TREASURY_BRANCH, amount: 2000 });
    expect(sent.status).toBe(201);

    const res = await request(app)
      .post(`/api/treasuries/transfer/${sent.body.id}/approve`)
      .send({ toDrawer: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ toDrawer: true, toShiftId: SHIFT_ID });
  });

  test("receiving into the drawer needs an open shift at the destination", async () => {
    const id = await pending(); // destination is MAIN — no drawer at all

    const res = await request(app)
      .post(`/api/treasuries/transfer/${id}/approve`)
      .send({ toDrawer: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_OPEN_SHIFT");
    expect(mockState.transfers[0].status).toBe("PENDING");
  });
});
