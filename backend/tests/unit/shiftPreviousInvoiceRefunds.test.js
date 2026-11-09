// "مرتجع فواتير سابقة" on the close-shift report.
//
// A return is booked to the shift open when it is made, so a return of
// yesterday's invoice is a negative REFUND- row in TODAY's shift. The drawer
// formula already counts it like any other refund row; the report only adds a
// breakdown naming it. These tests pin both halves:
//   - calculateSystemExpectedCash is unchanged by the breakdown (the refund is
//     counted exactly once, as it was before)
//   - summarizePreviousInvoiceRefunds picks out only returns whose invoice
//     belongs to another shift, and never legacy refunds with no link

jest.mock("../../config/database", () => require("./__shiftPrismaDouble").prisma);
jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  getUserBranchFilter: async () => ({}),
  verifyShiftManager: async () => ({}),
}));
jest.mock("../../lib/orderService", () => ({ drainPendingForBranch: async () => {} }));

const { setState, BRANCH_TREASURY } = require("./__shiftPrismaDouble");
const {
  calculateSystemExpectedCash,
  summarizePreviousInvoiceRefunds,
} = require("../../routes/shifts");

const SHIFT_ID = 20;

const sale = (overrides = {}) => ({
  saleNumber: "SALE-202611-00100",
  total: 100,
  paymentMethod: "CASH",
  deliveryManId: null,
  deliveryStatus: null,
  shiftId: SHIFT_ID,
  refundOf: null,
  createdAt: new Date("2026-11-10T12:00:00Z"),
  ...overrides,
});

// Today: one 100 sale, a 30 return of today's own invoice, and a 40 cash
// return of yesterday's invoice (sold on shift 19).
const todaysSales = [
  sale(),
  sale({
    saleNumber: "REFUND-202611-00001",
    total: -30,
    refundOf: { id: 100, saleNumber: "SALE-202611-00100", createdAt: new Date("2026-11-10T10:00:00Z"), shiftId: SHIFT_ID },
  }),
  sale({
    saleNumber: "REFUND-202611-00002",
    total: -40,
    refundOf: { id: 90, saleNumber: "SALE-202611-00090", createdAt: new Date("2026-11-09T18:00:00Z"), shiftId: 19 },
  }),
];

describe("summarizePreviousInvoiceRefunds", () => {
  test("lists only returns of an invoice from another shift", () => {
    const out = summarizePreviousInvoiceRefunds(todaysSales, SHIFT_ID);
    expect(out.count).toBe(1);
    expect(out.total).toBe(40);
    expect(out.cashTotal).toBe(40);
    expect(out.rows[0]).toMatchObject({
      refundNumber: "REFUND-202611-00002",
      originalSaleNumber: "SALE-202611-00090",
      paymentMethod: "CASH",
      total: 40,
    });
  });

  test("a VISA return counts in total but not in cashTotal", () => {
    const out = summarizePreviousInvoiceRefunds(
      [
        sale({
          saleNumber: "REFUND-202611-00003",
          total: -25.5,
          paymentMethod: "VISA",
          refundOf: { id: 80, saleNumber: "SALE-202611-00080", createdAt: new Date(), shiftId: 18 },
        }),
      ],
      SHIFT_ID,
    );
    expect(out.total).toBe(25.5);
    expect(out.cashTotal).toBe(0);
  });

  test("a legacy refund with no link is never listed", () => {
    const out = summarizePreviousInvoiceRefunds(
      [sale({ saleNumber: "REFUND-202610-00009", total: -50, refundOf: null })],
      SHIFT_ID,
    );
    expect(out).toEqual({ count: 0, total: 0, cashTotal: 0, rows: [] });
  });
});

describe("the drawer formula is unchanged by the breakdown", () => {
  test("the previous-invoice cash return is subtracted exactly once", async () => {
    setState({
      shift: {
        id: SHIFT_ID,
        startCash: 500,
        startTime: new Date("2026-11-10T08:00:00Z"),
        endTime: null,
        branchId: 1,
        sales: todaysSales,
        employeeTransactions: [],
        branch: { treasuryId: BRANCH_TREASURY },
      },
    });
    const { expected } = await calculateSystemExpectedCash(SHIFT_ID);
    // 500 opening + 100 sale − 30 same-shift return − 40 previous-invoice return
    expect(expected).toBe(530);
  });
});
