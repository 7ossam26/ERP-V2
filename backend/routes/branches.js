const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireCreatePermission, getUserBranchFilter, requireAnyPermission, requireSensitiveAccess } = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET all branches
router.get("/", async (req, res, next) => {
  try {
    // Determine visibility based on user role/branch assignment
    // Fetch user with role to check if they should see all branches
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    // Build query
    const where = { isActive: true };

    // General Manager and Superadmin see ALL branches
    const canSeeAllBranches =
      user.role.name === "Superadmin" ||
      user.role.name === "Admin" ||
      user.role.name === "General Manager";

    // Apply branch filter only for non-global roles
    // NOTE: Don't pass req — ignore active branch header so the list
    // shows ALL accessible branches (used for dropdowns/selectors)
    if (!canSeeAllBranches) {
      const branchFilter = await getUserBranchFilter(req.user.id);
      if (branchFilter) {
        if (branchFilter.id.in) {
          // Multi-branch user
          where.id = { in: branchFilter.id.in };
        } else {
          // Single-branch user
          where.id = branchFilter.id;
        }
      }
    }

    const branches = await prisma.branch.findMany({
      where,
      include: {
        warehouse: true,
        treasury: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(branches);
  } catch (error) {
    next(error);
  }
});

// GET Financial Summary (Total Balance & Daily Change)
router.get("/summary", async (req, res, next) => {
  try {
    // 1. Get all branches with treasuries to calculate current total balance
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: { treasury: true },
    });

    const totalBalance = branches.reduce(
      (sum, branch) => sum + Number(branch.treasury?.balance || 0),
      0
    );

    // 2. Calculate Today's Net Change (Income - Expense) to derive Yesterday's Balance
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Income: Sum of 'paidAmount' from Sales created today
    // Note: Assuming Sales affect treasury directly via paidAmount
    const todaySales = await prisma.sale.aggregate({
      _sum: {
        paidAmount: true,
      },
      where: {
        createdAt: {
          gte: startOfDay,
        },
        status: { not: "CANCELLED" },
      },
    });

    const income = Number(todaySales._sum.paidAmount || 0);

    // Expense: Sum of 'paidAmount' from Purchases created today
    const todayPurchases = await prisma.purchase.aggregate({
      _sum: {
        paidAmount: true,
      },
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    });

    const expense = Number(todayPurchases._sum.paidAmount || 0);

    const netChange = income - expense;

    // 3. Calculate Yesterday's Balance and Percentage Change
    // CurrentBalance = YesterdayBalance + NetChange
    // YesterdayBalance = CurrentBalance - NetChange
    const yesterdayBalance = totalBalance - netChange;

    let percentageChange = 0;
    if (yesterdayBalance !== 0) {
      percentageChange = (netChange / yesterdayBalance) * 100;
    } else if (netChange > 0) {
      percentageChange = 100; // 0 to something is 100% growth effectively
    }

    res.json({
      totalBalance,
      percentageChange: percentageChange.toFixed(1), // Returns string "12.5"
      netChange,
    });
  } catch (error) {
    next(error);
  }
});

// GET branch balances — Cash treasury + today's INSTAPAY/VISA sales per branch + bank account balance
router.get("/balances", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    const canSeeAllBranches =
      user.role.name === "Superadmin" ||
      user.role.name === "Admin" ||
      user.role.name === "General Manager";

    const where = { isActive: true };
    if (!canSeeAllBranches) {
      // Don't pass req — show all accessible branches, not just the active one
      const branchFilter = await getUserBranchFilter(req.user.id);
      if (branchFilter) {
        where.id = branchFilter.id.in ? { in: branchFilter.id.in } : branchFilter.id;
      }
    }

    const branches = await prisma.branch.findMany({
      where,
      include: {
        treasury: { select: { balance: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Date range: accept ?from=YYYY-MM-DD&to=YYYY-MM-DD (server local tz).
    // Defaults to "today" when omitted. Sale.createdAt is stored in UTC but
    // comparisons here use the server's local-day boundaries which is acceptable
    // for Africa/Cairo (no DST) per Phase 5 spec.
    const parseDateStart = (s) => {
      const d = s ? new Date(s) : new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const parseDateEnd = (s) => {
      const d = s ? new Date(s) : new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    };
    const rangeStart = parseDateStart(req.query.from);
    const rangeEnd = parseDateEnd(req.query.to);

    const branchIds = branches.map((b) => b.id);

    // Aggregate digital sales per branch per method for the requested window
    const digitalSales = await prisma.sale.groupBy({
      by: ["branchId", "paymentMethod"],
      where: {
        paymentMethod: { in: ["INSTAPAY", "VISA"] },
        status: "COMPLETED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
        branchId: { in: branchIds },
      },
      _sum: { total: true },
    });
    const instapaySales = digitalSales.filter(
      (r) => r.paymentMethod === "INSTAPAY",
    );
    const visaSales = digitalSales.filter((r) => r.paymentMethod === "VISA");

    // Get Visa + Instapay treasury running balances from system config
    const sysConfig = await prisma.systemConfiguration.findFirst({
      select: { visaTreasuryId: true, instapayTreasuryId: true },
    });
    let visaTreasuryBalance = 0;
    let instapayTreasuryBalance = 0;
    if (sysConfig?.visaTreasuryId) {
      const t = await prisma.treasury.findUnique({
        where: { id: sysConfig.visaTreasuryId },
        select: { balance: true },
      });
      visaTreasuryBalance = Number(t?.balance || 0);
    }
    if (sysConfig?.instapayTreasuryId) {
      const t = await prisma.treasury.findUnique({
        where: { id: sysConfig.instapayTreasuryId },
        select: { balance: true },
      });
      instapayTreasuryBalance = Number(t?.balance || 0);
    }

    const instapayMap = {};
    instapaySales.forEach((row) => {
      instapayMap[row.branchId] = Number(row._sum.total || 0);
    });

    const visaMap = {};
    visaSales.forEach((row) => {
      visaMap[row.branchId] = Number(row._sum.total || 0);
    });

    const result = branches.map((branch) => {
      const cashBalance = Number(branch.treasury?.balance || 0);
      const visa = visaMap[branch.id] || 0;
      const instapay = instapayMap[branch.id] || 0;
      return {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        cashBalance,
        visa,
        instapay,
        total: Math.round((cashBalance + visa + instapay) * 100) / 100,
        treasuryName: branch.treasury?.name || "الخزينة",
        // Legacy fields — kept for backward compat with existing UI consumers.
        instapayToday: instapay,
        visaToday: visa,
        visaTreasuryBalance,
        instapayTreasuryBalance,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET branch by ID - Accessible if it matches user's branch or user has global access
router.get("/:id", async (req, res, next) => {
  try {
    const branchId = parseInt(req.params.id);

    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    if (!branch || !branch.isActive) {
      return res.status(404).json({ error: "Branch not found" });
    }
    res.json(branch);
  } catch (error) {
    next(error);
  }
});

// POST create new branch
router.post("/", requireCreatePermission("CREATES_BRANCHES"), async (req, res, next) => {
  try {
    const { name, address, warehouseId, treasuryId } = req.body;

    // Validate required fields
    if (!name || !address || !warehouseId || !treasuryId) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name, address, warehouseId, and treasuryId are required",
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        warehouseId: parseInt(warehouseId),
        treasuryId: parseInt(treasuryId),
      },
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    res.status(201).json(branch);
  } catch (error) {
    next(error);
  }
});

// PUT update branch - Requires SENSITIVE ACCESS
router.put("/:id", requireAnyPermission(["BRANCHES", "CREATES_BRANCHES"]), requireSensitiveAccess, async (req, res, next) => {
  try {
    const { name, address, warehouseId, treasuryId } = req.body;
    const branchId = parseInt(req.params.id);

    // Check if the treasury is already linked to a different branch
    if (treasuryId !== undefined) {
      const conflict = await prisma.branch.findFirst({
        where: {
          treasuryId: parseInt(treasuryId),
          id: { not: branchId },
        },
      });
      if (conflict) {
        return res.status(400).json({
          error: "Treasury already in use",
          message: `هذه الخزينة مرتبطة بالفرع "${conflict.name}" بالفعل. يرجى إلغاء ارتباطها أولاً.`,
        });
      }
    }

    // Check if the warehouse is already linked to a different branch
    if (warehouseId !== undefined) {
      const conflict = await prisma.branch.findFirst({
        where: {
          warehouseId: parseInt(warehouseId),
          id: { not: branchId },
        },
      });
      if (conflict) {
        return res.status(400).json({
          error: "Warehouse already in use",
          message: `هذا المستودع مرتبط بالفرع "${conflict.name}" بالفعل. يرجى إلغاء ارتباطه أولاً.`,
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (warehouseId !== undefined)
      updateData.warehouseId = parseInt(warehouseId);
    if (treasuryId !== undefined) updateData.treasuryId = parseInt(treasuryId);

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: updateData,
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    res.json(branch);
  } catch (error) {
    next(error);
  }
});

// DELETE branch - Requires SENSITIVE ACCESS
router.delete("/:id", requirePermission("BRANCHES"), requireSensitiveAccess, async (req, res, next) => {
  try {
    await prisma.branch.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
