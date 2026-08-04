// Unit tests for createCustomerPayment in services/bulkPayments.service.js
//
// The invariant under test is a money conservation law: whatever the treasury is
// credited, the customer's account must be debited by the same total. The
// service credits the treasury with the FULL amount unconditionally, then writes
// payment rows capped at each order's balance — so anything the orders cannot
// absorb has to land in a floating row or it vanishes.
//
// This is the اوبس case (02/08/2026): 75,120 collected against one order owing
// 10,260 credited خزينة الإدارة in full while the customer's account moved by
// 10,260. The 64,860 difference had no record anywhere.

jest.mock("../../utils/auditLogger", () => ({ writeAudit: jest.fn(async () => {}) }));

const { createCustomerPayment } = require("../../services/bulkPayments.service");

/**
 * Minimal stateful Prisma double: orders with balances, a treasury with a
 * balance, and a payment table that records what was written.
 */
function makePrisma({ orders = [], treasuryBalance = 0 } = {}) {
  const store = {
    orders: orders.map((o) => ({ paidAt: null, ...o })),
    payments: [],
    treasury: { id: 9, name: "خزينه اداره", balance: treasuryBalance },
    nextPaymentId: 1,
  };

  const tx = {
    bulkCustomer: {
      findUnique: async () => ({ id: 20, companyName: "اوبس" }),
    },
    treasury: {
      findUnique: async () => ({ ...store.treasury }),
      update: async ({ data }) => {
        if (data.balance?.increment != null) store.treasury.balance += Number(data.balance.increment);
        if (data.balance?.decrement != null) store.treasury.balance -= Number(data.balance.decrement);
        return { ...store.treasury };
      },
    },
    bulkOrder: {
      findMany: async ({ where }) =>
        store.orders
          .filter((o) => where.status.in.includes(o.status))
          .sort((a, b) => a.createdAt - b.createdAt),
      findUnique: async ({ where }) => store.orders.find((o) => o.id === where.id) || null,
      update: async ({ where, data }) => {
        const o = store.orders.find((x) => x.id === where.id);
        Object.assign(o, data);
        return o;
      },
    },
    bulkPayment: {
      create: async ({ data }) => {
        const row = { id: store.nextPaymentId++, voidedAt: null, ...data };
        store.payments.push(row);
        return row;
      },
      findMany: async ({ where }) =>
        store.payments.filter((p) => p.orderId === where.orderId && p.voidedAt === null),
    },
  };

  return {
    store,
    prisma: { $transaction: async (fn) => fn(tx) },
  };
}

const totalWrittenToCustomer = (store) =>
  Math.round(store.payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;

describe("createCustomerPayment — the treasury and the customer account must agree", () => {
  test("the اوبس case: an overpayment beyond the open orders is still recorded", async () => {
    const { prisma, store } = makePrisma({
      orders: [{ id: 85, status: "CONFIRMED", total: 10260, balanceDue: 10260, createdAt: 1 }],
      treasuryBalance: 185684,
    });

    await createCustomerPayment(prisma, 20, { amount: 75120, treasuryId: 9 }, 2);

    // The treasury took the whole 75,120 — that part was never in question.
    expect(store.treasury.balance).toBe(260804);
    // And now the customer's account carries the whole 75,120 too.
    expect(totalWrittenToCustomer(store)).toBe(75120);
  });

  test("the leftover lands in one floating row for exactly the unabsorbed amount", async () => {
    const { prisma, store } = makePrisma({
      orders: [{ id: 85, status: "CONFIRMED", total: 10260, balanceDue: 10260, createdAt: 1 }],
    });

    await createCustomerPayment(prisma, 20, { amount: 75120, treasuryId: 9 }, 2);

    const floating = store.payments.filter((p) => p.orderId === null);
    expect(floating).toHaveLength(1);
    expect(Number(floating[0].amount)).toBe(64860);
    expect(floating[0].treasuryId).toBe(9);
  });

  test("a payment that the orders absorb exactly writes no floating row", async () => {
    const { prisma, store } = makePrisma({
      orders: [
        { id: 85, status: "CONFIRMED", total: 10260, balanceDue: 10260, createdAt: 1 },
        { id: 90, status: "CONFIRMED", total: 6400, balanceDue: 6400, createdAt: 2 },
      ],
    });

    await createCustomerPayment(prisma, 20, { amount: 16660, treasuryId: 9 }, 2);

    expect(store.payments.filter((p) => p.orderId === null)).toHaveLength(0);
    expect(totalWrittenToCustomer(store)).toBe(16660);
  });

  test("a partial payment still only writes what was paid", async () => {
    const { prisma, store } = makePrisma({
      orders: [{ id: 85, status: "CONFIRMED", total: 10260, balanceDue: 10260, createdAt: 1 }],
    });

    await createCustomerPayment(prisma, 20, { amount: 4000, treasuryId: 9 }, 2);

    expect(totalWrittenToCustomer(store)).toBe(4000);
    expect(store.payments.filter((p) => p.orderId === null)).toHaveLength(0);
  });

  test("with no open orders at all the whole amount becomes one floating row", async () => {
    // The behaviour the old `payments.length === 0` condition already had. It
    // stays intact — the fix widened the condition, it did not replace it.
    const { prisma, store } = makePrisma({ orders: [] });

    await createCustomerPayment(prisma, 20, { amount: 5000, treasuryId: 9 }, 2);

    expect(store.payments).toHaveLength(1);
    expect(store.payments[0].orderId).toBeNull();
    expect(Number(store.payments[0].amount)).toBe(5000);
  });

  test("across several orders, the treasury credit and the account total match", async () => {
    const { prisma, store } = makePrisma({
      orders: [
        { id: 1, status: "CONFIRMED", total: 1000, balanceDue: 1000, createdAt: 1 },
        { id: 2, status: "PARTIALLY_PAID", total: 2000, balanceDue: 500, createdAt: 2 },
        { id: 3, status: "CONFIRMED", total: 300, balanceDue: 300, createdAt: 3 },
      ],
      treasuryBalance: 0,
    });

    await createCustomerPayment(prisma, 20, { amount: 5000, treasuryId: 9 }, 2);

    expect(store.treasury.balance).toBe(5000);
    expect(totalWrittenToCustomer(store)).toBe(5000);
    // 1,000 + 500 + 300 absorbed, 3,200 floating.
    expect(Number(store.payments.find((p) => p.orderId === null).amount)).toBe(3200);
  });

  test("rounding does not leave a sub-piastre row behind", async () => {
    const { prisma, store } = makePrisma({
      orders: [{ id: 1, status: "CONFIRMED", total: 33.33, balanceDue: 33.33, createdAt: 1 }],
    });

    await createCustomerPayment(prisma, 20, { amount: 33.33, treasuryId: 9 }, 2);

    expect(store.payments.filter((p) => p.orderId === null)).toHaveLength(0);
    expect(totalWrittenToCustomer(store)).toBe(33.33);
  });
});
