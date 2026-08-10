// Stateful Prisma double for calculateSystemExpectedCash (routes/shifts.js).
//
// Not a test file — jest's testMatch only picks up *.test.js, so this sits
// beside the suite that requires it.
//
// The point of the double is that the WHERE CLAUSES are really evaluated. The
// wholesale terms are all filter logic (method, treasury, window, sign, and
// receivedAt-vs-voidedAt), so a double that ignored `where` and returned a
// canned sum would pass no matter what the query said.

const BRANCH_TREASURY = 42;

const state = {
  shift: null,
  bulkPayments: [],
  bulkRefunds: [],
};

function setState({ shift = null, bulkPayments = [], bulkRefunds = [] }) {
  state.shift = shift;
  state.bulkPayments = bulkPayments;
  state.bulkRefunds = bulkRefunds;
}

/** Supports the subset of Prisma filter syntax these queries actually use. */
function matchField(value, cond) {
  if (cond === null) return value === null;
  if (cond instanceof Date) return value != null && +value === +cond;
  if (typeof cond !== "object") return value === cond;

  if (Array.isArray(cond.in)) return cond.in.includes(value);
  if (cond.gt != null && !(Number(value) > Number(cond.gt))) return false;
  if (cond.lt != null && !(Number(value) < Number(cond.lt))) return false;

  // Date-window comparisons. A null column (an unvoided payment) is outside
  // every window — which is exactly what `voidedAt: {gte, lte}` must mean.
  if (cond.gte != null || cond.lte != null) {
    if (value == null) return false;
    if (cond.gte != null && +value < +cond.gte) return false;
    if (cond.lte != null && +value > +cond.lte) return false;
  }
  return true;
}

function matchWhere(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => matchField(row[key], cond));
}

function sumOf(rows, where) {
  const total = rows
    .filter((r) => matchWhere(r, where))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  return total === 0 ? 0 : total;
}

/** Every aggregate this code path calls returns the same `_sum` shape. */
const emptyAgg = async () => ({ _sum: { amount: 0, netSalary: 0 } });

const prisma = {
  shift: {
    findUnique: async () => (state.shift ? { ...state.shift } : null),
    // reconstructOpeningHandover: no previous shift, so no handover to rebuild.
    findFirst: async () => null,
  },
  bulkPayment: {
    aggregate: async ({ where }) => ({
      _sum: { amount: sumOf(state.bulkPayments, where) },
    }),
  },
  bulkRefund: {
    aggregate: async ({ where }) => ({
      _sum: { amount: sumOf(state.bulkRefunds, where) },
    }),
  },
  expense: { aggregate: emptyAgg },
  deliveryManTransaction: { aggregate: emptyAgg },
  deposit: { aggregate: emptyAgg },
  withdrawal: { aggregate: emptyAgg },
  cashTransfer: { aggregate: emptyAgg },
  payroll: { aggregate: emptyAgg },
  supplierPayment: { aggregate: emptyAgg },
};

module.exports = { prisma, setState, BRANCH_TREASURY };
