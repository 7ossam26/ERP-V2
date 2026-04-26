// controllers/bulk/bulkPayment.controller.js
// All payment writes delegate to bulkPayments.service.js (single write-path).
const prisma = require("../../config/database");
const { createPayment, voidPayment } = require("../../services/bulkPayments.service");

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
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

    const payment = await createPayment(
      prisma,
      orderId,
      { method, amount, treasuryId, bankReference: body.bankReference,
        chequeNumber: body.chequeNumber, chequeDueDate: body.chequeDueDate, notes: body.notes },
      req.user.id,
      { ipAddress: clientIp(req) },
    );

    res.status(201).json(payment);
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

    const result = await voidPayment(prisma, paymentId, reason, req.user.id, {
      ipAddress: clientIp(req),
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
