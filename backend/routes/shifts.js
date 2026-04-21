const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const {
  authenticateToken,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");
const { drainPendingForBranch } = require("../lib/orderService");

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
        where: { status: "COMPLETED" },
        include: { order: { select: { status: true } } },
      },
      expenses: true,
    },
  });

  if (!shift) return { expected: 0, cashSales: 0, cashExpenses: 0, expectedVisa: 0, expectedInstapay: 0 };

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
  // S6: for sales linked to an Order (delivery flow), only count cash that's
  // actually in the drawer — i.e. Order.status === DELIVERED. Sales already
  // filter to this shift via the Shift.sales relation, so a row reaching us
  // with shiftId=current implicitly satisfies the "this shift" half of the
  // rule. In-flight COD stays attributed here but is excluded from expected.
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
    if (!sale.order) {
      // Walk-in POS cash — money in the drawer at sale time.
      posCash += amount;
      expected += amount;
      return;
    }
    if (sale.order.status === "DELIVERED") {
      codDeliveredThisShift += amount;
      expected += amount;
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

  const round = (n) => Math.round(n * 100) / 100;
  const cashSales = round(posCash + codDeliveredThisShift);
  return {
    expected: round(expected),
    cashSales,
    posCash: round(posCash),
    codDeliveredThisShift: round(codDeliveredThisShift),
    codPendingExcluded: round(codPendingExcluded),
    cashExpenses: round(cashExpenses),
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

    // Check for RECENT unclosed shifts (last 48 hours to handle overnight shifts)
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

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
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true, accessibleBranches: { select: { id: true } } },
    });
    const isManager =
      requestingUser.role.name === "Superadmin" ||
      requestingUser.role.name === "Admin" ||
      requestingUser.role.name === "Manager" ||
      requestingUser.role.name === "Branch Manager" ||
      requestingUser.role.name === "General Manager";
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

    // Authenticate the manager
    const manager = await prisma.user.findUnique({
      where: { username: managerUsername },
      include: {
        role: true,
        accessibleBranches: {
          select: { id: true },
        },
      },
    });

    if (!manager) {
      return res.status(401).json({
        error: "Invalid manager credentials",
        message: "اسم المستخدم أو كلمة المرور للمدير غير صحيحة",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      managerPassword,
      manager.password,
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid manager credentials",
        message: "اسم المستخدم أو كلمة المرور للمدير غير صحيحة",
      });
    }

    // Verify manager has access to this branch
    const canAccessBranch =
      manager.branchId === shift.branchId ||
      (manager.accessibleBranches &&
        manager.accessibleBranches.some((b) => b.id === shift.branchId)) ||
      manager.role.name === "Superadmin" ||
      manager.role.name === "Admin" ||
      manager.role.name === "General Manager"; // Global roles can access all branches

    if (!canAccessBranch) {
      return res.status(403).json({
        error:
          "Access denied. You do not have permission to manage this branch.",
        message: "عذراً، ليس لديك صلاحية لإدارة هذا الفرع",
      });
    }

    // Verify manager has appropriate role (TODO: Add permission check if needed)
    // For now, assuming "Manager" role or Superadmin
    const isAuthorized =
      manager.role.name === "Superadmin" ||
      manager.role.name === "Manager" ||
      manager.role.name === "Branch Manager" ||
      manager.role.name === "Admin" ||
      manager.role.name === "General Manager";

    if (!isAuthorized) {
      return res.status(403).json({
        error: "Access denied. Only managers can approve shifts.",
        message: "عذراً، هذه العملية متاحة للمديرين فقط",
      });
    }

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

// Get active shift for a user
router.get("/active/:userId", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);

    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: userId,
        status: "OPEN",
      },
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
          expenses: true,
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

      // Check if user has access to this shift's branch
      const canAccessBranch =
        user.branchId === shift.branchId ||
        (user.accessibleBranches &&
          user.accessibleBranches.some((b) => b.id === shift.branchId)) ||
        user.role.name === "Superadmin" ||
        user.role.name === "General Manager"; // General Manager can access all branches

      if (!canAccessBranch) {
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
        totalSales += saleTotal;

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
          if (!sale.order) {
            posCashReport += saleTotal;
            cashSales += saleTotal;
          } else if (sale.order.status === "DELIVERED") {
            codDeliveredReport += saleTotal;
            cashSales += saleTotal;
          } else {
            // In-flight COD: attributed to this shift but not yet in the drawer.
            codPendingReport += saleTotal;
          }
        } else {
          cardSales += saleTotal;
          if (paymentMethod === "VISA") visaSales += saleTotal;
          else if (paymentMethod === "INSTAPAY") instapaySales += saleTotal;
        }

        // Breakdown by type: takeaway vs delivery
        if (sale.deliveryManId) {
          deliveryCount++;
          deliveryTotal += saleTotal;
        } else {
          takeawayCount++;
          takeawayTotal += saleTotal;
        }

        // Aggregate Items
        sale.items.forEach((saleItem) => {
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

      // Count returned/cancelled sales for this shift
      const cancelledSales = await prisma.sale.findMany({
        where: {
          shiftId: shiftId,
          status: "CANCELLED",
        },
      });
      cancelledSales.forEach((s) => {
        returnCount++;
        returnTotal += parseFloat(s.total);
      });

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

      const netSales = Math.round((takeawayTotal + deliveryTotal) * 100) / 100;
      const drawerAmount = Math.round(
        ((parseFloat(shift.startCash) || 0) + cashSales - cashExpenseTotal + depositTotal) * 100
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
