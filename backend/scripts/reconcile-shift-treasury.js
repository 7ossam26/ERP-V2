#!/usr/bin/env node
// scripts/reconcile-shift-treasury.js
//
// Audits the invariant the shift-treasury postings establish: for a branch with
// an unclosed shift, the branch's cash treasury should equal the shift's expected
// drawer cash.
//
//     treasury.balance === startCash
//                        + cash sales − cash expenses − advances − driver dues
//                        + manual deposits − manual withdrawals
//                        + transfers in  − transfers out
//                        − payroll paid  − supplier payments
//
// A non-zero residual means a branch-treasury movement exists that
// calculateSystemExpectedCash does not model. That cannot corrupt the treasury —
// the boundary postings follow `treasuryVariance`, a delta against the live
// balance, not this figure — but it DOES inflate the shortage reported against
// the cashier. So every residual here is a real cashier-fairness bug worth
// chasing, and this script is how you find the next one.
//
// AUDIT-ONLY BY DESIGN. There is deliberately no --fix: the correct repair for a
// residual is to model the missing movement in calculateSystemExpectedCash, not
// to overwrite a treasury balance that is already right.
//
// Run: node backend/scripts/reconcile-shift-treasury.js [--all]
//
// --all   : also report shifts whose residual is zero (default: drift only)

const prisma = require("../config/database");

const SHOW_ALL = process.argv.includes("--all");
// Same tolerance as reconcile-bulk-payments.js — below half a piastre is noise.
const TOLERANCE = 0.005;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Expected drawer cash for one shift.
 *
 * Intentionally a SECOND implementation of routes/shifts.js's
 * calculateSystemExpectedCash rather than an import of it. An audit that reuses
 * the code it audits cannot detect a bug in that code — if the route's formula
 * forgets a movement, importing it would make this script forget the same one
 * and report a clean bill of health. Keep them independent and let the residual
 * speak.
 */
async function expectedDrawer(shift) {
  const treasuryId = shift.branch.treasuryId;
  const window = { gte: shift.startTime, lte: shift.endTime || new Date() };

  const [sales, expenses, advances, dues, deposits, withdrawals, out, into, payroll, supplier] =
    await Promise.all([
      prisma.sale.findMany({
        where: { shiftId: shift.id, status: "COMPLETED", isVoided: false, paymentMethod: "CASH" },
        select: { total: true, deliveryManId: true, deliveryStatus: true, deliveryDriverShare: true },
      }),
      prisma.expense.aggregate({
        where: { treasuryId, paymentMethod: "CASH", createdAt: window },
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
      prisma.deposit.aggregate({
        where: { treasuryId, source: "MANUAL", createdAt: window },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { treasuryId, source: "MANUAL", createdAt: window },
        _sum: { amount: true },
      }),
      prisma.cashTransfer.aggregate({
        where: { fromTreasuryId: treasuryId, status: { in: ["PENDING", "APPROVED"] }, createdAt: window },
        _sum: { amount: true },
      }),
      prisma.cashTransfer.aggregate({
        where: { toTreasuryId: treasuryId, status: "APPROVED", createdAt: window },
        _sum: { amount: true },
      }),
      prisma.payroll.aggregate({
        where: { treasuryId, status: "PAID", createdAt: window },
        _sum: { netSalary: true },
      }),
      prisma.supplierPayment.aggregate({
        where: { treasuryId, createdAt: window },
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
    cashExpenses: -Number(expenses._sum.amount || 0),
    advances: -Number(advances._sum.amount || 0),
    driverDues: -Number(dues._sum.amount || 0),
    manualDeposits: Number(deposits._sum.amount || 0),
    manualWithdrawals: -Number(withdrawals._sum.amount || 0),
    transfersIn: Number(into._sum.amount || 0),
    transfersOut: -Number(out._sum.amount || 0),
    payrollPaid: -Number(payroll._sum.netSalary || 0),
    supplierPayments: -Number(supplier._sum.amount || 0),
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

  let drifted = 0;

  for (const shift of shifts) {
    if (!shift.branch?.treasuryId) continue;

    const balance = round2(shift.branch.treasury?.balance);
    const { expected, terms } = await expectedDrawer(shift);
    const residual = round2(balance - expected);
    const isDrift = Math.abs(residual) > TOLERANCE;
    if (isDrift) drifted++;

    if (!isDrift && !SHOW_ALL) continue;

    console.log(
      `${isDrift ? "[DRIFT]" : "[  OK  ]"} shift #${shift.id} · ${shift.branch.name} · ${shift.user?.name || "?"} (${shift.status})`,
    );
    console.log(`         treasury ${balance}  expected ${expected}  residual ${residual}`);
    if (isDrift) {
      // Print the terms so the missing movement is easy to spot by elimination.
      for (const [name, value] of Object.entries(terms)) {
        if (round2(value) !== 0) console.log(`           ${name.padEnd(18)} ${round2(value)}`);
      }
    }
    console.log("");
  }

  if (drifted === 0) {
    console.log(`All ${shifts.length} unclosed shift(s) reconcile against their treasury.`);
  } else {
    console.warn(
      `${drifted} of ${shifts.length} shift(s) drifted. Each residual is a branch-treasury ` +
        `movement missing from calculateSystemExpectedCash — model it there rather than ` +
        `adjusting the treasury.`,
    );
  }

  return drifted;
}

run()
  .then(async (drifted) => {
    await prisma.$disconnect();
    process.exit(drifted === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("[reconcile-shift-treasury] failed:", err);
    await prisma.$disconnect();
    process.exit(2);
  });
