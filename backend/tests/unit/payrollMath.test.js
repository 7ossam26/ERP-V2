// Pins the payroll identity:
//   netSalary = baseSalary - advances - deductions + overtime + bonuses
//
// Both GET /employees (the "المرتب المتبقي" the operator confirms) and
// POST /employees/:id/pay (the amount actually debited) go through these
// helpers, so a regression here silently pays the wrong number.

const {
  summarizeEmployeeTransactions,
  computeNetSalary,
} = require("../../utils/payrollMath");

const tx = (type, amount) => ({ type, amount });

describe("summarizeEmployeeTransactions", () => {
  test("sums each type independently and derives additions", () => {
    const s = summarizeEmployeeTransactions([
      tx("ADVANCE", 500),
      tx("DEDUCTION", 200),
      tx("OVERTIME", 300),
      tx("BONUS", 400),
    ]);

    expect(s).toEqual({
      advances: 500,
      deductions: 200,
      overtime: 300,
      bonuses: 400,
      additions: 700,
    });
  });

  test("empty list is all zeros", () => {
    expect(summarizeEmployeeTransactions([])).toEqual({
      advances: 0,
      deductions: 0,
      overtime: 0,
      bonuses: 0,
      additions: 0,
    });
  });

  test("defaults to an empty list when called with nothing", () => {
    expect(summarizeEmployeeTransactions().additions).toBe(0);
  });

  // netSalary feeds an atomic `balance: { gte: netSalary }` guard, so float dust
  // would reject a payroll the treasury can actually fund.
  test("rounds away float dust", () => {
    const s = summarizeEmployeeTransactions([
      tx("OVERTIME", 0.1),
      tx("OVERTIME", 0.2),
    ]);
    expect(s.overtime).toBe(0.3);
    expect(s.additions).toBe(0.3);
  });

  test("handles Decimal-like string amounts from Prisma", () => {
    const s = summarizeEmployeeTransactions([
      tx("BONUS", "150.50"),
      tx("BONUS", "49.50"),
    ]);
    expect(s.bonuses).toBe(200);
  });
});

describe("computeNetSalary", () => {
  const net = (base, transactions) =>
    computeNetSalary(base, summarizeEmployeeTransactions(transactions));

  test("additions offset subtractions", () => {
    expect(
      net(5000, [
        tx("ADVANCE", 500),
        tx("DEDUCTION", 200),
        tx("OVERTIME", 300),
        tx("BONUS", 400),
      ])
    ).toBe(5000);
  });

  test("additions alone increase the net", () => {
    expect(net(3000, [tx("OVERTIME", 250), tx("BONUS", 150)])).toBe(3400);
  });

  // Guards the pre-existing advance/deduction behavior against regression.
  test("legacy advance + deduction only behaves exactly as before", () => {
    expect(net(3000, [tx("ADVANCE", 100), tx("DEDUCTION", 50)])).toBe(2850);
  });

  test("no transactions pays the full base salary", () => {
    expect(net(4200, [])).toBe(4200);
  });

  // The helper reports it honestly; POST /:id/pay is what rejects it.
  test("reports a negative net rather than clamping", () => {
    expect(
      net(1000, [tx("ADVANCE", 900), tx("DEDUCTION", 300), tx("BONUS", 100)])
    ).toBe(-100);
  });
});
