// controllers/bulk/bulkRefund.controller.js
const prisma = require("../../config/database");
const { applyBulkOrderStockMovement } = require("../../services/bulkStock.service");
const { writeAudit } = require("../../utils/auditLogger");

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

    // إشعار دائن is gone. It was a second way to return an order that moved no
    // cash, and in the life of the system it was used exactly once — by the
    // script that corrected BULK-0025. Nobody on the floor ever chose it, so it
    // sat on the screen as a wrong answer waiting to be clicked next to the
    // right one. A return is one thing now: the goods go back to the warehouse
    // they left, and the cash the customer paid goes back to them.
    const method = "CASH_REFUND";
    if (body.method && body.method !== "CASH_REFUND") {
      return res.status(400).json({
        error: "METHOD_NOT_SUPPORTED",
        message: "الإرجاع بقى استرداد نقدي فقط — إشعار الدائن اتلغى.",
      });
    }

    // NOTE: body.amount is deliberately ignored. The refund is always the whole
    // refundable balance, computed below from the order's own rows. See the
    // comment at the computation for why a partial figure was never coherent.
    const treasuryId = parseInt(body.treasuryId, 10);
    if (!Number.isInteger(treasuryId) || treasuryId <= 0) {
      return res.status(400).json({ error: "treasuryId is required" });
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

      // THE AMOUNT IS NOT AN INPUT.
      //
      // A return sends back every line of the order at its full quantity —
      // applyBulkOrderStockMovement has no partial mode — and closes the order at
      // balanceDue 0. A hand-typed amount could never be consistent with that:
      // type less than was paid and the customer is silently short-changed while
      // the books say the order is settled; type more and the treasury pays out
      // money it never took in. There is exactly one correct figure, so the
      // server computes it and the client only displays it.
      //
      // That figure is the money still held against this order. A VOIDED payment
      // has already been reversed on the treasury, so it does not count. Without
      // that exclusion, voiding a payment and then returning the order takes the
      // same amount out TWICE — the void reverses the credit and the refund pays
      // it out again — while the stock comes back once, because voidPayment does
      // not touch inventory. BULK-0025 (حراز, 03/08/2026) is the case: 11,800 in
      // at 13:10, voided at 21:38, refunded at 21:41, and خزينة الإدارة ended
      // 11,800 short on a customer who never took cash back.
      const livePaid = order.payments
        .filter((p) => !p.voidedAt)
        .reduce((s, p) => s + Number(p.amount), 0);
      const alreadyRefunded = order.refunds
        .filter((r) => r.method === "CASH_REFUND")
        .reduce((s, r) => s + Number(r.amount), 0);
      const amount = Math.round((livePaid - alreadyRefunded) * 100) / 100;

      // Nothing left to hand back. With إشعار دائن gone this is also what makes
      // an unpaid credit order un-returnable — a deliberate consequence of the
      // removal, not an oversight.
      if (amount <= 0) {
        const err = new Error(`Nothing refundable on order ${orderId}`);
        err.status = 400;
        err.data = { error: "NOTHING_REFUNDABLE", livePaid, alreadyRefunded };
        err.message =
          "لا يوجد مبلغ مدفوع قابل للاسترداد على هذا الطلب، فمفيش فلوس ترجع للعميل. لو الدفعة اتلغت بالفعل فالفلوس رجعت خلاص.";
        throw err;
      }

      // The goods go back to the warehouse they left — applyBulkOrderStockMovement
      // reads order.warehouseId, so it is always the shipping warehouse and never
      // a warehouse the operator picked at return time.
      await applyBulkOrderStockMovement(tx, order, "CREDIT");

      const treasuryBefore = await tx.treasury.findUnique({
        where: { id: treasuryId },
        select: { id: true, name: true, balance: true },
      });
      const treasuryAfter = await tx.treasury.update({
        where: { id: treasuryId },
        data: { balance: { decrement: amount } },
        select: { id: true, name: true, balance: true },
      });

      const refund = await tx.bulkRefund.create({
        data: {
          orderId,
          method,
          amount,
          reason: (body.reason || "").trim() || null,
          treasuryId,
          creditNoteNumber: null,
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

      return { updated, refund, treasuryBefore, treasuryAfter, orderBefore, amount };
    });

    // ─── post-commit audit + log ───
    const ip = clientIp(req);
    const actorId = req.user?.id ?? null;
    const branchId = req.user?.branch?.id ?? req.user?.branchId ?? null;
    // Computed inside the transaction from the order's own rows, never from the
    // request body.
    const amount = result.amount;

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
