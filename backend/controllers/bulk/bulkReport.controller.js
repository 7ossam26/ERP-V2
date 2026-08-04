// controllers/bulk/bulkReport.controller.js
const prisma = require("../../config/database");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseDateRange(from, to) {
  const start = from ? new Date(from) : new Date(0);
  const end = to ? new Date(to) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * GET /api/bulk/reports/sales-by-customer?from=&to=&customerId=
 *
 * Returns per-customer sales totals for confirmed/paid orders in the date range.
 * Also includes a summary row and a breakdown by order status.
 */
async function salesByCustomer(req, res, next) {
  try {
    const { from, to, customerId } = req.query;
    const { start, end } = parseDateRange(from, to);

    const whereBase = {
      status: { notIn: ["CANCELLED"] },
      createdAt: { gte: start, lte: end },
    };
    if (customerId) whereBase.customerId = Number(customerId);

    // Per-customer aggregation
    const orders = await prisma.bulkOrder.findMany({
      where: whereBase,
      select: {
        id: true,
        customerId: true,
        status: true,
        total: true,
        paidAmount: true,
        balanceDue: true,
        createdAt: true,
        customer: { select: { id: true, companyName: true, tradeName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by customer
    const byCustomer = {};
    for (const o of orders) {
      const cid = o.customerId;
      if (!byCustomer[cid]) {
        byCustomer[cid] = {
          customerId: cid,
          companyName: o.customer.companyName,
          tradeName: o.customer.tradeName || null,
          orderCount: 0,
          totalSales: 0,
          totalPaid: 0,
          totalDue: 0,
        };
      }
      const row = byCustomer[cid];
      row.orderCount += 1;
      row.totalSales = round2(row.totalSales + Number(o.total));
      row.totalPaid = round2(row.totalPaid + Number(o.paidAmount));
      row.totalDue = round2(row.totalDue + Number(o.balanceDue));
    }

    // Status breakdown
    const statusBreakdown = {};
    for (const o of orders) {
      if (!statusBreakdown[o.status]) {
        statusBreakdown[o.status] = { orderCount: 0, totalSales: 0 };
      }
      statusBreakdown[o.status].orderCount += 1;
      statusBreakdown[o.status].totalSales = round2(
        statusBreakdown[o.status].totalSales + Number(o.total)
      );
    }

    const rows = Object.values(byCustomer).sort((a, b) => b.totalSales - a.totalSales);

    const summary = {
      orderCount: orders.length,
      totalSales: round2(rows.reduce((s, r) => s + r.totalSales, 0)),
      totalPaid: round2(rows.reduce((s, r) => s + r.totalPaid, 0)),
      totalDue: round2(rows.reduce((s, r) => s + r.totalDue, 0)),
    };

    res.json({ summary, byCustomer: rows, byStatus: statusBreakdown });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bulk/reports/ar-aging?asOf=
 *
 * Returns AR aging buckets (0-30, 31-60, 61-90, 90+) based on order confirmedAt.
 * Open balance per customer = sum(active order totals) - sum(non-voided payments).
 */
async function arAging(req, res, next) {
  try {
    const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
    asOf.setHours(23, 59, 59, 999);

    // All open (not fully-paid) orders that are not cancelled/returned, confirmed before asOf
    const openOrders = await prisma.bulkOrder.findMany({
      where: {
        status: { in: ["CONFIRMED", "PARTIALLY_PAID"] },
        confirmedAt: { lte: asOf },
      },
      select: {
        id: true,
        customerId: true,
        total: true,
        paidAmount: true,
        balanceDue: true,
        confirmedAt: true,
        customer: { select: { id: true, companyName: true, tradeName: true, creditLimit: true } },
      },
    });

    const msPerDay = 1000 * 60 * 60 * 24;

    // Bucket each order's balance-due by days outstanding
    const customerBuckets = {};
    for (const o of openOrders) {
      const due = Number(o.balanceDue);
      if (due <= 0) continue;

      const daysOut = Math.floor((asOf - new Date(o.confirmedAt)) / msPerDay);
      const bucket =
        daysOut <= 30 ? "b0_30" : daysOut <= 60 ? "b31_60" : daysOut <= 90 ? "b61_90" : "b90plus";

      const cid = o.customerId;
      if (!customerBuckets[cid]) {
        customerBuckets[cid] = {
          customerId: cid,
          companyName: o.customer.companyName,
          tradeName: o.customer.tradeName || null,
          creditLimit: o.customer.creditLimit != null ? Number(o.customer.creditLimit) : null,
          total: 0,
          b0_30: 0,
          b31_60: 0,
          b61_90: 0,
          b90plus: 0,
        };
      }
      const row = customerBuckets[cid];
      row[bucket] = round2(row[bucket] + due);
      row.total = round2(row.total + due);
    }

    const rows = Object.values(customerBuckets).sort((a, b) => b.total - a.total);

    const summary = {
      totalDue: round2(rows.reduce((s, r) => s + r.total, 0)),
      b0_30: round2(rows.reduce((s, r) => s + r.b0_30, 0)),
      b31_60: round2(rows.reduce((s, r) => s + r.b31_60, 0)),
      b61_90: round2(rows.reduce((s, r) => s + r.b61_90, 0)),
      b90plus: round2(rows.reduce((s, r) => s + r.b90plus, 0)),
    };

    res.json({ asOf: asOf.toISOString(), summary, rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bulk/reports/statement?customerId=&from=&to=
 *
 * Returns a chronological statement of account for one customer:
 * orders (debits) and payments (credits), running balance.
 */
async function statement(req, res, next) {
  try {
    const { customerId, from, to } = req.query;
    if (!customerId) {
      const err = new Error("customerId is required");
      err.status = 400;
      throw err;
    }
    const cid = Number(customerId);
    const { start, end } = parseDateRange(from, to);

    const [customer, orders, payments, refunds] = await Promise.all([
      prisma.bulkCustomer.findUnique({
        where: { id: cid },
        select: { id: true, companyName: true, tradeName: true, creditLimit: true },
      }),
      prisma.bulkOrder.findMany({
        where: {
          customerId: cid,
          status: { notIn: ["CANCELLED"] },
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          confirmedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bulkPayment.findMany({
        where: {
          customerId: cid,
          voidedAt: null,
          receivedAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          orderId: true,
          method: true,
          amount: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: "asc" },
      }),
      prisma.bulkRefund.findMany({
        where: {
          order: { customerId: cid },
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          orderId: true,
          method: true,
          amount: true,
          creditNoteNumber: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!customer) {
      const err = new Error("Customer not found");
      err.status = 404;
      throw err;
    }

    // Build a unified, chronologically-sorted ledger
    const entries = [];

    for (const o of orders) {
      entries.push({
        date: o.createdAt,
        type: "ORDER",
        orderId: o.id,
        ref: o.orderNumber || `#${o.id}`,
        description: `طلب ${o.orderNumber || o.id} — ${o.status}`,
        debit: round2(Number(o.total)),
        credit: 0,
      });
    }

    // An opening balance — a debt the customer already carried before the system
    // existed — is stored as a BulkPayment with orderId = null and a NEGATIVE
    // amount. That is how services/bulkPayments.service.js writes one
    // (createOldDebtPayment) and how it identifies one for deletion, so the same
    // two conditions are the test here.
    //
    // It is a DEBIT. Filing it under `credit` because it lives in the payments
    // table produced a statement that read "إجمالي المدفوع −54,600" for a
    // customer who had paid 10,260, and left the row showing "—" in both money
    // columns while the running balance still jumped 64,860 — money appearing
    // from nowhere, on the one screen that has to be believable.
    for (const p of payments) {
      if (p.orderId === null && Number(p.amount) < 0) {
        entries.push({
          date: p.receivedAt,
          type: "OPENING",
          ref: `PAY-${p.id}`,
          description: "رصيد أولي — مديونية سابقة",
          debit: round2(Math.abs(Number(p.amount))),
          credit: 0,
        });
        continue;
      }
      entries.push({
        date: p.receivedAt,
        type: "PAYMENT",
        ref: `PAY-${p.id}`,
        description: `دفعة — ${p.method}`,
        debit: 0,
        credit: round2(Number(p.amount)),
      });
    }

    for (const r of refunds) {
      entries.push({
        date: r.createdAt,
        type: "REFUND",
        ref: r.creditNoteNumber || `REF-${r.id}`,
        description: `مرتجع — ${r.method}`,
        debit: 0,
        credit: round2(Number(r.amount)),
      });
    }

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Compute running balance (positive = customer owes)
    let balance = 0;
    for (const e of entries) {
      balance = round2(balance + e.debit - e.credit);
      e.balance = balance;
    }

    // Split so every figure can be labelled honestly. `totalDebit` stays the sum
    // of the مدين column, so the table footer still adds up; the cards read
    // totalSales and totalOpening separately, because "إجمالي المبيعات" must not
    // include a debt that predates the first order. closingBalance is unchanged
    // in value — moving the opening balance from credit to debit flips its sign
    // on both sides of the subtraction.
    const totalSales = round2(
      entries.filter((e) => e.type === "ORDER").reduce((s, e) => s + e.debit, 0),
    );
    const totalOpening = round2(
      entries.filter((e) => e.type === "OPENING").reduce((s, e) => s + e.debit, 0),
    );
    const totalDebit = round2(totalSales + totalOpening);
    const totalCredit = round2(entries.reduce((s, e) => s + e.credit, 0));

    res.json({
      customer: {
        ...customer,
        creditLimit: customer.creditLimit != null ? Number(customer.creditLimit) : null,
      },
      period: { from: start.toISOString(), to: end.toISOString() },
      entries,
      summary: {
        totalSales,
        totalOpening,
        totalDebit,
        totalCredit,
        closingBalance: round2(totalDebit - totalCredit),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { salesByCustomer, arAging, statement };
