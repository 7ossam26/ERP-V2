// controllers/bulk/bulkRefund.controller.js
const prisma = require("../../config/database");
const { allocateNumber } = require("../../services/bulkNumbering.service");
const { applyBulkOrderStockMovement } = require("../../services/bulkStock.service");

const orderInclude = {
  customer: { select: { id: true, companyName: true, taxNumber: true, primaryContactPhone: true } },
  warehouse: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: { item: { select: { id: true, name: true, unit: true } } },
    orderBy: { id: "asc" },
  },
  documents: { orderBy: { id: "asc" } },
  payments: {
    include: { treasury: { select: { id: true, name: true } } },
    orderBy: { receivedAt: "asc" },
  },
  refunds: { orderBy: { createdAt: "asc" } },
};

// POST /api/bulk/orders/:id/return
exports.createReturn = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body || {};
    const method = body.method;
    if (!["CASH_REFUND", "CREDIT_NOTE"].includes(method)) {
      return res.status(400).json({ error: "method must be CASH_REFUND or CREDIT_NOTE" });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    const treasuryId = method === "CASH_REFUND" ? parseInt(body.treasuryId, 10) : null;
    if (method === "CASH_REFUND" && (!Number.isInteger(treasuryId) || treasuryId <= 0)) {
      return res.status(400).json({ error: "treasuryId is required for CASH_REFUND" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.bulkOrder.findUnique({
        where: { id: orderId },
        include: { items: true, customer: true },
      });
      if (!order) {
        const err = new Error("Order not found"); err.status = 404; throw err;
      }
      if (!["CONFIRMED", "PARTIALLY_PAID", "PAID"].includes(order.status)) {
        const err = new Error(`Cannot return order in status ${order.status}`);
        err.status = 409; throw err;
      }

      // Reverse stock back to warehouse
      await applyBulkOrderStockMovement(tx, order, "CREDIT");

      let creditNoteNumber = null;
      if (method === "CREDIT_NOTE") {
        creditNoteNumber = await allocateNumber(tx, "CREDIT_NOTE");
        await tx.bulkDocument.create({
          data: {
            orderId,
            type: "CREDIT_NOTE",
            documentNumber: creditNoteNumber,
            issuedByUserId: req.user.id,
            snapshot: {
              creditNoteNumber,
              method,
              amount,
              reason: body.reason || null,
              orderId,
              orderNumber: order.orderNumber,
              issuedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (method === "CASH_REFUND" && treasuryId) {
        await tx.treasury.update({
          where: { id: treasuryId },
          data: { balance: { decrement: amount } },
        });
      }

      await tx.bulkRefund.create({
        data: {
          orderId,
          method,
          amount,
          reason: (body.reason || "").trim() || null,
          treasuryId,
          creditNoteNumber,
          createdByUserId: req.user.id,
        },
      });

      const updated = await tx.bulkOrder.update({
        where: { id: orderId },
        data: { status: "RETURNED", returnedAt: new Date(), balanceDue: 0 },
        include: orderInclude,
      });

      return updated;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
