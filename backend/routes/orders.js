// routes/orders.js
// Cashier-side endpoints for the Order workflow layer.
// Drives the "Incoming Orders" tray in POS and the state machine behind each
// order's lifecycle. Every mutation publishes an ORDER_STATUS_CHANGED event
// through the EventBus so other tabs reconcile instantly.

const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requireAnyPermission } = require("../middleware/auth");
const { broadcastStatusChange } = require("../lib/orderService");

router.use(authenticateToken);

// POS permission gates cashier access; CALL_CENTER lets agents peek at their
// own orders via the same list/detail endpoints.
const cashierOrAgent = requireAnyPermission(["POS", "CALL_CENTER"]);

// -----------------------------------------------------------
// State machine
// -----------------------------------------------------------
const TRANSITIONS = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

// -----------------------------------------------------------
// GET /api/orders/queue?branchId=X
// Tray for cashiers: open orders (non-POS) that haven't shipped yet.
// -----------------------------------------------------------
router.get("/queue", cashierOrAgent, async (req, res, next) => {
  try {
    const branchId = parseInt(req.query.branchId);
    if (!branchId) {
      return res.status(400).json({ error: "branchId query param is required" });
    }

    const orders = await prisma.order.findMany({
      where: {
        branchId,
        status: { in: ["NEW", "PREPARING", "READY"] },
        channel: { not: "POS" },
      },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        claimedBy: { select: { id: true, name: true } },
        sale: {
          include: {
            client: { select: { id: true, name: true, phoneNumber: true } },
            items: true,
            deliveryZone: { select: { id: true, name: true, fee: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// GET /api/orders/:id — order detail (for print & cashier modal)
// -----------------------------------------------------------
router.get("/:id", cashierOrAgent, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        branch: true,
        createdBy: { select: { id: true, name: true } },
        claimedBy: { select: { id: true, name: true } },
        cancelledBy: { select: { id: true, name: true } },
        sale: {
          include: {
            client: true,
            items: {
              include: {
                item: { select: { id: true, name: true, unit: true } },
                bom: { select: { id: true, name: true } },
              },
            },
            deliveryZone: true,
            deliveryMan: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// PATCH /api/orders/:id/status
// body: { status, deliveryManId? }
// State machine enforcement + side effects (claim stamp, ship stamp with
// shift-attribution, paidAt on deliver).
// -----------------------------------------------------------
router.patch("/:id/status", cashierOrAgent, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const nextStatus = String(req.body?.status || "").toUpperCase();
    const deliveryManId = req.body?.deliveryManId
      ? parseInt(req.body.deliveryManId)
      : null;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { sale: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!canTransition(order.status, nextStatus)) {
      return res.status(400).json({
        error: "Invalid status transition",
        from: order.status,
        to: nextStatus,
      });
    }

    const userId = req.user.id;
    const now = new Date();
    const orderUpdates = { status: nextStatus };
    const saleUpdates = {};

    if (nextStatus === "PREPARING") {
      orderUpdates.claimedById = userId;
      orderUpdates.claimedAt = now;
    }
    if (nextStatus === "READY") {
      orderUpdates.readyAt = now;
    }
    if (nextStatus === "OUT_FOR_DELIVERY") {
      if (!deliveryManId) {
        return res
          .status(400)
          .json({ error: "deliveryManId is required to dispatch" });
      }
      // Attribute the sale to the cashier's current open shift at this branch.
      const shift = await prisma.shift.findFirst({
        where: { userId, branchId: order.branchId, status: "OPEN" },
        select: { id: true },
      });
      if (!shift) {
        return res.status(400).json({
          error: "Open a shift first",
          message: "افتح الوردية أولاً قبل إرسال الطلب",
        });
      }
      orderUpdates.dispatchedAt = now;
      saleUpdates.shiftId = shift.id;
      saleUpdates.deliveryManId = deliveryManId;
      saleUpdates.deliveryStatus = "OUT_FOR_DELIVERY";
    }
    if (nextStatus === "DELIVERED") {
      orderUpdates.deliveredAt = now;
      saleUpdates.paidAt = now;
      saleUpdates.deliveryStatus = "DELIVERED";
    }
    if (nextStatus === "CANCELLED") {
      const reason = req.body?.reason ? String(req.body.reason).toUpperCase() : null;
      const note = req.body?.note ? String(req.body.note).trim() : null;
      const VALID = [
        "CUSTOMER_REQUEST",
        "OUT_OF_STOCK",
        "WRONG_ADDRESS",
        "NO_ANSWER",
        "DUPLICATE",
        "OTHER",
      ];
      if (!reason || !VALID.includes(reason)) {
        return res.status(400).json({
          error: "Invalid cancellation reason",
          validReasons: VALID,
        });
      }
      orderUpdates.cancelledAt = now;
      orderUpdates.cancelledById = userId;
      orderUpdates.cancellationReason = reason;
      orderUpdates.cancellationNote = note;
      orderUpdates.cancelReason = note || reason;
      saleUpdates.status = "CANCELLED";
    }

    const { updatedOrder, updatedSale } = await prisma.$transaction(
      async (tx) => {
        // Re-fetch inside tx to defend against a concurrent writer racing us.
        const fresh = await tx.order.findUnique({ where: { id } });
        if (!fresh || !canTransition(fresh.status, nextStatus)) {
          const err = new Error("Status changed by another user");
          err.status = 409;
          throw err;
        }

        const updatedOrder = await tx.order.update({
          where: { id },
          data: orderUpdates,
        });

        let updatedSale = null;
        if (Object.keys(saleUpdates).length > 0) {
          updatedSale = await tx.sale.update({
            where: { id: order.saleId },
            data: saleUpdates,
            include: { deliveryZone: true },
          });
        }

        // Dispatching a CASH delivery hands cash to the rider — mirror the POS
        // sale-creation accounting (routes/sales.js): driver earns the zone
        // share, owes the rest. Without this, walletBalance never increments
        // for call-center orders so settlement pages can't see them.
        if (nextStatus === "OUT_FOR_DELIVERY" && updatedSale) {
          const method = String(updatedSale.paymentMethod || "CASH").toUpperCase();
          if (method === "CASH") {
            let driverShare = 0;
            if (updatedSale.deliveryZone?.driverShare != null) {
              driverShare = Number(updatedSale.deliveryZone.driverShare) || 0;
            }
            const total = Number(updatedSale.total) || 0;
            const netDebt = total - driverShare;

            if (driverShare > 0 && updatedSale.deliveryDriverShare == null) {
              await tx.sale.update({
                where: { id: updatedSale.id },
                data: { deliveryDriverShare: driverShare },
              });
            }

            if (netDebt > 0) {
              await tx.deliveryMan.update({
                where: { id: deliveryManId },
                data: { walletBalance: { increment: netDebt } },
              });
              await tx.deliveryManTransaction.create({
                data: {
                  deliveryManId,
                  amount: netDebt,
                  type: "DEBT_ACCRUED",
                  description: `Order #${updatedSale.saleNumber || updatedSale.id} dispatch (share ${driverShare})`,
                  createdById: userId || null,
                },
              });
            }
          }
        }

        // Dismiss pending notifications on claim/cancel so other tabs clear.
        if (nextStatus === "PREPARING" || nextStatus === "CANCELLED") {
          await tx.notification.updateMany({
            where: {
              type: "NEW_CALL_CENTER_ORDER",
              readAt: null,
              payload: { path: "$.orderId", equals: id },
            },
            data: { readAt: now },
          });
        }

        return { updatedOrder, updatedSale };
      },
    );

    // Publish the status-change event after tx commit.
    await broadcastStatusChange(prisma, {
      order: updatedOrder,
      sale: updatedSale || order.sale,
    });

    res.json({ order: updatedOrder, sale: updatedSale });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
