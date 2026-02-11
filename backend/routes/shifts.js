const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const {
  authenticateToken,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");

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

      // Filter by Branch
      if (branchId && branchId !== "all") {
        whereClause.branchId = parseInt(branchId);
      } else {
        // Enforce branch access if not filtering by specific branch
        const branchFilter = await getUserBranchFilter(req.user.id);
        if (branchFilter) {
          if (branchFilter.id.in) {
            // Multi-branch user (e.g., General Manager)
            whereClause.branchId = { in: branchFilter.id.in };
          } else {
            // Single-branch user
            whereClause.branchId = branchFilter.id;
          }
        }
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
      },
      expenses: true,
    },
  });

  if (!shift) return { expected: 0, cashSales: 0, cashExpenses: 0 };

  // Start with opening cash
  let startCash = parseFloat(shift.startCash) || 0;
  let expected = startCash;
  let cashSales = 0;
  let cashExpenses = 0;

  // Add cash sales only (card sales don't go in drawer)
  shift.sales.forEach((sale) => {
    if (sale.paymentMethod === "CASH") {
      const amount = parseFloat(sale.paidAmount) || 0;
      cashSales += amount;
      expected += amount;
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

  // Round to 2 decimal places to avoid floating point issues
  return {
    expected: Math.round(expected * 100) / 100,
    cashSales: Math.round(cashSales * 100) / 100,
    cashExpenses: Math.round(cashExpenses * 100) / 100,
    startCash: Math.round(startCash * 100) / 100,
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
    const branchFilter = await getUserBranchFilter(req.user.id);
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

    // Calculate system expected cash and breakdown
    const {
      expected: systemExpectedCash,
      cashSales,
      cashExpenses,
      startCash,
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
        status: "PENDING_REVIEW",
      },
    });

    // Return extended info for frontend
    res.json({
      ...updatedShift,
      calculationBreakdown: {
        startCash,
        cashSales,
        cashExpenses,
        systemExpectedCash,
      },
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
      manager.role.name === "Superadmin"; // Superadmin can access all

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
    const branchFilter = await getUserBranchFilter(req.user.id);
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

      // Aggregate Sales Data
      const sales = await prisma.sale.findMany({
        where: {
          shiftId: shiftId,
          status: "COMPLETED",
        },
        include: {
          client: { select: { name: true } }, // Include Client Name
          deliveryMan: { select: { name: true } }, // Include Delivery Man Name
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
      const itemsMap = new Map();

      // Map sales to simplified orders format
      const orders = sales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        time: sale.createdAt,
        total: parseFloat(sale.total),
        paymentMethod: sale.paymentMethod,
        clientName: sale.client ? sale.client.name : "عميل نقدي",
      }));

      sales.forEach((sale) => {
        totalSales += parseFloat(sale.total);

        const paymentMethod = sale.paymentMethod;
        if (paymentMethod === "CASH") {
          cashSales += parseFloat(sale.total);
        } else {
          cardSales += parseFloat(sale.total);
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
          stats.total += parseFloat(sale.deliveryFee || 0); // OR Total sale amount? User likely wants Total Cash collected.
          // User: "delivery order numbers and it's amount details" -> likely Total Amount (Order + Fee)
          // Let's assume Total Sale Amount for now as that's what constitutes the debt.
          stats.total += parseFloat(sale.total);

          if (sale.deliveryStatus === "DELIVERED") {
            stats.paidCount += 1;
          } else {
            stats.pendingCount += 1;
          }
        }
      });
      const deliveryDetails = Array.from(deliveryMap.values());

      const salesDetails = Array.from(itemsMap.values());

      // Calculate expenses
      let totalExpenses = 0;
      shift.expenses.forEach((expense) => {
        totalExpenses += parseFloat(expense.amount);
      });

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
        salesDetails: salesDetails,
        deliveryDetails: deliveryDetails, // Add Delivery Breakdown
        orders: orders, // Add Orders History

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
