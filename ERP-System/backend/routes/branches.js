const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all branches
router.get("/", async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      include: {
        warehouse: true,
        treasury: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(branches);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch branches", message: error.message });
  }
});

// GET Financial Summary (Total Balance & Daily Change)
router.get("/summary", async (req, res) => {
  try {
    // 1. Get all branches with treasuries to calculate current total balance
    const branches = await prisma.branch.findMany({
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
    console.error("Summary Error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch summary", message: error.message });
  }
});

// GET branch by ID
router.get("/:id", async (req, res) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }
    res.json(branch);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch branch", message: error.message });
  }
});

// POST create new branch
router.post("/", async (req, res) => {
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
    // Handle unique constraint violations
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Warehouse or Treasury already assigned to another branch",
        message: error.message,
      });
    }
    res
      .status(500)
      .json({ error: "Failed to create branch", message: error.message });
  }
});

// PUT update branch
router.put("/:id", async (req, res) => {
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
    // Handle unique constraint violations
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Warehouse or Treasury already assigned to another branch",
        message: error.message,
      });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Branch not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to update branch", message: error.message });
  }
});

// DELETE branch
router.delete("/:id", async (req, res) => {
  try {
    await prisma.branch.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Branch not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete branch", message: error.message });
  }
});

module.exports = router;
