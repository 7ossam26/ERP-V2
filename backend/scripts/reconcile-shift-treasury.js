#!/usr/bin/env node
// scripts/reconcile-shift-treasury.js
//
// Audits the expected-drawer figure of every unclosed shift two ways.
//
// 1. FORMULA CHECK. An independent re-implementation of the drawer model below
//    is compared with routes/shifts.js's calculateSystemExpectedCash. Any
//    difference means one of the two misreads a movement.
//
// 2. SAFE CHECK. The branch treasury is drawer + safe in ONE account, so
//
//        safe = treasury.balance − expected drawer
//
//    A safe cannot physically hold less than nothing. A NEGATIVE safe means the
//    books think the drawer holds cash that is not in the account: a drawer
//    movement booked as a safe one (typically a transfer sent "from the safe"
//    that really left the register), or a treasury writer with no drawer term.
//
// The old invariant — treasury.balance === expected drawer — assumed the
// treasury IS the drawer. It is not (see lib/shiftTreasury.js), so it reported
// every pound sitting in the safe as drift and was dropped.
//
// AUDIT-ONLY BY DESIGN. There is deliberately no --fix: the repair for a
// difference is to model the movement correctly, not to overwrite a balance.
//
// Run: node backend/scripts/reconcile-shift-treasury.js [--all]
//
// --all   : also report shifts that pass both checks (default: problems only)

const prisma = require("../config/database");
const { calculateSystemExpectedCash } = require("../routes/shifts");

const SHOW_ALL = process.argv.includes("--all");
// Same tolerance as reconcile-bulk-payments.js — below half a piastre is noise.
const TOLERANCE = 0.005;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Expected drawer cash for one shift.
 *
 * Intentionally a SECOND implementation of calculateSystemExpectedCash rather
 * than an import of it. An audit that reuses the code it audits cannot detect a
 * bug in that code. Keep them independent and let the difference speak.
 *
 * The model: startCash + cash the cashier took in − cash the cashier paid out.
 * Safe movements (safe transfers, manual deposits/withdrawals, payroll,
 * supplier payments) are NOT drawer movements.
 */
async function expectedDrawer(shift) {
  const treasuryId = shift.branch.treasuryId;
  const window = { gte: shift.startTime, lte: shift.endTime || new Date() };

  const [
    sales,
    expenses,
    supplierExpenses,
    advances,
    dues,
    bulkIn,
    bulkVoid,
    bulkRefund,
    drawerOut,
    drawerOutLateRejected,
    drawerIn,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { shiftId: shift.id, status: "COMPLETED", isVoided: false, paymentMethod: "CASH" },
      select: { total: true, deliveryManId: true, deliveryStatus: true, deliveryDriverShare: true },
    }),
    prisma.expense.aggregate({
      where: { treasuryId, paymentMethod: "CASH", createdAt: window },
      _sum: { amount: true },
    }),
    // A supplier payment's mirror expense (PURCHASE, no purchaseId) is paid
    // from the safe by a manager, not from the register.
    prisma.expense.aggregate({
      where: { treasuryId, paymentMethod: "CASH", createdAt: window, type: "PURCHASE", purchaseId: null },
      _sum: { amount: true },
    }),
    prisma.employeeTransaction.aggregate({
      where: { shiftId: shift.id, type: "ADVANCE" },
      _sum: { amount: true },
    }),
    prisma.deliveryManTransaction.aggregate({
      where: {
        type: "DUES_PAYOUT",
        createdAt: window,
        deliveryMan: { branchId: shift.branchId },
      },
      _sum: { amount: true },
    }),
    prisma.bulkPayment.aggregate({
      where: { treasuryId, method: "CASH", amount: { gt: 0 }, receivedAt: window },
      _sum: { amount: true },
    }),
    prisma.bulkPayment.aggregate({
      where: { treasuryId, method: "CASH", amount: { gt: 0 }, voidedAt: window },
      _sum: { amount: true },
    }),
    prisma.bulkRefund.aggregate({
      where: { treasuryId, method: "CASH_REFUND", createdAt: window },
      _sum: { amount: true },
    }),
    prisma.cashTransfer.aggregate({
      where: { fromShiftId: shift.id, fromDrawer: true, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
    }),
    shift.endTime
      ? prisma.cashTransfer.aggregate({
          where: {
            fromShiftId: shift.id,
            fromDrawer: true,
            status: "REJECTED",
            resolvedAt: { gt: shift.endTime },
          },
          _sum: { amount: true },
        })
      : null,
    prisma.cashTransfer.aggregate({
      where: { toShiftId: shift.id, toDrawer: true, status: "APPROVED" },
      _sum: { amount: true },
    }),
  ]);

  // Cash reaches the drawer at sale time for walk-ins, and only at settlement
  // for delivery — and then net of the driver's share.
  let cashSales = 0;
  for (const s of sales) {
    if (!s.deliveryManId) cashSales += Number(s.total || 0);
    else if (s.deliveryStatus === "DELIVERED") {
      cashSales += Number(s.total || 0) - Number(s.deliveryDriverShare || 0);
    }
  }

  const terms = {
    startCash: Number(shift.startCash || 0),
    cashSales,
    cashExpenses: -(Number(expenses._sum.amount || 0) - Number(supplierExpenses._sum.amount || 0)),
    advances: -Number(advances._sum.amount || 0),
    driverDues: -Number(dues._sum.amount || 0),
    wholesaleCash:
      Number(bulkIn._sum.amount || 0) -
      Number(bulkVoid._sum.amount || 0) -
      Number(bulkRefund._sum.amount || 0),
    drawerTransfersIn: Number(drawerIn._sum.amount || 0),
    drawerTransfersOut: -(
      Number(drawerOut._sum.amount || 0) + Number(drawerOutLateRejected?._sum.amount || 0)
    ),
  };

  return {
    expected: round2(Object.values(terms).reduce((a, b) => a + b, 0)),
    terms,
  };
}

async function run() {
  console.log("[reconcile-shift-treasury] auditing branches with an unclosed shift\n");

  const shifts = await prisma.shift.findMany({
    where: { status: { in: ["OPEN", "PENDING_REVIEW"] } },
    include: {
      branch: { select: { name: true, treasuryId: true, treasury: { select: { balance: true } } } },
      user: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  if (shifts.length === 0) {
    console.log("No unclosed shifts — nothing to reconcile.");
    return 0;
  }

  let problems = 0;

  for (const shift of shifts) {
    if (!shift.branch?.treasuryId) continue;

    const balance = round2(shift.branch.treasury?.balance);
    const { expected, terms } = await expectedDrawer(shift);
    const { expected: routeExpected } = await calculateSystemExpectedCash(shift.id);
    const formulaDiff = round2(expected - routeExpected);
    const safe = round2(balance - expected);

    const formulaBad = Math.abs(formulaDiff) > TOLERANCE;
    const safeBad = safe < -TOLERANCE;
    if (formulaBad || safeBad) problems++;

    if (!formulaBad && !safeBad && !SHOW_ALL) continue;

    const tag = formulaBad ? "[FORMULA]" : safeBad ? "[NEG SAFE]" : "[   OK   ]";
    console.log(
      `${tag} shift #${shift.id} · ${shift.branch.name} · ${shift.user?.name || "?"} (${shift.status})`,
    );
    console.log(
      `         treasury ${balance}  drawer ${expected}  safe ${safe}  route drawer ${routeExpected}`,
    );
    if (formulaBad || safeBad) {
      // Print the terms so the misread movement is easy to spot by elimination.
      for (const [name, value] of Object.entries(terms)) {
        if (round2(value) !== 0) console.log(`           ${name.padEnd(20)} ${round2(value)}`);
      }
    }
    console.log("");
  }

  if (problems === 0) {
    console.log(`All ${shifts.length} unclosed shift(s) pass both checks.`);
  } else {
    console.warn(
      `${problems} of ${shifts.length} shift(s) need attention. [FORMULA] = this script and ` +
        `calculateSystemExpectedCash disagree; [NEG SAFE] = the books expect more in the ` +
        `drawer than the branch account holds — look for a drawer transfer recorded as a safe one.`,
    );
  }

  return problems;
}

run()
  .then(async (problems) => {
    await prisma.$disconnect();
    process.exit(problems === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("[reconcile-shift-treasury] failed:", err);
    await prisma.$disconnect();
    process.exit(2);
  });
