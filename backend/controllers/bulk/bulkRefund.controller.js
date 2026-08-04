// controllers/bulk/bulkRefund.controller.js
const prisma = require("../../config/database");
const { allocateNumber } = require("../../services/bulkNumbering.service");
const { applyBulkOrderStockMovement } = require("../../services/bulkStock.service");
const { writeAudit } = require("../../utils/auditLogger");
const { verifyManagerApproval } = require("../../middleware/auth");

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

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

    // Authorisation is the route's job now — see routes/bulk/orders.js. The
    // caller already holds SALES_RETURNS or they would not have got here, so
    // re-typing a manager's password added a step without adding a check.
    const approver = req.user;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.bulkOrder.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          customer: true,
          payments: { select: { amount: true, voidedAt: true } },
          refunds: { select: { amount: true, method: true } },
        },
      });
      if (!order) {
        const err = new Error("Order not found"); err.status = 404; throw err;
      }
      if (!["CONFIRMED", "PARTIALLY_PAID", "PAID"].includes(order.status)) {
        const err = new Error(`Cannot return order in status ${order.status}`);
        err.status = 409; throw err;
      }

      // A CASH refund hands money back, so it cannot exceed the money still
      // held against this order.
      //
      // Without this, voiding a payment and then returning the order takes the
      // same amount out of the treasury TWICE — the void reverses the credit and
      // the refund pays it out again — while the stock comes back only once,
      // because voidPayment does not touch inventory. BULK-0025 (حراز, 03/08/2026)
      // is the case: 11,800 in at 13:10, voided at 21:38, refunded at 21:41, and
      // خزينة الإدارة ended 11,800 short on a customer who never took cash back.
      //
      // Deliberately not applied to CREDIT_NOTE: crediting a customer for goods
      // they returned is legitimate whether or not they had paid yet, and it
      // moves no cash.
      if (method === "CASH_REFUND") {
        const livePaid = order.payments
          .filter((p) => !p.voidedAt)
          .reduce((s, p) => s + Number(p.amount), 0);
        const alreadyRefunded = order.refunds
          .filter((r) => r.method === "CASH_REFUND")
          .reduce((s, r) => s + Number(r.amount), 0);
        const refundable = Math.round((livePaid - alreadyRefunded) * 100) / 100;

        if (amount > refundable + 0.005) {
          const err = new Error(
            `Cash refund (${amount}) exceeds refundable amount (${refundable})`,
          );
          err.status = 400;
          err.data = {
            error: "REFUND_EXCEEDS_PAID",
            requested: amount,
            refundable,
            livePaid,
            alreadyRefunded,
          };
          err.message =
            refundable <= 0
              ? "لا يوجد مبلغ مدفوع قابل للاسترداد على هذا الطلب. لو الدفعة اتلغت بالفعل فالفلوس رجعت، اختر «إشعار دائن» أو ارجع البضاعة بدون استرداد نقدي."
              : `المبلغ المسترد (${amount}) أكبر من المدفوع فعليًا على الطلب (${refundable}).`;
          throw err;
        }
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

      let treasuryBefore = null;
      let treasuryAfter  = null;
      if (method === "CASH_REFUND" && treasuryId) {
        treasuryBefore = await tx.treasury.findUnique({
          where: { id: treasuryId },
          select: { id: true, name: true, balance: true },
        });
        treasuryAfter = await tx.treasury.update({
          where: { id: treasuryId },
          data: { balance: { decrement: amount } },
          select: { id: true, name: true, balance: true },
        });
      }

      const refund = await tx.bulkRefund.create({
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

      const orderBefore = {
        id: order.id,
        status: order.status,
        balanceDue: Number(order.balanceDue || 0),
      };

      const updated = await tx.bulkOrder.update({
        where: { id: orderId },
        data: { status: "RETURNED", returnedAt: new Date(), balanceDue: 0 },
        include: orderInclude,
      });

      return { updated, refund, treasuryBefore, treasuryAfter, orderBefore, creditNoteNumber };
    });

    // ─── post-commit audit + log ───
    const ip = clientIp(req);
    const actorId = req.user?.id ?? null;
    const branchId = req.user?.branch?.id ?? req.user?.branchId ?? null;

    console.log(
      `[bulk-order] return #${result.updated.orderNumber} ` +
      `by user=${actorId} (${approver.username || "?"}) ` +
      `method=${method} amount=${amount} ` +
      `status=${result.orderBefore.status}→RETURNED`,
    );

    writeAudit({
      action: "RETURN",
      targetEntity: "bulk_order",
      targetId: result.updated.id,
      userId: actorId,
      branchId,
      oldValues: result.orderBefore,
      newValues: {
        status: "RETURNED",
        returnMethod: method,
        amount,
        creditNoteNumber: result.creditNoteNumber,
        refundId: result.refund.id,
        treasuryId,
        // The person who executed it. There is no longer a separate approver —
        // holding SALES_RETURNS IS the approval, checked at the route.
        executedByUserId: approver.id,
        executedByUsername: approver.username,
      },
      ipAddress: ip,
    }).catch(() => {});

    writeAudit({
      action: "CREATE",
      targetEntity: "bulk_refund",
      targetId: result.refund.id,
      userId: actorId,
      branchId,
      oldValues: null,
      newValues: {
        orderId: result.refund.orderId,
        method: result.refund.method,
        amount: Number(result.refund.amount),
        treasuryId: result.refund.treasuryId,
        creditNoteNumber: result.refund.creditNoteNumber,
        reason: result.refund.reason,
      },
      ipAddress: ip,
    }).catch(() => {});

    if (result.treasuryAfter) {
      console.log(
        `[treasury] debit treasury=${result.treasuryAfter.id} (${result.treasuryAfter.name}) ` +
        `-${amount} (refund bulk-order #${result.updated.orderNumber}) ` +
        `${Number(result.treasuryBefore.balance)}→${Number(result.treasuryAfter.balance)}`,
      );
      writeAudit({
        action: "UPDATE",
        targetEntity: "treasury",
        targetId: result.treasuryAfter.id,
        userId: actorId,
        branchId,
        oldValues: { balance: Number(result.treasuryBefore.balance) },
        newValues: {
          balance: Number(result.treasuryAfter.balance),
          delta: -amount,
          reason: "bulk_order_refund",
          orderId: result.updated.id,
          orderNumber: result.updated.orderNumber,
          refundId: result.refund.id,
          method,
        },
        ipAddress: ip,
      }).catch(() => {});
    }

    res.json(result.updated);
  } catch (err) {
    next(err);
  }
};
