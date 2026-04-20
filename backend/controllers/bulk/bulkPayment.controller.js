// controllers/bulk/bulkPayment.controller.js
const prisma = require("../../config/database");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const CASH_METHODS = new Set(["CASH", "BANK_TRANSFER", "CHEQUE"]);
const VALID_METHODS = new Set(["CASH", "BANK_TRANSFER", "CHEQUE", "CREDIT"]);

const paymentInclude = {
  createdBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  treasury: { select: { id: true, name: true } },
};

// POST /api/bulk/orders/:id/payments
exports.create = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body || {};
    const method = body.method;
    if (!VALID_METHODS.has(method)) {
      return res.status(400).json({ error: "method must be one of CASH, BANK_TRANSFER, CHEQUE, CREDIT" });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const treasuryId = CASH_METHODS.has(method) ? parseInt(body.treasuryId, 10) : null;
    if (CASH_METHODS.has(method) && (!Number.isInteger(treasuryId) || treasuryId <= 0)) {
      return res.status(400).json({ error: "treasuryId is required for CASH / BANK_TRANSFER / CHEQUE" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.bulkOrder.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true, status: true, total: true, paidAmount: true, balanceDue: true, paidAt: true },
      });
      if (!order) {
        const err = new Error("Order not found"); err.status = 404; throw err;
      }
      if (["CANCELLED", "RETURNED"].includes(order.status)) {
        const err = new Error(`Cannot record payment on a ${order.status} order`); err.status = 409; throw err;
      }
      if (order.status === "DRAFT" || order.status === "QUOTED") {
        const err = new Error("Confirm the order before recording a payment"); err.status = 409; throw err;
      }

      const balanceDue = round2(Number(order.balanceDue));
      if (amount > balanceDue + 0.005) {
        const err = new Error(`Payment (${amount}) exceeds balance due (${balanceDue})`);
        err.status = 400; throw err;
      }

      const payment = await tx.bulkPayment.create({
        data: {
          orderId,
          customerId: order.customerId,
          treasuryId,
          method,
          amount,
          createdByUserId: req.user.id,
          bankReference: body.bankReference?.trim() || null,
          chequeNumber: body.chequeNumber?.trim() || null,
          chequeDueDate: body.chequeDueDate ? new Date(body.chequeDueDate) : null,
          notes: body.notes?.trim() || null,
        },
        include: paymentInclude,
      });

      if (CASH_METHODS.has(method) && treasuryId) {
        await tx.treasury.update({
          where: { id: treasuryId },
          data: { balance: { increment: amount } },
        });
      }

      const newPaidAmount = round2(Number(order.paidAmount) + amount);
      const newBalanceDue = round2(Number(order.total) - newPaidAmount);
      const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

      await tx.bulkOrder.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: Math.max(0, newBalanceDue),
          status: newStatus,
          paidAt: newBalanceDue <= 0 ? new Date() : null,
        },
      });

      return payment;
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/payments/:id/void
exports.void = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(paymentId)) return res.status(400).json({ error: "Invalid id" });
    const reason = (req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "reason is required" });

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.bulkPayment.findUnique({
        where: { id: paymentId },
        include: { order: { select: { id: true, total: true, paidAt: true } } },
      });
      if (!payment) {
        const err = new Error("Payment not found"); err.status = 404; throw err;
      }
      if (payment.voidedAt) {
        const err = new Error("Payment already voided"); err.status = 409; throw err;
      }

      await tx.bulkPayment.update({
        where: { id: paymentId },
        data: { voidedAt: new Date(), voidedByUserId: req.user.id, voidReason: reason },
      });

      if (CASH_METHODS.has(payment.method) && payment.treasuryId) {
        await tx.treasury.update({
          where: { id: payment.treasuryId },
          data: { balance: { decrement: Number(payment.amount) } },
        });
      }

      // Recompute from remaining non-voided payments
      const remaining = await tx.bulkPayment.findMany({
        where: { orderId: payment.orderId, voidedAt: null },
        select: { amount: true },
      });
      const newPaidAmount = round2(remaining.reduce((s, p) => s + Number(p.amount), 0));
      const newBalanceDue = round2(Number(payment.order.total) - newPaidAmount);
      let newStatus;
      if (newBalanceDue >= Number(payment.order.total) - 0.005) newStatus = "CONFIRMED";
      else if (newBalanceDue <= 0) newStatus = "PAID";
      else newStatus = "PARTIALLY_PAID";

      const updated = await tx.bulkOrder.update({
        where: { id: payment.orderId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
          paidAt: newBalanceDue <= 0 ? (payment.order.paidAt || new Date()) : null,
        },
      });

      return { payment: { ...payment, voidedAt: new Date(), voidReason: reason }, order: updated };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/bulk/orders/:id/payments
exports.listByOrder = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) return res.status(400).json({ error: "Invalid id" });
    const payments = await prisma.bulkPayment.findMany({
      where: { orderId },
      orderBy: { receivedAt: "asc" },
      include: paymentInclude,
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
};

// GET /api/bulk/customers/:id/payments
exports.listByCustomer = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const payments = await prisma.bulkPayment.findMany({
      where: { customerId },
      orderBy: { receivedAt: "desc" },
      include: {
        ...paymentInclude,
        order: { select: { id: true, orderNumber: true, total: true } },
      },
      take: 200,
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
};
