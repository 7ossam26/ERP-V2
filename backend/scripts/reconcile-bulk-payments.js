#!/usr/bin/env node
// scripts/reconcile-bulk-payments.js
//
// Nightly reconciliation job: asserts that BulkOrder.paidAmount equals
// SUM(non-voided BulkPayments) for every active order. Logs any drift.
//
// Run: node backend/scripts/reconcile-bulk-payments.js [--fix]
//
// --fix   : automatically correct drifted orders (default: audit-only)
// --dry   : print what would change without writing (same as omitting --fix)

const prisma = require("../config/database");

const FIX_MODE = process.argv.includes("--fix");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function run() {
  console.log(`[reconcile] starting — mode: ${FIX_MODE ? "FIX" : "AUDIT-ONLY"}`);

  const orders = await prisma.bulkOrder.findMany({
    where: { status: { notIn: ["CANCELLED", "RETURNED"] } },
    select: { id: true, orderNumber: true, total: true, paidAmount: true, balanceDue: true, status: true },
  });

  const payments = await prisma.bulkPayment.groupBy({
    by: ["orderId"],
    where: { voidedAt: null },
    _sum: { amount: true },
  });

  const paymentMap = new Map(payments.map((p) => [p.orderId, round2(Number(p._sum.amount || 0))]));

  let drifted = 0;
  const updates = [];

  for (const o of orders) {
    const expectedPaid = paymentMap.get(o.id) ?? 0;
    const expectedBalance = round2(Number(o.total) - expectedPaid);
    const storedPaid = round2(Number(o.paidAmount));
    const storedBalance = round2(Number(o.balanceDue));

    if (Math.abs(storedPaid - expectedPaid) > 0.005 || Math.abs(storedBalance - expectedBalance) > 0.005) {
      drifted++;
      console.warn(
        `[DRIFT] order ${o.orderNumber || o.id}: ` +
          `paidAmount ${storedPaid} → ${expectedPaid}, ` +
          `balanceDue ${storedBalance} → ${expectedBalance}`,
      );
      updates.push({ id: o.id, paidAmount: expectedPaid, balanceDue: expectedBalance });
    }
  }

  if (drifted === 0) {
    console.log(`[reconcile] all ${orders.length} orders are consistent`);
  } else {
    console.warn(`[reconcile] found ${drifted} drifted order(s)`);
    if (FIX_MODE) {
      for (const u of updates) {
        const newStatus =
          u.balanceDue <= 0 ? "PAID" : u.balanceDue >= Number(orders.find((o) => o.id === u.id)?.total ?? 0) - 0.005 ? "CONFIRMED" : "PARTIALLY_PAID";
        await prisma.bulkOrder.update({
          where: { id: u.id },
          data: { paidAmount: u.paidAmount, balanceDue: u.balanceDue, status: newStatus },
        });
        console.log(`[reconcile] fixed order ${u.id}`);
      }
    } else {
      console.log("[reconcile] run with --fix to correct drift");
    }
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("[reconcile] fatal error:", err.message);
  process.exit(1);
});
