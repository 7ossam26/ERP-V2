// controllers/callCenter.controller.js
const prisma = require("../config/database");
const { createOrderInTx, publishNewOrderNotifications, broadcastStatusChange } = require("../lib/orderService");

// -------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------

async function getAgentAccessibleBranchIds(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      accessibleBranches: { select: { id: true } },
    },
  });
  if (!user) return { isGlobal: false, ids: [] };

  const isGlobal =
    user.role &&
    (user.role.name === "Superadmin" ||
      user.role.name === "Admin" ||
      user.role.name === "General Manager");

  if (isGlobal) {
    const all = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return { isGlobal: true, ids: all.map((b) => b.id) };
  }

  const ids = new Set();
  if (user.branchId) ids.add(user.branchId);
  for (const b of user.accessibleBranches || []) ids.add(b.id);
  return { isGlobal: false, ids: [...ids] };
}

async function generateSaleNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);
  const count = await prisma.sale.count({
    where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
  });
  const sequence = String(count + 1).padStart(5, "0");
  return `SALE-${year}${month}-${sequence}`;
}

// -------------------------------------------------------------------------
// GET /api/call-center/branches — list the agent's accessible branches
// -------------------------------------------------------------------------
exports.listBranches = async (req, res, next) => {
  try {
    const { ids } = await getAgentAccessibleBranchIds(req.user.id);
    const branches = await prisma.branch.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        warehouseId: true,
        treasuryId: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(branches);
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------------------
// GET /api/call-center/items?branchId=X — catalog + stock at branch X
// -------------------------------------------------------------------------
exports.listItems = async (req, res, next) => {
  try {
    const branchId = parseInt(req.query.branchId);
    if (!branchId) {
      return res.status(400).json({ error: "branchId query param is required" });
    }

    const { isGlobal, ids } = await getAgentAccessibleBranchIds(req.user.id);
    if (!isGlobal && !ids.includes(branchId)) {
      return res.status(403).json({ error: "Branch not accessible" });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { warehouseId: true },
    });
    if (!branch) return res.status(404).json({ error: "Branch not found" });

    const items = await prisma.item.findMany({
      where: { showInPos: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true, // selling price visible per D12
        unit: true,
        inventory: {
          where: { warehouseId: branch.warehouseId },
          select: { quantity: true },
        },
        categories: {
          select: { category: { select: { id: true, name: true } } },
        },
      },
    });

    const shaped = items.map((it) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price),
      unit: it.unit,
      stock: it.inventory[0] ? Number(it.inventory[0].quantity) : 0,
      categories: it.categories.map((c) => c.category),
    }));

    res.json(shaped);
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------------------
// GET /api/call-center/clients?phone=...&name=... — lookup/search
// -------------------------------------------------------------------------
exports.searchClients = async (req, res, next) => {
  try {
    const { phone, name } = req.query;
    if (!phone && !name) return res.json([]);

    const where = {};
    if (phone) where.phoneNumber = { contains: phone };
    if (name) where.name = { contains: name };

    const clients = await prisma.client.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        address: true,
        _count: { select: { sales: true } },
        sales: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    res.json(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber,
        address: c.address,
        totalOrders: c._count.sales,
        lastOrderDate: c.sales[0]?.createdAt ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------------------
// POST /api/call-center/clients — inline create (name, phone, address)
// -------------------------------------------------------------------------
exports.createClient = async (req, res, next) => {
  try {
    const { name, phoneNumber, address } = req.body;
    if (!name || !phoneNumber) {
      return res.status(400).json({ error: "name and phoneNumber are required" });
    }

    // Dedupe on phone first (idempotent create).
    const existing = await prisma.client.findFirst({ where: { phoneNumber } });
    if (existing) return res.status(200).json(existing);

    const client = await prisma.client.create({
      data: { name, phoneNumber, address: address || null },
    });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------------------
// POST /api/call-center/orders — create call-center order (NEW)
// body: {
//   branchId, clientId,
//   items: [{ itemId, quantity, unitPrice }],
//   deliveryZoneId, deliveryAddress, notes
// }
// -------------------------------------------------------------------------
exports.createOrder = async (req, res, next) => {
  try {
    const {
      branchId,
      clientId,
      items,
      deliveryZoneId,
      deliveryAddress,
      notes,
      discountType,
      discountValue,
      discountReason,
    } = req.body;

    if (!branchId || !clientId) {
      return res.status(400).json({ error: "branchId and clientId are required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const { isGlobal, ids } = await getAgentAccessibleBranchIds(req.user.id);
    if (!isGlobal && !ids.includes(parseInt(branchId))) {
      return res.status(403).json({ error: "Branch not accessible" });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(branchId) },
      select: { id: true, warehouseId: true, treasuryId: true, isActive: true },
    });
    if (!branch || !branch.isActive) {
      return res.status(404).json({ error: "Branch not found or inactive" });
    }

    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
    });
    if (!client) return res.status(404).json({ error: "Client not found" });

    // Zone (optional, but validated if provided) — provides deliveryFee.
    let zone = null;
    if (deliveryZoneId) {
      zone = await prisma.deliveryZone.findUnique({
        where: { id: parseInt(deliveryZoneId) },
      });
      if (!zone) return res.status(404).json({ error: "Delivery zone not found" });
    }

    // Pull live prices so the agent can't spoof them.
    const itemIds = items.map((i) => parseInt(i.itemId)).filter(Boolean);
    const dbItems = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true },
    });
    const priceMap = new Map(dbItems.map((it) => [it.id, Number(it.price)]));

    const saleItems = [];
    let subtotal = 0;
    for (const raw of items) {
      const itemId = parseInt(raw.itemId);
      const qty = Number(raw.quantity);
      if (!itemId || !priceMap.has(itemId)) {
        return res.status(400).json({ error: `Unknown item: ${raw.itemId}` });
      }
      if (!qty || qty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for item ${itemId}` });
      }
      const unitPrice = priceMap.get(itemId);
      const total = unitPrice * qty;
      subtotal += total;
      saleItems.push({ itemId, quantity: qty, unitPrice, total });
    }

    // Discount (optional). Validate and cap at subtotal.
    let discType = null;
    let discValue = null;
    let discAmount = 0;
    let discReason = null;
    let discAppliedBy = null;
    if (discountValue != null && Number(discountValue) > 0) {
      if (!(subtotal > 0)) {
        return res
          .status(400)
          .json({ error: "Cannot apply discount when subtotal is zero" });
      }
      const type = String(discountType || "").toUpperCase();
      if (!["PERCENTAGE", "VALUE"].includes(type)) {
        return res.status(400).json({
          error: "Invalid discountType",
          validTypes: ["PERCENTAGE", "VALUE"],
        });
      }
      const val = Number(discountValue);
      if (!Number.isFinite(val) || val < 0) {
        return res.status(400).json({ error: "Invalid discountValue" });
      }
      if (!discountReason || !String(discountReason).trim()) {
        return res
          .status(400)
          .json({ error: "discountReason is required when a discount is applied" });
      }
      if (type === "PERCENTAGE") {
        if (val > 100) return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
        discAmount = Math.min(subtotal, (subtotal * val) / 100);
      } else {
        discAmount = Math.min(subtotal, val);
      }
      discType = type;
      discValue = val;
      discAmount = Math.round(discAmount); // round to nearest 1 EGP
      discReason = String(discountReason).trim().slice(0, 32);
      discAppliedBy = req.user && req.user.id ? req.user.id : null;
    }

    const deliveryFee = zone ? Number(zone.fee) : 0;
    const total = subtotal - discAmount + deliveryFee;
    const saleNumber = await generateSaleNumber();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Sale — COD. paidAt stays null until dispatch/delivery.
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          clientId: client.id,
          userId: req.user.id, // agent is the creating user
          branchId: branch.id,
          treasuryId: branch.treasuryId,
          warehouseId: branch.warehouseId,
          deliveryZoneId: zone ? zone.id : null,
          deliveryFee: zone ? deliveryFee : null,
          deliveryDriverShare: zone ? Number(zone.driverShare) : null,
          deliveryAddress: deliveryAddress || client.address || null,
          deliveryStatus: "PENDING",
          subtotal,
          discountType: discType,
          discountValue: discValue,
          discountAmount: discAmount || null,
          discountReason: discReason,
          discountAppliedByUserId: discAppliedBy,
          taxRate: 0,
          taxAmount: 0,
          total,
          paymentMethod: "CASH",
          paidAmount: 0,
          changeAmount: 0,
          status: "COMPLETED",
          notes: notes || null,
          items: { create: saleItems },
        },
        include: { items: true, client: true },
      });

      // 2. Stock deduction (Q12-A) — mirrors POS behavior at the branch's warehouse.
      // Single conditional write: decrement ONLY if current quantity is still
      // sufficient. Two concurrent agents claiming the last unit will see one
      // succeed and one get OUT_OF_STOCK, instead of the classic read-then-write
      // race where both "pass" the check and oversell (C3).
      for (const si of saleItems) {
        const res = await tx.inventory.updateMany({
          where: {
            itemId: si.itemId,
            warehouseId: branch.warehouseId,
            quantity: { gte: si.quantity },
          },
          data: { quantity: { decrement: si.quantity } },
        });
        if (res.count === 0) {
          const err = new Error(`OUT_OF_STOCK:${si.itemId}`);
          err.status = 400;
          throw err;
        }
      }

      // 3. Order row — status NEW, channel CALL_CENTER.
      const order = await createOrderInTx(tx, {
        saleId: sale.id,
        branchId: branch.id,
        createdById: req.user.id,
        channel: "CALL_CENTER",
        status: "NEW",
      });

      // 4. Notifications — broadcast to every open-shift cashier at the branch.
      await publishNewOrderNotifications(tx, { order, sale, client });

      return { sale, order };
    });

    res.status(201).json({
      orderId: result.order.id,
      saleId: result.sale.id,
      saleNumber: result.sale.saleNumber,
      status: result.order.status,
      total: Number(result.sale.total),
    });
  } catch (err) {
    if (err.message && err.message.startsWith("OUT_OF_STOCK:")) {
      const itemId = err.message.split(":")[1];
      return res.status(400).json({ error: "OUT_OF_STOCK", itemId });
    }
    next(err);
  }
};

// -------------------------------------------------------------------------
// GET /api/call-center/orders — list company-wide call-center orders (D13)
// query: status?, branchId?, page?, limit?
// -------------------------------------------------------------------------
exports.listOrders = async (req, res, next) => {
  try {
    const { status, branchId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));

    const where = { channel: "CALL_CENTER" };
    if (status) where.status = status;
    if (branchId) where.branchId = parseInt(branchId);

    const [orders, totalRows] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          claimedBy: { select: { id: true, name: true } },
          cancelledBy: { select: { id: true, name: true } },
          sale: {
            include: {
              client: { select: { id: true, name: true, phoneNumber: true } },
              items: true,
              deliveryZone: { select: { id: true, name: true, fee: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders,
      pagination: { page, limit, total: totalRows, pages: Math.ceil(totalRows / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------------------
// POST /api/call-center/orders/:id/cancel — cancel while status = NEW (Q11-D)
// -------------------------------------------------------------------------
const CANCELLATION_REASONS = [
  "CUSTOMER_REQUEST",
  "OUT_OF_STOCK",
  "WRONG_ADDRESS",
  "NO_ANSWER",
  "DUPLICATE",
  "OTHER",
];

exports.cancelOrder = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const reason = req.body?.reason ? String(req.body.reason).toUpperCase() : null;
    const note = req.body?.note ? String(req.body.note).trim() : null;

    if (!reason || !CANCELLATION_REASONS.includes(reason)) {
      return res.status(400).json({
        error: "Invalid cancellation reason",
        validReasons: CANCELLATION_REASONS,
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { sale: { include: { items: true } } },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.channel !== "CALL_CENTER") {
      return res.status(400).json({ error: "Not a call-center order" });
    }
    if (order.status !== "NEW") {
      return res.status(400).json({
        error: "Only NEW orders can be cancelled",
        currentStatus: order.status,
      });
    }

    // Write scope: agent must have access to the branch.
    const { isGlobal, ids } = await getAgentAccessibleBranchIds(req.user.id);
    if (!isGlobal && !ids.includes(order.branchId)) {
      return res.status(403).json({ error: "Branch not accessible" });
    }

    await prisma.$transaction(async (tx) => {
      // Reverse stock.
      const warehouseId = order.sale.warehouseId;
      for (const it of order.sale.items) {
        if (!it.itemId) continue;
        await tx.inventory.upsert({
          where: { itemId_warehouseId: { itemId: it.itemId, warehouseId } },
          update: { quantity: { increment: Number(it.quantity) } },
          create: { itemId: it.itemId, warehouseId, quantity: Number(it.quantity) },
        });
      }

      // Mark Order + Sale cancelled.
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: req.user.id,
          cancellationReason: reason,
          cancellationNote: note,
          cancelReason: note || reason,
        },
      });
      await tx.sale.update({
        where: { id: order.saleId },
        data: { status: "CANCELLED" },
      });

      // Dismiss pending notifications for this order.
      await tx.notification.updateMany({
        where: {
          type: "NEW_CALL_CENTER_ORDER",
          readAt: null,
          // Match the payload.orderId
          // Prisma JSON filter (MySQL):
          payload: { path: "$.orderId", equals: orderId },
        },
        data: { readAt: new Date() },
      });
    });

    res.json({ orderId, status: "CANCELLED" });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------------------
// PATCH /api/call-center/orders/:id/status — advance order through lifecycle
// body: { status: 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' }
//
// Each transition is a single conditional UPDATE (affectedRows check) so two
// cashiers racing to claim the same NEW order get one 200 and one 409.
// Caller must hold an open shift at the order's branch (D9 authz rule).
// -------------------------------------------------------------------------
const VALID_TRANSITIONS = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status: requestedStatus } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, branchId: true, channel: true, saleId: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.channel !== "CALL_CENTER") {
      return res.status(400).json({ error: "Not a call-center order" });
    }

    const allowedNext = VALID_TRANSITIONS[order.status];
    if (!allowedNext || requestedStatus !== allowedNext) {
      return res.status(400).json({
        error: "INVALID_TRANSITION",
        from: order.status,
        allowed: allowedNext || null,
      });
    }

    // Authz: caller must have an open shift at this branch (D9).
    const openShift = await prisma.shift.findFirst({
      where: { userId: req.user.id, branchId: order.branchId, status: "OPEN" },
      select: { id: true },
    });
    if (!openShift) {
      return res.status(403).json({
        error: "SHIFT_REQUIRED",
        message: "You must have an open shift at this branch to update order status",
      });
    }

    const now = new Date();
    const updateData = { status: requestedStatus };
    if (requestedStatus === "PREPARING") {
      updateData.claimedById = req.user.id;
      updateData.claimedAt = now;
    } else if (requestedStatus === "READY") {
      updateData.readyAt = now;
    } else if (requestedStatus === "OUT_FOR_DELIVERY") {
      updateData.dispatchedAt = now;
    } else if (requestedStatus === "DELIVERED") {
      updateData.deliveredAt = now;
    }

    // Atomic claim: only updates if status still matches the expected FROM state.
    const result = await prisma.order.updateMany({
      where: { id: orderId, status: order.status },
      data: updateData,
    });

    if (result.count === 0) {
      return res.status(409).json({
        error: "ALREADY_CLAIMED",
        message: "Order status was changed by another user",
      });
    }

    // Broadcast the change to all open-shift cashiers + the creator (fire-and-forget).
    prisma.order
      .findUnique({
        where: { id: orderId },
        include: { sale: { select: { id: true, saleNumber: true } } },
      })
      .then((updated) =>
        broadcastStatusChange(prisma, { order: updated, sale: updated.sale })
      )
      .catch((err) =>
        console.error("[CC] broadcastStatusChange failed:", err.message)
      );

    res.json({ orderId, status: requestedStatus });
  } catch (err) {
    next(err);
  }
};
