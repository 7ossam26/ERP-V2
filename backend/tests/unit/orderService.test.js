// Unit tests for backend/lib/orderService.js (design §9.1)
// Mocks Prisma tx + eventBus so nothing touches the DB or network.

jest.mock("../../lib/eventBus", () => {
  const publish = jest.fn();
  return {
    publish,
    topics: {
      userNotifications: (id) => `notifications:user:${id}`,
      branchNotifications: (id) => `notifications:branch:${id}`,
    },
  };
});

const bus = require("../../lib/eventBus");
const {
  createOrderInTx,
  publishNewOrderNotifications,
  drainPendingForBranch,
  broadcastStatusChange,
} = require("../../lib/orderService");

beforeEach(() => {
  bus.publish.mockClear();
});

async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("createOrderInTx", () => {
  test("persists Sale-linked Order with channel/status/timestamps", async () => {
    const created = {
      id: 42,
      saleId: 10,
      branchId: 1,
      createdById: 7,
      channel: "CALL_CENTER",
      status: "NEW",
    };
    const tx = { order: { create: jest.fn().mockResolvedValue(created) } };

    const result = await createOrderInTx(tx, {
      saleId: 10,
      branchId: 1,
      createdById: 7,
      channel: "CALL_CENTER",
    });

    expect(tx.order.create).toHaveBeenCalledTimes(1);
    const args = tx.order.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      saleId: 10,
      branchId: 1,
      createdById: 7,
      channel: "CALL_CENTER",
      status: "NEW",
    });
    expect(args.data.deliveredAt).toBeUndefined();
    expect(result).toBe(created);
  });

  test("stamps deliveredAt for POS orders finalized on creation", async () => {
    const tx = { order: { create: jest.fn().mockResolvedValue({ id: 1 }) } };

    await createOrderInTx(tx, {
      saleId: 5,
      branchId: 2,
      createdById: 9,
      channel: "POS",
      status: "DELIVERED",
    });

    const data = tx.order.create.mock.calls[0][0].data;
    expect(data.channel).toBe("POS");
    expect(data.status).toBe("DELIVERED");
    expect(data.deliveredAt).toBeInstanceOf(Date);
  });

  test("does not stamp deliveredAt for POS orders not yet delivered", async () => {
    const tx = { order: { create: jest.fn().mockResolvedValue({ id: 1 }) } };

    await createOrderInTx(tx, {
      saleId: 5,
      branchId: 2,
      createdById: 9,
      channel: "POS",
      status: "NEW",
    });

    expect(tx.order.create.mock.calls[0][0].data.deliveredAt).toBeUndefined();
  });
});

describe("publishNewOrderNotifications", () => {
  function buildTx(openShiftUserIds) {
    let notifId = 100;
    return {
      shift: {
        findMany: jest
          .fn()
          .mockResolvedValue(openShiftUserIds.map((userId) => ({ userId }))),
      },
      notification: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: ++notifId,
          createdAt: new Date("2026-04-20T12:00:00Z"),
          ...data,
        })),
      },
    };
  }

  const order = {
    id: 77,
    branchId: 3,
    createdAt: new Date("2026-04-20T12:00:00Z"),
  };
  const sale = {
    id: 55,
    saleNumber: "S-001",
    total: 100,
    items: [{ id: 1 }, { id: 2 }],
  };
  const client = { name: "Ali", phoneNumber: "0100" };

  test("writes exactly one Notification row per active cashier", async () => {
    const tx = buildTx([11, 22, 33]);

    const rows = await publishNewOrderNotifications(tx, { order, sale, client });

    expect(tx.shift.findMany).toHaveBeenCalledWith({
      where: { branchId: 3, status: "OPEN" },
      select: { userId: true },
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(3);

    const userIds = tx.notification.create.mock.calls.map(
      (c) => c[0].data.userId,
    );
    expect(userIds).toEqual([11, 22, 33]);

    for (const call of tx.notification.create.mock.calls) {
      expect(call[0].data).toMatchObject({
        branchId: 3,
        type: "NEW_CALL_CENTER_ORDER",
      });
      expect(call[0].data.payload).toMatchObject({
        orderId: 77,
        saleId: 55,
        saleNumber: "S-001",
        clientName: "Ali",
        clientPhone: "0100",
        branchId: 3,
      });
    }
  });

  test("publishes on eventBus once per recipient", async () => {
    const tx = buildTx([11, 22]);

    await publishNewOrderNotifications(tx, { order, sale, client });

    expect(bus.publish).toHaveBeenCalledTimes(2);
    expect(bus.publish.mock.calls[0][0]).toBe("notifications:user:11");
    expect(bus.publish.mock.calls[1][0]).toBe("notifications:user:22");
    for (const call of bus.publish.mock.calls) {
      expect(call[1]).toMatchObject({ type: "NEW_CALL_CENTER_ORDER" });
      expect(typeof call[1].id).toBe("number");
    }
  });

  test("waits for eventBus publishes before resolving", async () => {
    const tx = buildTx([11]);
    let releasePublish;
    let resolved = false;
    bus.publish.mockImplementationOnce(
      () => new Promise((resolve) => {
        releasePublish = resolve;
      }),
    );

    const pending = publishNewOrderNotifications(tx, { order, sale, client }).then(() => {
      resolved = true;
    });

    await flushMicrotasks();

    expect(bus.publish).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);

    releasePublish();
    await pending;

    expect(resolved).toBe(true);
  });

  test("no-op when no cashier has an open shift", async () => {
    const tx = buildTx([]);

    const rows = await publishNewOrderNotifications(tx, { order, sale, client });

    expect(rows).toEqual([]);
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });
});

describe("drainPendingForBranch", () => {
  function buildDrainTx({ openShiftUserIds, pendingOrders }) {
    let notifId = 200;
    return {
      shift: {
        findMany: jest
          .fn()
          .mockResolvedValue(openShiftUserIds.map((userId) => ({ userId }))),
      },
      order: {
        findMany: jest.fn().mockResolvedValue(pendingOrders),
      },
      notification: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: ++notifId,
          createdAt: new Date("2026-04-22T08:00:00Z"),
          ...data,
        })),
      },
    };
  }

  const pendingOrder = {
    id: 10,
    branchId: 3,
    createdAt: new Date("2026-04-22T07:00:00Z"),
    sale: {
      id: 5,
      saleNumber: "S-002",
      total: 200,
      items: [{ id: 1 }],
      client: { name: "Sara", phoneNumber: "0111" },
    },
  };

  test("broadcasts each pending order to ALL open-shift users", async () => {
    const tx = buildDrainTx({ openShiftUserIds: [11, 22], pendingOrders: [pendingOrder] });

    const rows = await drainPendingForBranch(tx, { branchId: 3 });

    // 1 order × 2 open shifts = 2 notifications
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(2);
    expect(bus.publish).toHaveBeenCalledTimes(2);

    const notifiedUserIds = tx.notification.create.mock.calls.map(
      (c) => c[0].data.userId,
    );
    expect(notifiedUserIds).toEqual([11, 22]);
  });

  test("waits for eventBus publishes before resolving", async () => {
    const tx = buildDrainTx({ openShiftUserIds: [11], pendingOrders: [pendingOrder] });
    let releasePublish;
    let resolved = false;
    bus.publish.mockImplementationOnce(
      () => new Promise((resolve) => {
        releasePublish = resolve;
      }),
    );

    const pending = drainPendingForBranch(tx, { branchId: 3 }).then(() => {
      resolved = true;
    });

    await flushMicrotasks();

    expect(bus.publish).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);

    releasePublish();
    await pending;

    expect(resolved).toBe(true);
  });

  test("returns empty and skips notifications when no open shifts", async () => {
    const tx = buildDrainTx({ openShiftUserIds: [], pendingOrders: [pendingOrder] });

    const rows = await drainPendingForBranch(tx, { branchId: 3 });

    expect(rows).toEqual([]);
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  test("returns empty when no pending orders exist", async () => {
    const tx = buildDrainTx({ openShiftUserIds: [11], pendingOrders: [] });

    const rows = await drainPendingForBranch(tx, { branchId: 3 });

    expect(rows).toEqual([]);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});

describe("broadcastStatusChange", () => {
  function buildPrismaClient(openShiftUserIds) {
    let notifId = 300;
    return {
      shift: {
        findMany: jest
          .fn()
          .mockResolvedValue(openShiftUserIds.map((userId) => ({ userId }))),
      },
      notification: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: ++notifId,
          createdAt: new Date("2026-04-22T09:00:00Z"),
          ...data,
        })),
      },
    };
  }

  const order = {
    id: 77,
    saleId: 55,
    branchId: 3,
    createdById: 99,
    status: "PREPARING",
    updatedAt: new Date("2026-04-22T09:00:00Z"),
  };
  const sale = {
    id: 55,
    saleNumber: "S-001",
  };

  test("waits for eventBus publishes before resolving", async () => {
    const prismaClient = buildPrismaClient([11]);
    let releasePublish;
    let resolved = false;
    bus.publish.mockImplementationOnce(
      () => new Promise((resolve) => {
        releasePublish = resolve;
      }),
    );

    const pending = broadcastStatusChange(prismaClient, { order, sale }).then(() => {
      resolved = true;
    });

    await flushMicrotasks();

    expect(bus.publish).toHaveBeenCalledTimes(2);
    expect(resolved).toBe(false);

    releasePublish();
    await pending;

    expect(resolved).toBe(true);
  });
});
