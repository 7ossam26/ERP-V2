#!/usr/bin/env node
// scripts/check-negative-net-salary.js
//
// Pre-deploy check for the OVERTIME/BONUS change (migration
// 20260827000000_add_overtime_bonus_transaction_types).
//
// POST /employees/:id/pay now REJECTS a negative net salary. Before that guard,
// paying an employee whose سلف + خصومات exceeded their salary silently created a
// PAID payroll with a negative net, moved no cash, and permanently burned the
// @@unique([employeeId, month, year]) slot — the employee read as "تم الدفع"
// while still owing money, with no way to correct it.
//
// This script reports, for a given month:
//
//   1. Employees who would now be BLOCKED from being paid (net < 0). Settle
//      these before deploying, or the payroll run will fail with a 400.
//   2. Existing PAID payrolls that already have a negative net — historical rows
//      created by the old behavior. Informational: the new guard cannot fix
//      these, they need a manual decision.
//
// The net is computed with utils/payrollMath.js — the SAME code the pay route
// uses — so this cannot drift from what the server will actually do.
//
// AUDIT-ONLY BY DESIGN. There is deliberately no --fix: whether to waive a
// deduction, carry it to next month, or collect it in cash is a business
// decision, not something a script should make.
//
// Run: node backend/scripts/check-negative-net-salary.js [month] [year]
//      (defaults to the current month)

const prisma = require("../config/database");
const {
  summarizeEmployeeTransactions,
  computeNetSalary,
} = require("../utils/payrollMath");

const now = new Date();
const month = Number(process.argv[2]) || now.getMonth() + 1;
const year = Number(process.argv[3]) || now.getFullYear();

// Same window the pay route uses (routes/employees.js getMonthDateRange).
const startDate = new Date(year, month - 1, 1);
const endDate = new Date(year, month, 0, 23, 59, 59, 999);

const money = (n) => Number(n).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

async function main() {
  console.log(`\nNegative net-salary check — ${month}/${year}`);
  console.log("=".repeat(72));

  const employees = await prisma.employee.findMany({
    include: {
      branch: { select: { name: true } },
      transactions: { where: { date: { gte: startDate, lte: endDate } } },
      payrolls: { where: { month, year } },
    },
    orderBy: { name: "asc" },
  });

  const blocked = [];
  for (const emp of employees) {
    const summary = summarizeEmployeeTransactions(emp.transactions);
    const net = computeNetSalary(emp.salary, summary);
    if (net < 0) {
      blocked.push({ emp, summary, net, alreadyPaid: emp.payrolls.length > 0 });
    }
  }

  console.log(`\n1. Employees who would be BLOCKED from payment (net < 0)`);
  console.log("-".repeat(72));
  if (blocked.length === 0) {
    console.log("   None. Safe to deploy — no payroll run will hit the new guard.");
  } else {
    for (const { emp, summary, net, alreadyPaid } of blocked) {
      console.log(
        `   #${emp.id}  ${emp.name}  (${emp.branch?.name ?? "no branch"})` +
          (alreadyPaid ? "   [already paid this month]" : "")
      );
      console.log(
        `        base ${money(emp.salary)}` +
          `  − advances ${money(summary.advances)}` +
          `  − deductions ${money(summary.deductions)}` +
          `  + overtime ${money(summary.overtime)}` +
          `  + bonuses ${money(summary.bonuses)}` +
          `  =  NET ${money(net)}`
      );
    }
    console.log(
      `\n   ${blocked.length} employee(s) affected. Each needs the shortfall settled` +
        `\n   (waive, reduce, or re-date a deduction) before their salary can be paid.`
    );
  }

  // Historical damage from before the guard existed.
  const badPayrolls = await prisma.payroll.findMany({
    where: { status: "PAID", netSalary: { lt: 0 } },
    include: { employee: { select: { name: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  console.log(`\n2. Existing PAID payrolls with a negative net (all time)`);
  console.log("-".repeat(72));
  if (badPayrolls.length === 0) {
    console.log("   None. No historical rows were created by the old behavior.");
  } else {
    for (const p of badPayrolls) {
      console.log(
        `   payroll #${p.id}  ${p.employee?.name ?? "?"}  ${p.month}/${p.year}` +
          `   net ${money(p.netSalary)}`
      );
    }
    console.log(
      `\n   ${badPayrolls.length} row(s). These predate the guard and are marked paid` +
        `\n   despite no cash moving. They need a manual decision — the new code` +
        `\n   prevents more of them but does not repair these.`
    );
  }

  console.log("");
  return blocked.length;
}

main()
  .catch((err) => {
    console.error(`\nFailed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
