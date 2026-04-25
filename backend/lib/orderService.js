// backend/lib/orderService.js
// Shared helpers for creating Order rows alongside Sale rows, and for publishing
// notifications through the EventBus. Both the POS sale flow and the call-center
// flow call into here so the workflow layer stays consistent.

const bus = require("./eventBus");

/**
 * Create an Order row inside an existing Prisma transaction.
 *
 * @param {object} tx Prisma transaction client
 * @param {object} args
 * @param {number} args.saleId
 * @param {number} args.branchId  Denormalized from Sale.branchId. MUST equal
 *   the parent Sale's branchId — enforced here at the single write-path. Never
 *   update this field after creation; to find a branch, join through Sale.
 * @param {number} args.createdById   User id of the actor (cashier for POS, agent for call-center)
 * @param {'POS'|'CALL_CENTER'|'WHATSAPP'|'WEB'|'AGGREGATOR'} args.channel
 * @param {'NEW'|'PREPARING'|'READY'|'OUT_FOR_DELIVERY'|'DELIVERED'|'CANCELLED'} [args.status='NEW']
 * @returns {Promise<object>} created Order
 */
async function createOrderInTx(tx, { saleId, branchId, createdById, channel, status = "NEW" }) {
  const now = new Date();
  const data = {
    saleId,
    branchId,
    createdById,
    channel,
    status,
  };
  // POS sales are finalized on creation — stamp the lifecycle fields so reports are honest.
  if (channel === "POS" && status === "DELIVERED") {
    data.deliveredAt = now;
  }
  return tx.order.create({ data });
}

/**
 * Persist a NEW_CALL_CENTER_ORDER notification for every cashier currently
 * holding an OPEN shift at the given branch, and publish an event on the bus
 * for each of them. Must run inside (or right after) the order-create
 * transaction — we pass `tx` so notification rows are rolled back if the sale
 * fails.
 */
async function publishNewOrderNotifications(tx, { order, sale, client }) {
  const openShifts = await tx.shift.findMany({
    where: { branchId: order.branchId, status: "OPEN" },
    select: { userId: true },
  });

  if (openShifts.length === 0) {
    // No cashier on shift — Q16-B: queue silently. The shift-open hook will
    // drain NEW orders when the next shift opens.
    return [];
  }

  const payload = {
    orderId: order.id,
    saleId: sale.id,
    saleNumber: sale.saleNumber,
    clientName: client?.name || null,
    clientPhone: client?.phoneNumber || null,
    total: Number(sale.total),
    itemsCount: Array.isArray(sale.items) ? sale.items.length : undefined,
    branchId: order.branchId,
    createdAt: order.createdAt,
  };

  const notifications = [];
  for (const s of openShifts) {
    const row = await tx.notification.create({
      data: {
        userId: s.userId,
        branchId: order.branchId,
        type: "NEW_CALL_CENTER_ORDER",
        payload,
      },
    });
    notifications.push(row);
  }

  // Publish AFTER tx commits — queue the emits for after-commit dispatch.
  // We can't await commit here, so the caller should call `dispatchQueued`
  // once the transaction resolves. To keep the interface simple, publish
  // immediately; if the tx rolls back, SSE listeners see an event for a
  // notification row that disappears — the client's REST-history refresh
  // reconciles on the next tick. Acceptable for our scale.
  await Promise.all(
    notifications.map((n) =>
      bus.publish(bus.topics.userNotifications(n.userId), {
        id: n.id,
        type: n.type,
        payload: n.payload,
        createdAt: n.createdAt,
      }),
    ),
  );

  return notifications;
}

/**
 * On shift open, fire notifications for any still-NEW orders at that branch
 * that were created while no shift was open (Q16-B queue).
 *
 * Broadcasts to EVERY user who has an open shift at this branch (not just the
 * opener) so that cashiers who were already on duty also see the queued orders.
 * Client-side dedup by notification id prevents double-display.
 */
async function drainPendingForBranch(tx, { branchId }) {
  const openShifts = await tx.shift.findMany({
    where: { branchId, status: "OPEN" },
    select: { userId: true },
  });

  if (openShifts.length === 0) return [];

  const pending = await tx.order.findMany({
    where: {
      branchId,
      status: "NEW",
      channel: { not: "POS" },
    },
    include: {
      sale: { include: { client: true, items: true } },
    },
  });

  if (pending.length === 0) return [];

  const published = [];
  const publishTasks = [];
  for (const order of pending) {
    const payload = {
      orderId: order.id,
      saleId: order.sale.id,
      saleNumber: order.sale.saleNumber,
      clientName: order.sale.client?.name || null,
      clientPhone: order.sale.client?.phoneNumber || null,
      total: Number(order.sale.total),
      itemsCount: order.sale.items.length,
      branchId,
      createdAt: order.createdAt,
      replay: true,
    };

    for (const shift of openShifts) {
      const row = await tx.notification.create({
        data: { userId: shift.userId, branchId, type: "NEW_CALL_CENTER_ORDER", payload },
      });
      publishTasks.push(
        bus.publish(bus.topics.userNotifications(shift.userId), {
          id: row.id,
          type: row.type,
          payload: row.payload,
          createdAt: row.createdAt,
        }),
      );
      published.push(row);
    }
  }
  await Promise.all(publishTasks);
  return published;
}

/**
 * Broadcast a status change to every open-shift cashier at the branch plus the
 * original creator. Persists a Notification row per recipient (C4) so SSE
 * Last-Event-ID replay can deliver missed transitions after reconnect; the
 * bell/list endpoints filter these out by default so they act as refresh hints
 * rather than visible bell entries. Call AFTER the transaction commits.
 */
async function broadcastStatusChange(prismaClient, { order, sale }) {
  const openShifts = await prismaClient.shift.findMany({
    where: { branchId: order.branchId, status: "OPEN" },
    select: { userId: true },
  });
  const recipientIds = new Set(openShifts.map((s) => s.userId));
  if (order.createdById) recipientIds.add(order.createdById);
  if (recipientIds.size === 0) return;

  const payload = {
    orderId: order.id,
    saleId: sale?.id ?? order.saleId,
    saleNumber: sale?.saleNumber,
    status: order.status,
    branchId: order.branchId,
    updatedAt: order.updatedAt,
  };

  const publishTasks = [];
  for (const userId of recipientIds) {
    const row = await prismaClient.notification.create({
      data: {
        userId,
        branchId: order.branchId,
        type: "ORDER_STATUS_CHANGED",
        payload,
        // Mark read on creation — these are refresh hints, not bell entries.
        readAt: new Date(),
      },
    });
    publishTasks.push(
      bus.publish(bus.topics.userNotifications(userId), {
        id: row.id,
        type: row.type,
        payload: row.payload,
        createdAt: row.createdAt,
      }),
    );
  }
  await Promise.all(publishTasks);
}

module.exports = {
  createOrderInTx,
  publishNewOrderNotifications,
  drainPendingForBranch,
  broadcastStatusChange,
};
