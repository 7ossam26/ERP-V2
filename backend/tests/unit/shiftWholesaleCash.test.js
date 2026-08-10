// Unit tests for the wholesale (جملة) terms in calculateSystemExpectedCash.
//
// A bulk collection credits Branch.treasuryId directly and writes no Sale row,
// no Deposit row and no shiftId — bulk_payments has no such column. So none of
// the drawer terms could see it: the cashier physically counted the wholesale
// takings, the formula did not expect them, and the shift closed with an
// overage nobody could account for.
//
// The terms are attributed by branch treasury + shift time window, the same
// compensating model the expense and transfer terms already use. What is worth
// testing is therefore the FILTERS, not the addition:
//
//   - only method=CASH reaches the drawer (BANK_TRANSFER/CHEQUE credit the same
//     treasury but never pass the register)
//   - only this branch's treasury
//   - only rows inside the window
//   - voids are SUBTRACTED at voidedAt, never filtered out at receivedAt, so a
//     collect-and-void inside one shift nets to zero rather than −amount
//   - the negative old-debt rows stay out

jest.mock("../../config/database", () => require("./__shiftPrismaDouble").prisma);
jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  getUserBranchFilter: async () => ({}),
  verifyShiftManager: async () => ({}),
}));
jest.mock("../../lib/orderService", () => ({ drainPendingForBranch: async () => {} }));

const { setState, BRANCH_TREASURY } = require("./__shiftPrismaDouble");
const { calculateSystemExpectedCash } = require("../../routes/shifts");

const START = new Date("2026-08-05T06:00:00Z");
const END = new Date("2026-08-05T18:00:00Z");
const DURING = new Date("2026-08-05T12:00:00Z");
const BEFORE = new Date("2026-08-04T12:00:00Z");
const AFTER = new Date("2026-08-06T12:00:00Z");

/** Shift with a 1,000 float and no retail activity, so `expected` is 1,000 + wholesale. */
function baseShift(overrides = {}) {
  return {
    id: 1,
    branchId: 7,
    startCash: 1000,
    startTime: START,
    endTime: END,
    reopenCount: 0,
    sales: [],
    employeeTransactions: [],
    branch: { treasuryId: BRANCH_TREASURY },
    ...overrides,
  };
}

function payment(o) {
  return {
    treasuryId: BRANCH_TREASURY,
    method: "CASH",
    amount: 0,
    receivedAt: DURING,
    voidedAt: null,
    ...o,
  };
}

describe("calculateSystemExpectedCash — wholesale cash", () => {
  test("a cash collection into the branch safe raises expected drawer cash", async () => {
    // The reported bug: 5,000 taken at the register, drawer counted 6,000, and
    // the shift printed a 5,000 overage because expected stayed at the float.
    setState({
      shift: baseShift(),
      bulkPayments: [payment({ amount: 5000 })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(5000);
    expect(r.bulkNetCash).toBe(5000);
    expect(r.expected).toBe(6000);
  });

  test("a credit sale with no payment moves nothing", async () => {
    setState({ shift: baseShift(), bulkPayments: [] });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(0);
    expect(r.expected).toBe(1000);
  });

  test("BANK_TRANSFER and CHEQUE are reported but never enter the drawer", async () => {
    // Both credit the treasury (CASH_METHODS in the bulk service) yet neither
    // passes the register, so counting them would invent a shortage.
    setState({
      shift: baseShift(),
      bulkPayments: [
        payment({ amount: 3000, method: "BANK_TRANSFER" }),
        payment({ amount: 2000, method: "CHEQUE" }),
      ],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkNonCashCollected).toBe(5000);
    expect(r.bulkCashCollected).toBe(0);
    expect(r.expected).toBe(1000);
  });

  test("collections outside the window belong to another shift", async () => {
    setState({
      shift: baseShift(),
      bulkPayments: [
        payment({ amount: 800, receivedAt: BEFORE }),
        payment({ amount: 900, receivedAt: AFTER }),
      ],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(0);
    expect(r.expected).toBe(1000);
  });

  test("collections into another treasury are not this branch's drawer", async () => {
    setState({
      shift: baseShift(),
      bulkPayments: [payment({ amount: 4000, treasuryId: BRANCH_TREASURY + 1 })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(0);
    expect(r.expected).toBe(1000);
  });

  test("collect and void inside one shift nets to zero, not minus the amount", async () => {
    // This is why voids are subtracted rather than filtered. Excluding rows on
    // voidedAt:null would drop the collection and keep the subtraction, landing
    // the shift at −amount and inventing a shortage out of a corrected typo.
    setState({
      shift: baseShift(),
      bulkPayments: [payment({ amount: 2500, receivedAt: DURING, voidedAt: DURING })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(2500);
    expect(r.bulkCashVoided).toBe(2500);
    expect(r.bulkNetCash).toBe(0);
    expect(r.expected).toBe(1000);
  });

  test("a collection voided in a LATER shift still counts here", async () => {
    // The cash really was in this drawer at close; it leaves whichever drawer is
    // open when the void happens.
    setState({
      shift: baseShift(),
      bulkPayments: [payment({ amount: 2500, receivedAt: DURING, voidedAt: AFTER })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(2500);
    expect(r.bulkCashVoided).toBe(0);
    expect(r.expected).toBe(3500);
  });

  test("voiding a collection taken in an EARLIER shift takes cash out of this one", async () => {
    setState({
      shift: baseShift(),
      bulkPayments: [payment({ amount: 2500, receivedAt: BEFORE, voidedAt: DURING })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(0);
    expect(r.bulkCashVoided).toBe(2500);
    expect(r.expected).toBe(-1500);
  });

  test("a cash refund is money handed back out of the drawer", async () => {
    setState({
      shift: baseShift(),
      bulkPayments: [payment({ amount: 5000 })],
      bulkRefunds: [
        {
          treasuryId: BRANCH_TREASURY,
          method: "CASH_REFUND",
          amount: 1200,
          createdAt: DURING,
        },
      ],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashRefunded).toBe(1200);
    expect(r.bulkNetCash).toBe(3800);
    expect(r.expected).toBe(4800);
  });

  test("negative old-debt opening balances are excluded", async () => {
    // createOldDebtPayment writes method=CREDIT with a null treasury and a
    // NEGATIVE amount. It touches no treasury, so it must not move the drawer —
    // and it is the one writer whose receivedAt is user-supplied.
    setState({
      shift: baseShift(),
      bulkPayments: [
        payment({ amount: -9000, method: "CREDIT", treasuryId: null, receivedAt: DURING }),
      ],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(0);
    expect(r.bulkNonCashCollected).toBe(0);
    expect(r.expected).toBe(1000);
  });

  test("an open shift uses now() as the window end", async () => {
    // endTime is null until close, so a collection taken minutes ago must
    // already be inside the window the close screen is measured against.
    setState({
      shift: baseShift({ endTime: null }),
      bulkPayments: [payment({ amount: 700, receivedAt: new Date() })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.bulkCashCollected).toBe(700);
    expect(r.expected).toBe(1700);
  });

  test("wholesale coexists with retail cash rather than replacing it", async () => {
    setState({
      shift: baseShift({
        sales: [
          {
            total: 300,
            paymentMethod: "CASH",
            deliveryManId: null,
            deliveryStatus: null,
            deliveryDriverShare: 0,
          },
        ],
      }),
      bulkPayments: [payment({ amount: 5000 })],
    });

    const r = await calculateSystemExpectedCash(1);

    expect(r.posCash).toBe(300);
    expect(r.bulkCashCollected).toBe(5000);
    expect(r.expected).toBe(6300);
  });
});
