// services/bulkCredit.service.js
// AR open-balance computation and credit-limit enforcement for Bulk POS.
// All money is tax-inclusive EGP.

/**
 * Compute open AR balance for a customer inside a Prisma transaction.
 * open = sum(active order totals) - sum(non-voided payments)
 *
 * @param {object} tx Prisma transaction client
 * @param {number} customerId
 * @param {number|null} excludeOrderId  exclude this order (used when re-confirming)
 * @returns {Promise<number>}
 */
async function getOpenBalanceTx(tx, customerId, excludeOrderId = null) {
  const orderWhere = {
    customerId,
    status: { notIn: ["CANCELLED", "RETURNED"] },
  };
  if (excludeOrderId != null) orderWhere.id = { not: excludeOrderId };

  const [orders, payments] = await Promise.all([
    tx.bulkOrder.findMany({ where: orderWhere, select: { total: true } }),
    tx.bulkPayment.findMany({
      where: { customerId, voidedAt: null },
      select: { amount: true },
    }),
  ]);

  const ordersSum = orders.reduce((s, o) => s + Number(o.total), 0);
  const paymentsSum = payments.reduce((s, p) => s + Number(p.amount), 0);
  return ordersSum - paymentsSum;
}

/**
 * Compute open AR balance without a transaction (for UI display).
 * Requires a prisma client passed in.
 */
async function getOpenBalance(prisma, customerId) {
  const [orders, payments] = await Promise.all([
    prisma.bulkOrder.findMany({
      where: { customerId, status: { notIn: ["CANCELLED", "RETURNED"] } },
      select: { total: true },
    }),
    prisma.bulkPayment.findMany({
      where: { customerId, voidedAt: null },
      select: { amount: true },
    }),
  ]);
  const ordersSum = orders.reduce((s, o) => s + Number(o.total), 0);
  const paymentsSum = payments.reduce((s, p) => s + Number(p.amount), 0);
  return ordersSum - paymentsSum;
}

/**
 * Throw 409 CREDIT_LIMIT_EXCEEDED if adding projectedOrderTotal would breach the
 * customer's credit limit. No-op when creditLimit is null (unlimited).
 *
 * Caller responsibility: always pass the FULL order total as projectedOrderTotal,
 * regardless of how much has already been paid. At confirm time we don't yet know
 * the final payment split, so we assume the worst case (full amount added to AR).
 * Subsequent payment recordings reduce the live balance, but this gate must be
 * conservative at the moment of confirm.
 *
 * @param {object} tx Prisma transaction client
 * @param {{ id: number, creditLimit: any }} customer
 * @param {number} projectedOrderTotal  full order total (tax-inclusive, worst case)
 * @param {number|null} excludeOrderId  exclude this order id from AR sum (re-confirm)
 */
async function assertCreditLimitOk(tx, customer, projectedOrderTotal, excludeOrderId = null) {
  if (customer.creditLimit == null) return;
  const limit = Number(customer.creditLimit);
  const open = await getOpenBalanceTx(tx, customer.id, excludeOrderId);
  if (open + projectedOrderTotal > limit) {
    const err = new Error("CREDIT_LIMIT_EXCEEDED");
    err.status = 409;
    err.data = { error: "CREDIT_LIMIT_EXCEEDED", open, limit, projected: projectedOrderTotal };
    throw err;
  }
}

module.exports = { getOpenBalance, getOpenBalanceTx, assertCreditLimitOk };
