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
      select: { id: true, orderId: true, customerId: true, method: true, amount: true,
                treasuryId: true, voidedAt: true, voidReason: true },
    });
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
    if (payment.voidedAt) {
      throw Object.assign(new Error("Payment already voided"), { status: 409 });
    }
    if (payment.orderId == null) {
      throw Object.assign(
        new Error("Old-debt entries cannot be voided — use the delete endpoint instead"),
        { status: 400 },
      );
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

/**
 * Record a general customer payment distributed across oldest unpaid orders.
 * Creates one BulkPayment row per order touched. Updates treasury once.
 *
 * @param {object} prisma  Prisma client
 * @param {number} customerId
 * @param {{ amount, treasuryId, notes? }} data
 * @param {number} actorUserId
 * @returns {Promise<object[]>} created BulkPayment rows
 */
async function createCustomerPayment(prisma, customerId, data, actorUserId) {
  const { amount, treasuryId, notes } = data;
  if (!amount || Number(amount) <= 0) {
    throw Object.assign(new Error("amount must be a positive number"), { status: 400 });
  }
  if (!treasuryId) {
    throw Object.assign(new Error("treasuryId is required"), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.bulkCustomer.findUnique({ where: { id: customerId } });
    if (!customer) throw Object.assign(new Error("Customer not found"), { status: 404 });

    const treasury = await tx.treasury.findUnique({ where: { id: parseInt(treasuryId, 10) } });
    if (!treasury) throw Object.assign(new Error("Treasury not found"), { status: 404 });

    // Customer is paying us — add amount to treasury
    await tx.treasury.update({
      where: { id: parseInt(treasuryId, 10) },
      data: { balance: { increment: Number(amount) } },
    });

    // Distribute across oldest unpaid / partially-paid orders
    const unpaidOrders = await tx.bulkOrder.findMany({
      where: {
        customerId,
        status: { in: ["CONFIRMED", "PARTIALLY_PAID"] },
      },
      orderBy: { createdAt: "asc" },
    });

    let remaining = round2(Number(amount));
    const payments = [];

    for (const order of unpaidOrders) {
      if (remaining <= 0) break;
      const due = round2(Number(order.balanceDue));
      if (due <= 0) continue;
      const apply = round2(Math.min(remaining, due));

      const payment = await tx.bulkPayment.create({
        data: {
          orderId: order.id,
          customerId,
          treasuryId: parseInt(treasuryId, 10),
          method: "CASH",
          amount: apply,
          createdByUserId: actorUserId,
          notes: notes || null,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          treasury: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      await recomputeOrderBalance(tx, order.id);
      payments.push(payment);
      remaining = round2(remaining - apply);
    }

    // If no orders to apply against, create a floating payment (orderId = null)
    if (payments.length === 0) {
      const payment = await tx.bulkPayment.create({
        data: {
          orderId: null,
          customerId,
          treasuryId: parseInt(treasuryId, 10),
          method: "CASH",
          amount: round2(Number(amount)),
          createdByUserId: actorUserId,
          notes: notes || null,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          treasury: { select: { id: true, name: true } },
        },
      });
      payments.push(payment);
    }

    return payments;
  });
}

/**
 * Record an old/pre-existing debt for a customer (no linked order, no treasury touch).
 * Stored as a BulkPayment with negative amount and orderId = null.
 *
 * @param {object} prisma  Prisma client
 * @param {number} customerId
 * @param {{ amount, notes?, date? }} data
 * @param {number} actorUserId
 * @returns {Promise<object>} created BulkPayment row
 */
async function createOldDebtPayment(prisma, customerId, data, actorUserId) {
  const { amount, notes, date } = data;
  if (!amount || Number(amount) <= 0) {
    throw Object.assign(new Error("amount must be a positive number"), { status: 400 });
  }

  const customer = await prisma.bulkCustomer.findUnique({ where: { id: customerId } });
  if (!customer) throw Object.assign(new Error("Customer not found"), { status: 404 });

  return prisma.bulkPayment.create({
    data: {
      orderId: null,
      customerId,
      treasuryId: null,
      method: "CREDIT",
      amount: -Math.abs(Number(amount)), // negative = debt added
      receivedAt: date ? new Date(date) : new Date(),
      createdByUserId: actorUserId,
      notes: `[رصيد أولي] ${notes || ""}`.trim(),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Delete an old-debt payment (negative-amount, orderId=null).
 * Validates ownership and type before removing.
 */
async function deleteOldDebtPayment(prisma, customerId, paymentId) {
  const payment = await prisma.bulkPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
  if (payment.customerId !== customerId) {
    throw Object.assign(new Error("Payment does not belong to this customer"), { status: 403 });
  }
  if (payment.orderId !== null || Number(payment.amount) >= 0) {
    throw Object.assign(new Error("Only old-debt entries can be deleted this way"), { status: 400 });
  }

  await prisma.bulkPayment.delete({ where: { id: paymentId } });
}

module.exports = { createPayment, voidPayment, recomputeOrderBalance, createCustomerPayment, createOldDebtPayment, deleteOldDebtPayment };
