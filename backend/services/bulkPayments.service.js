// services/bulkPayments.service.js
// Single write-path for all BulkPayment mutations (create, void).
// Every code path that writes a BulkPayment row MUST go through this service
// so that BulkOrder.paidAmount and balanceDue stay in sync. A nightly
// reconciliation job (scripts/reconcile-bulk-payments.js) asserts consistency
// as a safety net.
//
// Every treasury-touching mutation here also writes an audit_logs row
// (via writeAudit) AFTER the transaction commits, plus a console.log line
// in the same shape used by routes/sales.js so till movements are visible
// in process logs.

const { writeAudit } = require("../utils/auditLogger");

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
async function createPayment(prisma, orderId, data, actorUserId, ctx = {}) {
  const { method, amount, treasuryId, bankReference, chequeNumber, chequeDueDate, notes } = data;
  const ipAddress = ctx.ipAddress || null;

  const result = await prisma.$transaction(async (tx) => {
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

    let treasuryBefore = null;
    let treasuryAfter  = null;
    if (CASH_METHODS.has(method) && treasuryId) {
      treasuryBefore = await tx.treasury.findUnique({
        where: { id: treasuryId },
        select: { id: true, name: true, balance: true },
      });
      treasuryAfter = await tx.treasury.update({
        where: { id: treasuryId },
        data: { balance: { increment: amount } },
        select: { id: true, name: true, balance: true },
      });
    }

    await recomputeOrderBalance(tx, orderId);
    return { payment, treasuryBefore, treasuryAfter };
  });

  // ─── post-commit audit + log ───
  console.log(
    `[bulk-payment] create id=${result.payment.id} order=${orderId} ` +
    `method=${method} amount=${amount} by user=${actorUserId}`,
  );
  writeAudit({
    action: "CREATE",
    targetEntity: "bulk_payment",
    targetId: result.payment.id,
    userId: actorUserId,
    branchId: null,
    oldValues: null,
    newValues: {
      orderId,
      customerId: result.payment.customerId,
      treasuryId: result.payment.treasuryId,
      method,
      amount: Number(amount),
      bankReference: result.payment.bankReference,
      chequeNumber: result.payment.chequeNumber,
    },
    ipAddress,
  }).catch(() => {});

  if (result.treasuryAfter) {
    console.log(
      `[treasury] credit treasury=${result.treasuryAfter.id} (${result.treasuryAfter.name}) ` +
      `+${amount} (bulk-payment #${result.payment.id}) ` +
      `${Number(result.treasuryBefore.balance)}→${Number(result.treasuryAfter.balance)}`,
    );
    writeAudit({
      action: "UPDATE",
      targetEntity: "treasury",
      targetId: result.treasuryAfter.id,
      userId: actorUserId,
      branchId: null,
      oldValues: { balance: Number(result.treasuryBefore.balance) },
      newValues: {
        balance: Number(result.treasuryAfter.balance),
        delta: Number(amount),
        reason: "bulk_payment_create",
        orderId,
        paymentId: result.payment.id,
        method,
      },
      ipAddress,
    }).catch(() => {});
  }

  return result.payment;
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
async function voidPayment(prisma, paymentId, reason, actorUserId, ctx = {}) {
  const ipAddress = ctx.ipAddress || null;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.bulkPayment.findUnique({
      where: { id: paymentId },
      select: { id: true, orderId: true, customerId: true, method: true, amount: true,
                treasuryId: true, voidedAt: true, voidReason: true },
    });
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
    if (payment.voidedAt) {
      throw Object.assign(new Error("Payment already voided"), { status: 409 });
    }
    // Old-debt entries are negative and touch no treasury; they are removed with
    // the delete endpoint, not voided. A POSITIVE row with no order is the
    // overpayment credit written by createCustomerPayment — that one did move
    // cash, so it must stay voidable or a mistyped collection would be
    // uncorrectable from the UI.
    if (payment.orderId == null && Number(payment.amount) < 0) {
      throw Object.assign(
        new Error("Old-debt entries cannot be voided — use the delete endpoint instead"),
        { status: 400 },
      );
    }

    await tx.bulkPayment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedByUserId: actorUserId, voidReason: reason },
    });

    let treasuryBefore = null;
    let treasuryAfter  = null;
    if (CASH_METHODS.has(payment.method) && payment.treasuryId) {
      treasuryBefore = await tx.treasury.findUnique({
        where: { id: payment.treasuryId },
        select: { id: true, name: true, balance: true },
      });
      treasuryAfter = await tx.treasury.update({
        where: { id: payment.treasuryId },
        data: { balance: { decrement: Number(payment.amount) } },
        select: { id: true, name: true, balance: true },
      });
    }

    // No order to recompute when the row is a floating overpayment credit.
    const orderBalance =
      payment.orderId != null ? await recomputeOrderBalance(tx, payment.orderId) : null;
    return {
      payment: { ...payment, voidedAt: new Date(), voidReason: reason },
      orderBalance,
      treasuryBefore,
      treasuryAfter,
    };
  });

  // ─── post-commit audit + log ───
  console.log(
    `[bulk-payment] void id=${paymentId} order=${result.payment.orderId} ` +
    `amount=${Number(result.payment.amount)} reason="${reason}" by user=${actorUserId}`,
  );
  writeAudit({
    action: "VOID",
    targetEntity: "bulk_payment",
    targetId: paymentId,
    userId: actorUserId,
    branchId: null,
    oldValues: { voidedAt: null, voidReason: null },
    newValues: {
      voidedAt: result.payment.voidedAt,
      voidReason: reason,
      amount: Number(result.payment.amount),
      method: result.payment.method,
      treasuryId: result.payment.treasuryId,
      orderId: result.payment.orderId,
    },
    ipAddress,
  }).catch(() => {});

  if (result.treasuryAfter) {
    console.log(
      `[treasury] debit treasury=${result.treasuryAfter.id} (${result.treasuryAfter.name}) ` +
      `-${Number(result.payment.amount)} (void bulk-payment #${paymentId}) ` +
      `${Number(result.treasuryBefore.balance)}→${Number(result.treasuryAfter.balance)}`,
    );
    writeAudit({
      action: "UPDATE",
      targetEntity: "treasury",
      targetId: result.treasuryAfter.id,
      userId: actorUserId,
      branchId: null,
      oldValues: { balance: Number(result.treasuryBefore.balance) },
      newValues: {
        balance: Number(result.treasuryAfter.balance),
        delta: -Number(result.payment.amount),
        reason: "bulk_payment_void",
        paymentId,
        orderId: result.payment.orderId,
        method: result.payment.method,
      },
      ipAddress,
    }).catch(() => {});
  }

  return { payment: result.payment, orderBalance: result.orderBalance };
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
async function createCustomerPayment(prisma, customerId, data, actorUserId, ctx = {}) {
  const { amount, treasuryId, notes } = data;
  const ipAddress = ctx.ipAddress || null;

  if (!amount || Number(amount) <= 0) {
    throw Object.assign(new Error("amount must be a positive number"), { status: 400 });
  }
  if (!treasuryId) {
    throw Object.assign(new Error("treasuryId is required"), { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.bulkCustomer.findUnique({ where: { id: customerId } });
    if (!customer) throw Object.assign(new Error("Customer not found"), { status: 404 });

    const treasuryBefore = await tx.treasury.findUnique({
      where: { id: parseInt(treasuryId, 10) },
      select: { id: true, name: true, balance: true },
    });
    if (!treasuryBefore) throw Object.assign(new Error("Treasury not found"), { status: 404 });

    // Customer is paying us — add amount to treasury
    const treasuryAfter = await tx.treasury.update({
      where: { id: parseInt(treasuryId, 10) },
      data: { balance: { increment: Number(amount) } },
      select: { id: true, name: true, balance: true },
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

    // Whatever the open orders could not absorb is still money the customer
    // handed over, so it goes on their account as a floating credit.
    //
    // This used to read `if (payments.length === 0)` — "only if we found no
    // order at all". That made the treasury and the customer's account disagree
    // every time an order absorbed PART of the payment: the treasury was
    // incremented by the full `amount` above, unconditionally, while the loop
    // only ever wrote rows worth `Math.min(remaining, due)`. On 02/08/2026 اوبس
    // paid 75,120 against one order owing 10,260; the treasury took all of it
    // and 64,860 left no record anywhere, because one payment row existed and
    // the fallback was skipped.
    //
    // The old-debt balance is the usual reason for the gap — it is stored as a
    // payment row, not an order, so the distribution loop structurally cannot
    // see it no matter how large it is.
    if (remaining > 0) {
      const payment = await tx.bulkPayment.create({
        data: {
          orderId: null,
          customerId,
          treasuryId: parseInt(treasuryId, 10),
          method: "CASH",
          amount: round2(remaining),
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

    return { payments, treasuryBefore, treasuryAfter };
  });

  // ─── post-commit audit + log ───
  console.log(
    `[bulk-payment] customer-payment customer=${customerId} ` +
    `amount=${Number(amount)} method=CASH split-into=${result.payments.length} by user=${actorUserId}`,
  );

  // One audit row per child payment so every BulkPayment has a discoverable
  // creation audit, regardless of which entry-point created it.
  for (const p of result.payments) {
    writeAudit({
      action: "CREATE",
      targetEntity: "bulk_payment",
      targetId: p.id,
      userId: actorUserId,
      branchId: null,
      oldValues: null,
      newValues: {
        orderId: p.orderId,
        customerId: p.customerId,
        treasuryId: p.treasuryId,
        method: p.method,
        amount: Number(p.amount),
        source: "customer_payment_distribution",
      },
      ipAddress,
    }).catch(() => {});
  }

  console.log(
    `[treasury] credit treasury=${result.treasuryAfter.id} (${result.treasuryAfter.name}) ` +
    `+${Number(amount)} (customer-payment customer=${customerId}) ` +
    `${Number(result.treasuryBefore.balance)}→${Number(result.treasuryAfter.balance)}`,
  );
  writeAudit({
    action: "UPDATE",
    targetEntity: "treasury",
    targetId: result.treasuryAfter.id,
    userId: actorUserId,
    branchId: null,
    oldValues: { balance: Number(result.treasuryBefore.balance) },
    newValues: {
      balance: Number(result.treasuryAfter.balance),
      delta: Number(amount),
      reason: "customer_payment",
      customerId,
      paymentIds: result.payments.map((p) => p.id),
    },
    ipAddress,
  }).catch(() => {});

  return result.payments;
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
