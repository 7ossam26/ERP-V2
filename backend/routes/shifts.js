const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requireAnyPermission,
  getUserBranchFilter,
  verifyShiftManager,
} = require("../middleware/auth");
const {
  isShiftApprovalRole,
  bypassesShiftBranchScope,
} = require("../config/roles");
const { drainPendingForBranch } = require("../lib/orderService");

/**
 * How far back POST /start looks for an unclosed shift when deciding whether a
 * branch may open a new one. Long enough to cover an overnight shift.
 *
 * Note for anyone tempted to bound PATCH /:id/reopen by this same window: it
 * would protect nothing. That blocker matches status OPEN *and* PENDING_REVIEW —
 * both sides of the reopen transition — so a PENDING_REVIEW shift already blocks
 * /start exactly as much as the OPEN shift it becomes, at any age. Reopening
 * cannot make a shift newly invisible to this check.
 */
const UNCLOSED_SHIFT_LOOKBACK_HOURS = 48;

// Reopening discards the cashier's submitted cash count, so the audit trail
// needs a real explanation rather than a keystroke.
const MIN_REOPEN_REASON_LENGTH = 5;

// Require authentication for all shift operations
// Require authentication for all shift operations
router.use(authenticateToken);

/**
 * Get all shifts with filtering (Requires SHIFTS or REPORTS permission)
 */
router.get(
  "/",
  requireAnyPermission(["SHIFTS", "REPORTS"]),
  async (req, res, next) => {
    try {
      const {
        branchId,
        status,
        userId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = {};

      // Enforce branch access control
      const branchFilter = await getUserBranchFilter(req.user.id);
      const allowedBranchIds = branchFilter
        ? (branchFilter.id.in || [branchFilter.id])
        : null; // null = global role

      if (branchId && branchId !== "all") {
        const requestedId = parseInt(branchId);
        if (allowedBranchIds && !allowedBranchIds.includes(requestedId)) {
          return res.status(403).json({ error: "Access denied to this branch" });
        }
        whereClause.branchId = requestedId;
      } else if (allowedBranchIds) {
        whereClause.branchId = allowedBranchIds.length === 1
          ? allowedBranchIds[0]
          : { in: allowedBranchIds };
      }

      // Filter by Status
      if (status && status !== "all") {
        whereClause.status = status;
      }

      // Filter by User
      if (userId) {
        whereClause.userId = parseInt(userId);
      }

      // Filter by Date Range
      if (startDate || endDate) {
        whereClause.startTime = {};
        if (startDate) whereClause.startTime.gte = new Date(startDate);
        if (endDate) whereClause.startTime.lte = new Date(endDate);
      }

      const [shifts, total] = await Promise.all([
        prisma.shift.findMany({
          where: whereClause,
          include: {
            user: { select: { name: true, role: { select: { name: true } } } },
            branch: { select: { name: true } },
            reviewedBy: { select: { name: true } },
          },
          orderBy: { startTime: "desc" },
          take: parseInt(limit),
          skip: skip,
        }),
        prisma.shift.count({ where: whereClause }),
      ]);

      res.json({
        data: shifts,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Helper: Determine shift type based on current time and system config
 */
async function determineShiftType() {
  try {
    const config = await prisma.systemConfiguration.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      // Fallback defaults if config doesn't exist
      console.warn("⚠️ SystemConfiguration not found, using defaults");
      return {
        type: "MORNING",
        config: {
          morningShiftStart: "09:00",
          morningShiftEnd: "17:00",
          eveningShiftStart: "17:00",
          eveningShiftEnd: "01:00",
        },
      };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Parse time strings to minutes for accurate comparison
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const morningStart = parseTime(config.morningShiftStart);
    const morningEnd = parseTime(config.morningShiftEnd);
    const eveningStart = parseTime(config.eveningShiftStart);
    const eveningEnd = parseTime(config.eveningShiftEnd);

    // Check if current time is in morning shift
    const isInMorningShift =
      morningEnd > morningStart
        ? currentTimeInMinutes >= morningStart &&
        currentTimeInMinutes < morningEnd
        : false; // Morning shift doesn't cross midnight

    // Check if current time is in evening shift (may cross midnight)
    let isInEveningShift;
    if (eveningEnd < eveningStart) {
      // Overnight shift (e.g., 17:00 to 01:00)
      isInEveningShift =
        currentTimeInMinutes >= eveningStart ||
        currentTimeInMinutes < eveningEnd;
    } else {
      isInEveningShift =
        currentTimeInMinutes >= eveningStart &&
        currentTimeInMinutes < eveningEnd;
    }

    const type = isInMorningShift ? "MORNING" : "EVENING";

    return { type, config };
  } catch (error) {
    console.error("Error in determineShiftType:", error);
    // Return safe defaults on error
    return {
      type: "MORNING",
      config: {
        morningShiftStart: "09:00",
        morningShiftEnd: "17:00",
        eveningShiftStart: "17:00",
        eveningShiftEnd: "01:00",
      },
    };
  }
}

/**
 * Helper: Calculate system expected cash for a shift
 */
async function calculateSystemExpectedCash(shiftId) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      sales: {
        // isVoided:false mirrors the report's sales query so both derive the
        // same drawer figure (no void feature sets isVoided=true today, but
        // keep them aligned).
        where: { status: "COMPLETED", isVoided: false },
        include: { order: { select: { status: true } } },
      },
      expenses: true,
      employeeTransactions: { where: { type: "ADVANCE" } },
    },
  });

  if (!shift) return { expected: 0, cashSales: 0, cashExpenses: 0, advances: 0, expectedVisa: 0, expectedInstapay: 0, pilotSettlementDifference: 0 };

  // Start with opening cash
  let startCash = parseFloat(shift.startCash) || 0;
  let expected = startCash;
  let posCash = 0;
  let codDeliveredThisShift = 0;
  let codPendingExcluded = 0;
  let cashExpenses = 0;
  let expectedVisa = 0;
  let expectedInstapay = 0;

  // Add cash sales only (card sales don't go in drawer).
  // Source of truth for "cash is in the drawer" is sale.deliveryStatus:
  //   - mark-delivered (sales.js:1100) flips both deliveryStatus and Order.status
  //   - driver settlement (delivery.controller.js) flips deliveryStatus only
  //     (cash returned from the driver is placed in the drawer by the cashier)
  // Order.status used to be checked here but it was out of sync after
  // settlement, producing phantom shortage/overage at shift close.
  shift.sales.forEach((sale) => {
    const amount = parseFloat(sale.total) || 0;
    if (sale.paymentMethod === "VISA") {
      expectedVisa += amount;
      return;
    }
    if (sale.paymentMethod === "INSTAPAY") {
      expectedInstapay += amount;
      return;
    }
    if (sale.paymentMethod !== "CASH") return;
    if (!sale.deliveryManId) {
      // Walk-in / pickup cash — no driver involved, money in the drawer at
      // sale time. POS sales create an Order row too, so we can't use
      // !sale.order as the gate.
      posCash += amount;
      expected += amount;
      return;
    }
    if (sale.deliveryStatus === "DELIVERED") {
      // The driver keeps deliveryDriverShare; only (total − share) physically
      // returns to the drawer at settlement.
      const driverShare = parseFloat(sale.deliveryDriverShare) || 0;
      const netAmount = amount - driverShare;
      codDeliveredThisShift += netAmount;
      expected += netAmount;
    } else {
      codPendingExcluded += amount;
    }
  });

  // Subtract expenses paid from drawer
  shift.expenses.forEach((expense) => {
    if (expense.paymentMethod === "CASH") {
      const amount = parseFloat(expense.amount) || 0;
      cashExpenses += amount;
      expected -= amount;
    }
  });

  // Subtract employee advances (cash handed to employees from the drawer)
  let advances = 0;
  shift.employeeTransactions.forEach((t) => {
    const amount = parseFloat(t.amount) || 0;
    advances += amount;
    expected -= amount;
  });

  // Subtract driver ("pilot") InstaPay dues paid out of the drawer this shift.
  // When a COD order is converted to InstaPay the driver's share becomes a due
  // that is later collected as cash from the branch drawer (payDeliveryManDues
  // → DUES_PAYOUT + a Withdrawal). That cash physically leaves the drawer, so
  // it must reduce expected cash or it reads as a phantom shortage. Payouts are
  // not linked to a shiftId, so attribute by branch + shift time window (the
  // same approach the report uses for deposits). endTime is not set yet when
  // this runs at close, so fall back to now.
  let pilotSettlementDifference = 0;
  if (shift.startTime && shift.branchId) {
    const endFilter = shift.endTime || new Date();
    const duesAgg = await prisma.deliveryManTransaction.aggregate({
      where: {
        type: "DUES_PAYOUT",
        createdAt: { gte: shift.startTime, lte: endFilter },
        deliveryMan: { branchId: shift.branchId },
      },
      _sum: { amount: true },
    });
    pilotSettlementDifference = Number(duesAgg._sum.amount || 0);
    expected -= pilotSettlementDifference;
  }

  const round = (n) => Math.round(n * 100) / 100;
  const cashSales = round(posCash + codDeliveredThisShift);
  return {
    expected: round(expected),
    cashSales,
    posCash: round(posCash),
    codDeliveredThisShift: round(codDeliveredThisShift),
    codPendingExcluded: round(codPendingExcluded),
    cashExpenses: round(cashExpenses),
    advances: round(advances),
    pilotSettlementDifference: round(pilotSettlementDifference),
    startCash: round(startCash),
    expectedVisa: round(expectedVisa),
    expectedInstapay: round(expectedInstapay),
  };
}

// Start a new shift
router.post("/start", async (req, res, next) => {
  try {
    const { userId, branchId, startCash } = req.body;

    if (!userId || !branchId) {
      return res
        .status(400)
        .json({ error: "User ID and Branch ID are required" });
    }

    // Validate Branch Access
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    if (branchFilter) {
      // Handle both single ID and IN clause
      const allowedIds = branchFilter.id.in || [branchFilter.id];
      if (!allowedIds.includes(parseInt(branchId))) {
        return res.status(403).json({
          error: "Access denied. You cannot start a shift in this branch.",
        });
      }
    }

    // Determine shift type based on time
    const { type: shiftType, config } = await determineShiftType();

    // Check for RECENT unclosed shifts (last 48 hours to handle overnight shifts).
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - UNCLOSED_SHIFT_LOOKBACK_HOURS);

    // BLOCKING LOGIC: Any unclosed shift (OPEN or PENDING_REVIEW) blocks new shift start
    // This enforces STRICT one shift per branch policy
    const existingBranchShift = await prisma.shift.findFirst({
      where: {
        branchId: parseInt(branchId),
        status: { in: ["OPEN", "PENDING_REVIEW"] },
        startTime: {
          gte: twoDaysAgo,
        },
      },
      include: {
        user: true, // Include user to show WHO has the open shift
      },
      orderBy: { startTime: "desc" },
    });

    if (existingBranchShift) {
      const isPending = existingBranchShift.status === "PENDING_REVIEW";
      const blockerName = existingBranchShift.user
        ? existingBranchShift.user.name
        : "Unknown User";

      return res.status(400).json({
        error: isPending
          ? `Cannot start shift. Previous shift by ${blockerName} is pending manager review.`
          : `Cannot start shift. There is already an active shift by ${blockerName}.`,
        previousShiftStatus: existingBranchShift.status,
        previousShiftId: existingBranchShift.id,
        blockerName: blockerName,
        message: isPending
          ? `الوردية السابقة (للموظف ${blockerName}) تحتاج موافقة المدير`
          : `يوجد وردية مفتوحة بالفعل للموظف ${blockerName}`,
      });
    }

    // Check if user already has an active shift
    const existingUserShift = await prisma.shift.findFirst({
      where: {
        userId: parseInt(userId),
        status: "OPEN",
      },
    });

    if (existingUserShift) {
      return res
        .status(400)
        .json({ error: "User already has an active shift" });
    }

    // ROLLING BALANCE: Use end cash from most recent closed shift ONLY if user didn't provide a value
    let calculatedStartCash;

    if (startCash !== undefined && startCash !== null) {
      calculatedStartCash = parseFloat(startCash);
    } else {
      const lastClosedShift = await prisma.shift.findFirst({
        where: {
          branchId: parseInt(branchId),
          status: "CLOSED",
        },
        orderBy: { endTime: "desc" },
      });

      if (lastClosedShift && lastClosedShift.endCash !== null) {
        calculatedStartCash = parseFloat(lastClosedShift.endCash);
      } else {
        calculatedStartCash = 0;
      }
    }

    const newShift = await prisma.shift.create({
      data: {
        userId: parseInt(userId),
        branchId: parseInt(branchId),
        type: shiftType,
        startCash: calculatedStartCash,
        startTime: new Date(),
        status: "OPEN",
      },
    });

    // Drain any call-center orders that were queued while no shift was open
    // (Q16-B). Runs in its own transaction so a failure here can't roll back
    // the successful shift-start.
    try {
      await prisma.$transaction(async (tx) => {
        await drainPendingForBranch(tx, { branchId: newShift.branchId });
      });
    } catch (drainErr) {
      console.error("[SHIFT] drainPendingForBranch failed:", drainErr.message);
    }

    res.status(201).json(newShift);
  } catch (error) {
    next(error);
  }
});

// End an existing shift (Blind Close)
router.post("/end", async (req, res, next) => {
  try {
    const { shiftId, actualCash } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: "Shift ID is required" });
    }

    if (actualCash === undefined || actualCash === null) {
      return res.status(400).json({ error: "Actual cash amount is required" });
    }

    // Verify the requesting user owns this shift (or has manager access)
    const shiftToEnd = await prisma.shift.findUnique({
      where: { id: parseInt(shiftId) },
      include: { branch: true },
    });
    if (!shiftToEnd) {
      return res.status(404).json({ error: "Shift not found" });
    }
    // Only a live shift can be closed. Without this guard a PENDING_REVIEW shift
    // could be re-closed (silently overwriting its counted cash and variance) and
    // an already-CLOSED shift could be pushed back to PENDING_REVIEW while
    // keeping a stale reviewer — an un-audited reopen that bypasses every
    // eligibility check on PATCH /:id/reopen. Reopening is that route's job, and
    // only from PENDING_REVIEW: approval is terminal.
    if (shiftToEnd.status !== "OPEN") {
      return res.status(400).json({
        error: `Cannot end a shift with status: ${shiftToEnd.status}`,
        message:
          shiftToEnd.status === "CLOSED"
            ? "هذه الوردية تم اعتمادها وإغلاقها نهائياً"
            : "هذه الوردية بانتظار موافقة المدير بالفعل",
      });
    }

    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true, accessibleBranches: { select: { id: true } } },
    });
    const isManager = isShiftApprovalRole(requestingUser.role.name);
    const ownsShift = shiftToEnd.userId === req.user.id;
    if (!ownsShift && !isManager) {
      return res.status(403).json({
        error: "Access denied. You can only end your own shift.",
        message: "عذراً، لا يمكنك إنهاء وردية موظف آخر",
      });
    }

    // Calculate system expected cash and breakdown
    const {
      expected: systemExpectedCash,
      cashSales,
      posCash,
      codDeliveredThisShift,
      codPendingExcluded,
      cashExpenses,
      advances,
      pilotSettlementDifference,
      startCash,
      expectedVisa,
      expectedInstapay,
    } = await calculateSystemExpectedCash(parseInt(shiftId));
    const actualCashValue = parseFloat(actualCash);

    // Round to 2 decimals to avoid floating point issues
    const shortage =
      Math.round((actualCashValue - systemExpectedCash) * 100) / 100;

    // Update shift to PENDING_REVIEW (not CLOSED yet - needs manager approval)
    const updatedShift = await prisma.shift.update({
      where: { id: parseInt(shiftId) },
      data: {
        endTime: new Date(),
        endCash: actualCashValue, // This is what will carry to next shift
        systemExpectedCash: systemExpectedCash,
        actualCash: actualCashValue,
        shortage: shortage,
        expectedVisa: expectedVisa,
        expectedInstapay: expectedInstapay,
        status: "PENDING_REVIEW",
      },
    });

    // Check for pending delivery orders (WARNING, not blocking)
    const pendingDeliveryOrders = await prisma.sale.findMany({
      where: {
        shiftId: parseInt(shiftId),
        deliveryStatus: "OUT_FOR_DELIVERY",
      },
      include: {
        deliveryMan: { select: { id: true, name: true } },
      },
    });

    // Group by delivery man
    const deliveryWarnings = [];
    if (pendingDeliveryOrders.length > 0) {
      const grouped = {};
      pendingDeliveryOrders.forEach((order) => {
        const driverId = order.deliveryMan?.id || "unknown";
        const driverName = order.deliveryMan?.name || "Unknown";
        if (!grouped[driverId]) {
          grouped[driverId] = {
            driverId,
            driverName,
            orderCount: 0,
            totalAmount: 0,
          };
        }
        grouped[driverId].orderCount++;
        grouped[driverId].totalAmount += parseFloat(order.total || 0);
      });
      deliveryWarnings.push(...Object.values(grouped));
    }

    // Return extended info for frontend
    res.json({
      ...updatedShift,
      calculationBreakdown: {
        startCash,
        cashSales,
        posCash,
        codDeliveredThisShift,
        codPendingExcluded,
        cashExpenses,
        advances,
        pilotSettlementDifference,
        systemExpectedCash,
        expectedVisa,
        expectedInstapay,
      },
      deliveryWarnings: deliveryWarnings.length > 0 ? deliveryWarnings : null,
      hasPendingDeliveries: deliveryWarnings.length > 0,
    });
  } catch (error) {
    next(error);
  }
});

// Approve/Close a shift (Manager only)
router.post("/approve", async (req, res, next) => {
  try {
    const { shiftId, managerUsername, managerPassword } = req.body;

    if (!shiftId || !managerUsername || !managerPassword) {
      return res.status(400).json({
        error: "Shift ID, manager username, and password are required",
      });
    }

    // Find the shift
    const shift = await prisma.shift.findUnique({
      where: { id: parseInt(shiftId) },
      include: { branch: true },
    });

    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }

    // Validate shift status - must be PENDING_REVIEW
    if (shift.status !== "PENDING_REVIEW") {
      return res.status(400).json({
        error: `Cannot approve shift with status: ${shift.status}`,
        message:
          shift.status === "CLOSED"
            ? "هذه الوردية تم إغلاقها بالفعل"
            : "هذه الوردية لا تحتاج موافقة حالياً",
      });
    }

    // CHECK FOR PENDING DELIVERY SETTLEMENTS
    const pendingDeliveryOrders = await prisma.sale.findMany({
      where: {
        shiftId: parseInt(shiftId),
        deliveryStatus: "OUT_FOR_DELIVERY",
      },
      include: {
        deliveryMan: { select: { name: true } },
      },
    });

    if (pendingDeliveryOrders.length > 0) {
      const pendingDetails = pendingDeliveryOrders.map((order) => ({
        saleNumber: order.saleNumber,
        deliveryMan: order.deliveryMan?.name || "Unknown",
        amount: order.total,
      }));

      return res.status(400).json({
        error: "Cannot close shift. There are pending delivery orders.",
        message: `لا يمكن إغلاق الوردية. يوجد ${pendingDeliveryOrders.length} طلبات توصيل معلقة (خرجت ولم يتم تسويتها).`,
        pendingCount: pendingDeliveryOrders.length,
        pendingOrders: pendingDetails,
      });
    }

    // Authenticate + authorize the approving manager. Shared with the reopen
    // route so the two operations can never drift apart on who may act.
    const manager = await verifyShiftManager(
      managerUsername,
      managerPassword,
      shift,
    );

    // Close the shift
    const closedShift = await prisma.shift.update({
      where: { id: parseInt(shiftId) },
      data: {
        status: "CLOSED",
        reviewedById: manager.id,
        reviewedAt: new Date(),
      },
      include: {
        user: true,
        reviewedBy: true,
        branch: true,
      },
    });

    res.json(closedShift);
  } catch (error) {
    next(error);
  }
});

/**
 * Send a shift awaiting review back to OPEN *without* approving it, so its own
 * cashier can resume selling under the SAME shift record.
 *
 * This is the second of the two actions available to a shift approver while a
 * shift sits in PENDING_REVIEW — the alternative to POST /approve:
 *
 *   OPEN → /end → PENDING_REVIEW ─┬─ /approve      → CLOSED  (terminal)
 *                                 └─ /:id/reopen   → OPEN    (sell more, /end again)
 *
 * The PENDING_REVIEW → OPEN → PENDING_REVIEW loop may run any number of times
 * until the shift is finally approved. A CLOSED shift is NOT reopenable here:
 * approval is the end of the shift's life.
 *
 * Access is intentionally identical to POST /approve — same verifyShiftManager
 * helper, no module permission — so whoever may confirm a shift may reopen one.
 *
 * PATCH (not POST) on purpose: middleware/auditCapture.js only fetches the
 * before-state for PUT/PATCH/DELETE, so the closing figures this route discards
 * are captured into audit_logs.old_values automatically.
 *
 * Nothing financial is posted at shift open/close — shift figures are derived
 * from the sales/expenses/advances relations, never written as ledger rows — so
 * clearing the closing snapshot cannot double-count money or stock. Sales are
 * never touched: they keep their shiftId, and new sales get the same one.
 */
router.patch("/:id/reopen", async (req, res, next) => {
  try {
    const shiftId = parseInt(req.params.id);
    const { managerUsername, managerPassword, reason } = req.body;

    if (!shiftId || Number.isNaN(shiftId)) {
      return res.status(400).json({
        error: "Shift ID is required",
        message: "رقم الوردية مطلوب",
      });
    }

    const trimmedReason = (reason || "").trim();
    if (trimmedReason.length < MIN_REOPEN_REASON_LENGTH) {
      return res.status(400).json({
        error: `A reason of at least ${MIN_REOPEN_REASON_LENGTH} characters is required to reopen a shift`,
        message: `يجب كتابة سبب إعادة الفتح (${MIN_REOPEN_REASON_LENGTH} أحرف على الأقل)`,
      });
    }

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { user: { select: { id: true, name: true, isActive: true } } },
    });

    if (!shift) {
      return res.status(404).json({
        error: "Shift not found",
        message: "الوردية غير موجودة",
      });
    }

    // Only a shift awaiting review can be sent back to OPEN. An already-approved
    // (CLOSED) shift is history — its figures have been signed off and may
    // already be feeding the next shift's opening cash — so it is out of scope
    // for this workflow.
    if (shift.status !== "PENDING_REVIEW") {
      return res.status(400).json({
        error: `Cannot reopen a shift with status: ${shift.status}`,
        message:
          shift.status === "OPEN"
            ? "هذه الوردية مفتوحة بالفعل"
            : "هذه الوردية تم اعتمادها وإغلاقها نهائياً، لا يمكن إعادة فتحها",
      });
    }

    // The caller must be able to see this branch at all (read-side ACL), before
    // we tell them anything about the shift's eligibility.
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    if (branchFilter) {
      const allowedIds = branchFilter.id?.in || [branchFilter.id];
      if (!allowedIds.includes(shift.branchId)) {
        return res.status(403).json({
          error: "Access denied. You cannot manage shifts in this branch.",
          message: "عذراً، ليس لديك صلاحية لإدارة ورديات هذا الفرع",
        });
      }
    }

    // The owning cashier must still be able to log in and sell.
    if (!shift.user?.isActive) {
      return res.status(400).json({
        error: "The cashier who owns this shift is no longer active",
        message: "حساب الموظف صاحب الوردية غير مفعّل، لا يمكن إعادة فتح الوردية",
      });
    }

    // There is deliberately NO age cap here. The old CLOSED → OPEN version had
    // one, bounded by UNCLOSED_SHIFT_LOOKBACK_HOURS, to stop a reopened shift
    // from slipping past the one-shift-per-branch blocker in POST /start. That
    // blocker matches OPEN *and* PENDING_REVIEW, so a shift awaiting review
    // already blocks /start exactly as much as the OPEN shift it becomes — the
    // cap could not prevent anything. Overlap with LATER shifts, the concern that
    // actually survives, is handled by the newer-shift guard below.

    // Authenticate + authorize the manager BEFORE the transaction, so a failed
    // credential check never holds a write lock.
    const manager = await verifyShiftManager(
      managerUsername,
      managerPassword,
      shift,
    );

    // Re-check the collision guards inside the transaction and write in one go,
    // so two concurrent reopens (or a reopen racing a POST /start) cannot both
    // succeed and leave the branch with two live shifts.
    const reopenedShift = await prisma.$transaction(async (tx) => {
      const fresh = await tx.shift.findUnique({ where: { id: shiftId } });
      if (!fresh || fresh.status !== "PENDING_REVIEW") {
        throw Object.assign(new Error("تم تغيير حالة الوردية، أعد المحاولة"), {
          status: 409,
          error: "Shift status changed while reopening. Please retry.",
        });
      }

      // Must be the branch's most recent shift, because two of this shift's
      // figures are attributed by TIME WINDOW rather than by shiftId: driver
      // DUES_PAYOUT in calculateSystemExpectedCash, and deposits in
      // GET /:id/report. Both span [startTime, endTime || now]. Reopening a shift
      // that later shifts have already run past would stretch that window across
      // them and charge their payouts against this drawer twice.
      //
      // (This guard used to be justified by the rolling-cash chain — a later
      // shift having inherited this one's endCash as its startCash. That does not
      // apply here: the lookup in POST /start reads status CLOSED only, so a
      // PENDING_REVIEW shift is never a rolling-balance source.)
      const newerShift = await tx.shift.findFirst({
        where: {
          branchId: fresh.branchId,
          id: { not: shiftId },
          startTime: { gte: fresh.startTime },
        },
        include: { user: { select: { name: true } } },
        orderBy: { startTime: "desc" },
      });

      if (newerShift) {
        throw Object.assign(
          new Error(
            `لا يمكن إعادة فتح الوردية: توجد وردية أحدث (#${newerShift.id}) للموظف ${newerShift.user?.name || "غير معروف"} في هذا الفرع`,
          ),
          {
            status: 400,
            error:
              "Cannot reopen: a newer shift already exists for this branch.",
          },
        );
      }

      // One live shift per branch (mirrors the POST /start blocker).
      const blockingBranchShift = await tx.shift.findFirst({
        where: {
          branchId: fresh.branchId,
          id: { not: shiftId },
          status: { in: ["OPEN", "PENDING_REVIEW"] },
        },
        include: { user: { select: { name: true } } },
      });

      if (blockingBranchShift) {
        throw Object.assign(
          new Error(
            `لا يمكن إعادة فتح الوردية: يوجد وردية غير مغلقة للموظف ${blockingBranchShift.user?.name || "غير معروف"} في هذا الفرع`,
          ),
          {
            status: 400,
            error:
              "Cannot reopen: this branch already has an unclosed shift.",
          },
        );
      }

      // The cashier must not already hold another OPEN shift anywhere, or POS
      // would have two candidates for the same user.
      const cashierOtherShift = await tx.shift.findFirst({
        where: {
          userId: fresh.userId,
          id: { not: shiftId },
          status: "OPEN",
        },
      });

      if (cashierOtherShift) {
        throw Object.assign(
          new Error(
            `لا يمكن إعادة فتح الوردية: الموظف لديه وردية مفتوحة أخرى (#${cashierOtherShift.id})`,
          ),
          {
            status: 400,
            error: "Cannot reopen: the cashier already has another open shift.",
          },
        );
      }

      // Clear the ENTIRE closing snapshot — every field POST /end writes — so
      // the next /end recomputes it from scratch over the whole shift. The
      // discarded values live on in audit_logs.old_values.
      //
      //   endTime            MUST be nulled. calculateSystemExpectedCash bounds
      //                      its DUES_PAYOUT window at `endTime || now` (and the
      //                      report does the same for deposits). Left at the
      //                      first close, the SECOND close would silently miss
      //                      every payout made during the reopened period.
      //   endCash            Rolling-balance source for the next shift's
      //                      startCash; must not read as a finished count.
      //   actualCash,        The discarded blind count and its variance. /end
      //   systemExpectedCash overwrites them anyway, but an OPEN shift that still
      //   shortage           reports a stale shortage is a lie to the report.
      //   expectedVisa,      Same; the report falls back to live sums when null.
      //   expectedInstapay
      //   reviewedById,      Already null on a PENDING_REVIEW row (only /approve
      //   reviewedAt         sets them) — nulled anyway to hold the invariant
      //                      "a non-CLOSED shift has no reviewer".
      //
      // Preserved on purpose: startCash / startTime / type / userId / branchId.
      // They are this shift's identity and history, and startCash is the anchor
      // the re-close builds expected cash on top of. Recalculation covers ALL
      // cycles because the sales/expenses/employeeTransactions relations are
      // scoped by shiftId with no time filter — nothing is "since reopen".
      return tx.shift.update({
        where: { id: shiftId },
        data: {
          status: "OPEN",
          endTime: null,
          endCash: null,
          actualCash: null,
          systemExpectedCash: null,
          shortage: null,
          expectedVisa: null,
          expectedInstapay: null,
          reviewedById: null,
          reviewedAt: null,
        },
        include: {
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      });
    });

    console.log(
      `[SHIFT] Shift #${shiftId} reopened by ${manager.username} (${manager.role}) — reason: ${trimmedReason}`,
    );

    res.json({
      ...reopenedShift,
      reopenedBy: { id: manager.id, username: manager.username },
      reason: trimmedReason,
    });
  } catch (error) {
    next(error);
  }
});

// Get active shift for a user
router.get("/active/:userId", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);

    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: userId,
        status: "OPEN",
      },
      // Deterministic pick. A reopened shift keeps its original startTime, so if
      // a stale OPEN shift ever coexists with it, always resolve to the newest.
      orderBy: { startTime: "desc" },
    });

    if (!activeShift) {
      return res.json(null);
    }

    res.json(activeShift);
  } catch (error) {
    next(error);
  }
});

// Get pending shift for a branch (for manager review)
router.get("/pending/:branchId", async (req, res, next) => {
  try {
    const branchId = parseInt(req.params.branchId);

    // Validate branch access
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    if (branchFilter) {
      const allowedIds = branchFilter.id.in || [branchFilter.id];
      if (!allowedIds.includes(branchId)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Check for ANY blocking shift (OPEN or PENDING_REVIEW)
    // This allows frontend to see if someone else has an open shift
    const blockingShift = await prisma.shift.findFirst({
      where: {
        branchId: branchId,
        status: { in: ["OPEN", "PENDING_REVIEW"] },
      },
      include: {
        user: true,
        branch: true,
      },
      orderBy: { startTime: "desc" },
    });

    res.json(blockingShift);
  } catch (error) {
    next(error);
  }
});

// Get Shift Report - Requires POS or REPORTS permission
router.get(
  "/:id/report",
  requireAnyPermission(["POS", "REPORTS"]),
  async (req, res, next) => {
    try {
      const shiftId = parseInt(req.params.id);

      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
          user: true,
          branch: true,
          reviewedBy: true,
          expenses: {
            include: { category: { select: { id: true, name: true } } }
          },
          employeeTransactions: {
            where: { type: "ADVANCE" },
            include: { employee: { select: { id: true, name: true } } },
          },
        },
      });

      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      // Validate Branch Access for Report
      // Fetch user with role and accessible branches to verify access
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          role: true,
          accessibleBranches: {
            select: { id: true },
          },
        },
      });

      // A shift permanently records the branch it was OPENED in, but
      // `user.branchId` reflects the user's CURRENT assignment. Those diverge
      // the moment an employee is moved between branches, which locked them out
      // of the report for their own shift — including the one they are standing
      // at the register running right now.
      //
      // Owning the shift is a strictly stronger claim than sharing its branch:
      // it is the operator's own record, so it is checked first. The branch and
      // global-role checks below are unchanged, so access to OTHER people's
      // shifts is still restricted to the user's own branch(es).
      const ownsShift = shift.userId === user.id;

      const canAccessReport =
        ownsShift ||
        user.branchId === shift.branchId ||
        (user.accessibleBranches &&
          user.accessibleBranches.some((b) => b.id === shift.branchId)) ||
        // Global roles can access all branches
        bypassesShiftBranchScope(user.role?.name);

      if (!canAccessReport) {
        return res.status(403).json({
          error: "Access denied. You cannot view reports for this branch.",
        });
      }

      // Aggregate Sales Data (exclude voided sales from all totals)
      const sales = await prisma.sale.findMany({
        where: {
          shiftId: shiftId,
          status: "COMPLETED",
          isVoided: false,
        },
        include: {
          client: { select: { name: true } }, // Include Client Name
          deliveryMan: { select: { name: true } }, // Include Delivery Man Name
          order: { select: { status: true } }, // S6: gate COD cash on DELIVERED
          items: {
            include: {
              item: {
                include: {
                  categories: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
              bom: {
                include: {
                  categories: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" }, // Order by latest first
      });

      // Calculate Totals
      let totalSales = 0;
      let cashSales = 0;
      let cardSales = 0;
      let visaSales = 0;
      let instapaySales = 0;
      let posCashReport = 0;
      let codDeliveredReport = 0;
      let codPendingReport = 0;
      let takeawayCount = 0, takeawayTotal = 0;
      let deliveryCount = 0, deliveryTotal = 0;
      let returnCount = 0, returnTotal = 0;
      let discountCount = 0, discountTotal = 0;
      const discountByReasonMap = new Map();
      const itemsMap = new Map();

      // Map sales to simplified orders format
      const orders = sales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        time: sale.createdAt,
        total: parseFloat(sale.total),
        paymentMethod: sale.paymentMethod,
        clientName: sale.client ? sale.client.name : "عميل نقدي",
        discountAmount: sale.discountAmount != null ? parseFloat(sale.discountAmount) : 0,
        discountReason: sale.discountReason || null,
      }));

      sales.forEach((sale) => {
        const saleTotal = parseFloat(sale.total);
        // Refunds are stored as negative COMPLETED sales (saleNumber "REFUND-…").
        // They must stay in the cash/card reconciliation sums below (a cash
        // refund really does leave the drawer), but they are NOT gross sales —
        // so they are excluded from totalSales / takeaway / delivery / item
        // details and instead surfaced on their own "returns" line.
        const isRefund = (sale.saleNumber || "").startsWith("REFUND-");
        if (isRefund) {
          returnCount += 1;
          returnTotal += Math.abs(saleTotal);
        } else {
          totalSales += saleTotal;
        }

        const discAmt = sale.discountAmount != null ? parseFloat(sale.discountAmount) : 0;
        if (discAmt > 0) {
          discountCount += 1;
          discountTotal += discAmt;
          const reason = sale.discountReason || "OTHER";
          const bucket = discountByReasonMap.get(reason) || { count: 0, total: 0 };
          bucket.count += 1;
          bucket.total += discAmt;
          discountByReasonMap.set(reason, bucket);
        }

        const paymentMethod = sale.paymentMethod;
        if (paymentMethod === "CASH") {
          if (!sale.deliveryManId) {
            // Walk-in / pickup cash — no driver involved, drawer at sale time.
            posCashReport += saleTotal;
            cashSales += saleTotal;
          } else if (sale.deliveryStatus === "DELIVERED") {
            // Settlement (or mark-delivered) flipped deliveryStatus → cash is
            // now in the drawer. Driver keeps their share; only (total − share)
            // physically returns to the cashier.
            const driverShare = parseFloat(sale.deliveryDriverShare) || 0;
            const netAmount = saleTotal - driverShare;
            codDeliveredReport += netAmount;
            cashSales += netAmount;
          } else {
            // In-flight COD: attributed to this shift but not yet in the drawer.
            codPendingReport += saleTotal;
          }
        } else {
          cardSales += saleTotal;
          if (paymentMethod === "VISA") visaSales += saleTotal;
          else if (paymentMethod === "INSTAPAY") instapaySales += saleTotal;
        }

        // Breakdown by type: takeaway vs delivery — gross only (refunds are
        // reported separately on the returns line, and a refund row has no
        // deliveryManId so it would otherwise inflate the takeaway count).
        if (!isRefund) {
          if (sale.deliveryManId) {
            deliveryCount++;
            deliveryTotal += saleTotal;
          } else {
            takeawayCount++;
            takeawayTotal += saleTotal;
          }
        }

        // Aggregate Items (gross only — skip refund lines)
        if (!isRefund) sale.items.forEach((saleItem) => {
          let itemKey = "Unknown";
          let categoryName = "أخرى";
          let itemName = "Unknown Item";

          if (saleItem.item) {
            itemKey = saleItem.item.name;
            itemName = saleItem.item.name;
            categoryName =
              saleItem.item.categories.length > 0
                ? saleItem.item.categories[0].category.name
                : "أخرى";
          } else if (saleItem.bom) {
            itemKey = saleItem.bom.name;
            itemName = saleItem.bom.name;
            categoryName =
              saleItem.bom.categories.length > 0
                ? saleItem.bom.categories[0].category.name
                : "أخرى";
          }

          if (!itemsMap.has(itemKey)) {
            itemsMap.set(itemKey, {
              type: categoryName,
              name: itemName,
              count: 0,
              total: 0,
            });
          }

          const existing = itemsMap.get(itemKey);
          existing.count += parseFloat(saleItem.quantity);
          existing.total += parseFloat(saleItem.total);
        });
      });

      // Delivery Breakdown
      const deliveryMap = new Map();
      sales.forEach((sale) => {
        if (sale.deliveryManId && sale.deliveryMan) {
          const key = sale.deliveryMan.name;
          if (!deliveryMap.has(key)) {
            deliveryMap.set(key, {
              name: key, // Delivery Man Name
              count: 0,
              total: 0,
              paidCount: 0, // Delivered/Settled
              pendingCount: 0, // Out for delivery
            });
          }
          const stats = deliveryMap.get(key);
          stats.count += 1;
          stats.total += parseFloat(sale.total); // sale.total already includes deliveryFee

          if (sale.deliveryStatus === "DELIVERED") {
            stats.paidCount += 1;
          } else {
            stats.pendingCount += 1;
          }
        }
      });
      const deliveryDetails = Array.from(deliveryMap.values());

      const salesDetails = Array.from(itemsMap.values());

      // Returns (returnCount / returnTotal) are accumulated in the sales loop
      // above from refund rows (negative COMPLETED "REFUND-…" sales). The old
      // status:"CANCELLED" query never matched a refund, so this line always
      // read 0.

      // Calculate expenses
      let totalExpenses = 0;
      let cashExpenseCount = 0;
      let cashExpenseTotal = 0;
      shift.expenses.forEach((expense) => {
        const amt = parseFloat(expense.amount);
        totalExpenses += amt;
        if (expense.paymentMethod === "CASH") {
          cashExpenseCount++;
          cashExpenseTotal += amt;
        }
      });

      // Calculate employee advances (cash out of the drawer during the shift)
      let totalAdvances = 0;
      let advanceCount = 0;
      shift.employeeTransactions.forEach((t) => {
        totalAdvances += parseFloat(t.amount);
        advanceCount++;
      });

      // Query deposits during this shift's time range for the branch treasury
      let depositCount = 0;
      let depositTotal = 0;
      if (shift.branch?.treasuryId && shift.startTime) {
        const endFilter = shift.endTime || new Date();
        const deposits = await prisma.deposit.findMany({
          where: {
            treasuryId: shift.branch.treasuryId,
            createdAt: {
              gte: shift.startTime,
              lte: endFilter,
            },
          },
        });
        deposits.forEach((d) => {
          depositCount++;
          depositTotal += parseFloat(d.amount);
        });
      }

      // Driver ("pilot") InstaPay dues paid out of the drawer this shift.
      // Recomputed live from the DUES_PAYOUT ledger (branch + shift window),
      // matching the subtraction baked into the stored systemExpectedCash at
      // close. See calculateSystemExpectedCash for the rationale.
      let pilotSettlementDifference = 0;
      if (shift.startTime && shift.branchId) {
        const endFilter = shift.endTime || new Date();
        const duesAgg = await prisma.deliveryManTransaction.aggregate({
          where: {
            type: "DUES_PAYOUT",
            createdAt: { gte: shift.startTime, lte: endFilter },
            deliveryMan: { branchId: shift.branchId },
          },
          _sum: { amount: true },
        });
        pilotSettlementDifference = Math.round(Number(duesAgg._sum.amount || 0) * 100) / 100;
      }

      // netSales = gross sales − returns (takeaway/delivery are already gross).
      const netSales = Math.round((takeawayTotal + deliveryTotal - returnTotal) * 100) / 100;
      // drawerAmount uses the SAME reconciled formula as systemExpectedCash so
      // the report's "المبلغ في الدرج" agrees with "المتوقع في الدرج". The old
      // formula added depositTotal, which double-counted driver-settlement
      // deposits (that cash is already in cashSales via codDelivered). Manual
      // deposits/withdrawals during a shift are intentionally NOT folded in yet
      // (scope: driver dues only) — the `deposits` field is returned for info.
      const drawerAmount = Math.round(
        ((parseFloat(shift.startCash) || 0) + cashSales - cashExpenseTotal - totalAdvances - pilotSettlementDifference) * 100
      ) / 100;

      const report = {
        shiftId: shift.id,
        shiftType: shift.type,
        branchName: shift.branch?.name,
        employeeName: shift.user.name,
        shiftName: shift.type === "MORNING" ? "وردية صباحية" : "وردية مسائية",
        date: shift.startTime,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: shift.status,

        // Cash tracking
        startCash: parseFloat(shift.startCash) || 0,
        endCash: parseFloat(shift.endCash) || 0,
        systemExpectedCash: parseFloat(shift.systemExpectedCash) || 0,
        actualCash: parseFloat(shift.actualCash) || 0,
        shortage: parseFloat(shift.shortage) || 0,

        // Sales
        totalSales,
        cashReceived: cashSales,
        cardPayments: cardSales,
        visaPayments: Math.round(visaSales * 100) / 100,
        instapayPayments: Math.round(instapaySales * 100) / 100,
        expectedVisa: shift.expectedVisa != null ? parseFloat(shift.expectedVisa) : Math.round(visaSales * 100) / 100,
        expectedInstapay: shift.expectedInstapay != null ? parseFloat(shift.expectedInstapay) : Math.round(instapaySales * 100) / 100,
        cashBreakdown: {
          posCash: Math.round(posCashReport * 100) / 100,
          codDeliveredThisShift: Math.round(codDeliveredReport * 100) / 100,
          codPendingExcluded: Math.round(codPendingReport * 100) / 100,
        },
        salesDetails: salesDetails,
        deliveryDetails: deliveryDetails,
        orders: orders,

        // Sales breakdown by type
        takeaway: { count: takeawayCount, total: Math.round(takeawayTotal * 100) / 100 },
        delivery: { count: deliveryCount, total: Math.round(deliveryTotal * 100) / 100 },
        returned: { count: returnCount, total: Math.round(returnTotal * 100) / 100 },
        netSales,

        // Cash movements
        deposits: { count: depositCount, total: Math.round(depositTotal * 100) / 100 },
        expenseBreakdown: { count: cashExpenseCount, total: Math.round(cashExpenseTotal * 100) / 100 },
        pilotSettlementDifference,
        drawerAmount,

        // Discounts applied during this shift
        discounts: {
          count: discountCount,
          total: Math.round(discountTotal * 100) / 100,
          byReason: Array.from(discountByReasonMap.entries()).map(([code, v]) => ({
            code,
            count: v.count,
            total: Math.round(v.total * 100) / 100,
          })),
        },

        // Expenses
        totalExpenses,
        expenses: shift.expenses.map((e) => ({
          description: e.description,
          amount: parseFloat(e.amount),
          paymentMethod: e.paymentMethod,
        })),

        // Employee advances (cash handed out during this shift)
        totalAdvances: Math.round(totalAdvances * 100) / 100,
        advanceBreakdown: {
          count: advanceCount,
          total: Math.round(totalAdvances * 100) / 100,
        },
        advances: shift.employeeTransactions.map((t) => ({
          employeeName: t.employee?.name || "—",
          amount: parseFloat(t.amount),
          reason: t.reason || "",
        })),

        // Review info
        reviewedBy: shift.reviewedBy ? shift.reviewedBy.name : null,
        reviewedAt: shift.reviewedAt,
      };

      res.json(report);
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
