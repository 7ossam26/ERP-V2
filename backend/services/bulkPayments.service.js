// services/bulkPayments.service.js
// Single write-path for all BulkPayment mutations (create, void).
// Every code path that writes a BulkPayment row MUST go through this service
// so that BulkOrder.paidAmount and balanceDue stay in sync. A nightly
// reconciliation job (scripts/reconcile-bulk-payments.js) asserts consistency
// as a safety net.

const CASH_METHODS = new Set(["CASH", "BANK_TRANSFER", "CHEQUE"]);

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Recompute BulkOrder.paidAmount and balanceDue from the current set of
 * non-voided payments and write the result. Returns the updated order fields.
 * Must run inside a Prisma transaction.
 *
 * @param {object} tx  Prisma transaction client
 * @param {number} orderId
 * @returns {Promise<{ paidAmount: number, balanceDue: number, status: string }>}
 */
async function recomputeOrderBalance(tx, orderId) {
  const order = await tx.bulkOrder.findUnique({
    where: { id: orderId },
    select: { id: true, total: true, paidAt: true },
  });
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

  const payments = await tx.bulkPayment.findMany({
    where: { orderId, voidedAt: null },
    select: { amount: true },
  });

  const paidAmount = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
  const balanceDue = round2(Number(order.total) - paidAmount);

  let status;
  if (balanceDue >= Number(order.total) - 0.005) status = "CONFIRMED";
  else if (balanceDue <= 0) status = "PAID";
  else status = "PARTIALLY_PAID";

  await tx.bulkOrder.update({
    where: { id: orderId },
    data: {
      paidAmount,
      balanceDue,
      status,
      paidAt: balanceDue <= 0 ? (order.paidAt || new Date()) : null,
    },
  });

  return { paidAmount, balanceDue, status };
}

/**
 * Record a payment against an order. Updates treasury balance and recomputes
 * order totals inside a single transaction.
 *
 * @param {object} prisma  Prisma client
 * @param {number} orderId
 * @param {{ method, amount, treasuryId?, bankReference?, chequeNumber?,
 *           chequeDueDate?, notes? }} data
 * @param {number} actorUserId
 * @returns {Promise<object>} created BulkPayment row (with includes)
 */
async function createPayment(prisma, orderId, data, actorUserId) {
  const { method, amount, treasuryId, bankReference, chequeNumber, chequeDueDate, notes } = data;

  return prisma.$transaction(async (tx) => {
    const order = await tx.bulkOrder.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, status: true, total: true, balanceDue: true },
    });
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

    if (["CANCELLED", "RETURNED"].includes(order.status)) {
      throw Object.assign(
        new Error(`Cannot record payment on a ${order.status} order`),
        { status: 409 },
      );
    }
    if (order.status === "DRAFT" || order.status === "QUOTED") {
      throw Object.assign(
        new Error("Confirm the order before recording a payment"),
        { status: 409 },
      );
    }

    const balanceDue = round2(Number(order.balanceDue));
    if (amount <= 0) {
      throw Object.assign(new Error("amount must be greater than zero"), { status: 400 });
    }
    if (amount > balanceDue + 0.005) {
      throw Object.assign(
        new Error(`Payment (${amount}) exceeds balance due (${balanceDue})`),
        { status: 400 },
      );
    }

    const payment = await tx.bulkPayment.create({
      data: {
        orderId,
        customerId: order.customerId,
        treasuryId: treasuryId || null,
        method,
        amount,
        createdByUserId: actorUserId,
        bankReference: bankReference || null,
        chequeNumber: chequeNumber || null,
        chequeDueDate: chequeDueDate ? new Date(chequeDueDate) : null,
        notes: notes || null,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        treasury: { select: { id: true, name: true } },
      },
    });

    if (CASH_METHODS.has(method) && treasuryId) {
      await tx.treasury.update({
        where: { id: treasuryId },
        data: { balance: { increment: amount } },
      });
    }

    await recomputeOrderBalance(tx, orderId);
    return payment;
  });
}

/**
 * Void a payment. Reverses treasury balance and recomputes order totals.
 *
 * @param {object} prisma  Prisma client
 * @param {number} paymentId
 * @param {string} reason
 * @param {number} actorUserId
 * @returns {Promise<{ payment: object, orderBalance: object }>}
 */
async function voidPayment(prisma, paymentId, reason, actorUserId) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.bulkPayment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { id: true, total: true, paidAt: true } } },
    });
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
    if (payment.voidedAt) {
      throw Object.assign(new Error("Payment already voided"), { status: 409 });
    }

    await tx.bulkPayment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedByUserId: actorUserId, voidReason: reason },
    });

    if (CASH_METHODS.has(payment.method) && payment.treasuryId) {
      await tx.treasury.update({
        where: { id: payment.treasuryId },
        data: { balance: { decrement: Number(payment.amount) } },
      });
    }

    const orderBalance = await recomputeOrderBalance(tx, payment.orderId);
    return { payment: { ...payment, voidedAt: new Date(), voidReason: reason }, orderBalance };
  });
}

module.exports = { createPayment, voidPayment, recomputeOrderBalance };
