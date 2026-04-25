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
    if (!canSeeAllBranches) {
      const branchFilter = await getUserBranchFilter(req.user.id, req);
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

// GET branch balances — Cash treasury + today's INSTAPAY sales per branch (BR1)
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
      const branchFilter = await getUserBranchFilter(req.user.id, req);
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

    // Today's range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Aggregate INSTAPAY sales per branch for today
    const instapaySales = await prisma.sale.groupBy({
      by: ["branchId"],
      where: {
        paymentMethod: "INSTAPAY",
        status: "COMPLETED",
        createdAt: { gte: todayStart, lte: todayEnd },
        branchId: { in: branches.map((b) => b.id) },
      },
      _sum: { total: true },
    });

    const instapayMap = {};
    instapaySales.forEach((row) => {
      instapayMap[row.branchId] = Number(row._sum.total || 0);
    });

    const result = branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      cashBalance: Number(branch.treasury?.balance || 0),
      treasuryName: branch.treasury?.name || "الخزينة",
      instapayToday: instapayMap[branch.id] || 0,
    }));

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
    if (!name || !warehouseId || !treasuryId) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name, warehouseId, and treasuryId are required",
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address: address || "-",
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
    if (error?.code === "P2002") {
      return res.status(400).json({
        error: "Duplicate relation",
        message: "المخزن أو الخزينة مرتبط بالفعل بفرع آخر",
      });
    }
    next(error);
  }
});

// PUT update branch - Requires SENSITIVE ACCESS
router.put("/:id", requireAnyPermission(["BRANCHES", "CREATES_BRANCHES"]), requireSensitiveAccess, async (req, res, next) => {
  try {
    const { name, address, warehouseId, treasuryId } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (warehouseId !== undefined)
      updateData.warehouseId = parseInt(warehouseId);
    if (treasuryId !== undefined) updateData.treasuryId = parseInt(treasuryId);

    const branch = await prisma.branch.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    res.json(branch);
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(400).json({
        error: "Duplicate relation",
        message: "المخزن أو الخزينة مرتبط بالفعل بفرع آخر",
      });
    }
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
