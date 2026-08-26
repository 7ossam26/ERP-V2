/**
 * The one place where a month's employee transactions are turned into money.
 *
 * `GET /employees` (the figure the operator sees as "المرتب المتبقي") and
 * `POST /employees/:id/pay` (the figure actually debited from the treasury) both
 * call these helpers, so the number confirmed in the UI is by construction the
 * number that gets paid. They used to hand-roll the same reducers separately.
 *
 * Every sum goes through roundMoney because netSalary feeds an atomic
 * `updateMany({ where: { balance: { gte: netSalary } } })` guard — summing four
 * DECIMAL columns as JS floats makes `1234.5600000000002 > 1234.56` a real
 * failure mode that would reject a perfectly fundable payroll.
 */

const { roundMoney } = require("./money");

// Sums each transaction type over an already date-filtered list.
function summarizeEmployeeTransactions(transactions = []) {
  const sumOf = (type) =>
    roundMoney(
      transactions
        .filter((t) => t.type === type)
        .reduce((sum, t) => sum + Number(t.amount), 0)
    );

  const advances = sumOf("ADVANCE");
  const deductions = sumOf("DEDUCTION");
  const overtime = sumOf("OVERTIME");
  const bonuses = sumOf("BONUS");

  return {
    advances,
    deductions,
    overtime,
    bonuses,
    // Derived convenience total for the UI's combined "الإضافات" column.
    // Never persisted — payrolls store overtime and bonuses separately.
    additions: roundMoney(overtime + bonuses),
  };
}

// netSalary = base − advances − deductions + overtime + bonuses
function computeNetSalary(baseSalary, summary) {
  return roundMoney(
    Number(baseSalary) -
      summary.advances -
      summary.deductions +
      summary.overtime +
      summary.bonuses
  );
}

module.exports = { summarizeEmployeeTransactions, computeNetSalary };
