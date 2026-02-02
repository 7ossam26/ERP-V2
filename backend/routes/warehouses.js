const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireCreatePermission, getUserBranchFilter, requireAnyPermission } = require("../middleware/auth");

// Protect all routes with WAREHOUSES permission
// Protect all routes with authentication
router.use(authenticateToken);

// GET all warehouses - Accessible to all auth users (for transfers etc)
router.get("/", async (req, res) => {
  try {
    const where = { isActive: true };

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    // --- VISIBILITY FILTER ---
    // Rule:
    // 1. Superadmin -> Sees ALL
    // 2. "All Branches" Branch User -> Sees ALL
    // 3. Regular Branch User -> Sees ONLY their branch's warehouse

    if (req.user.role !== "Superadmin") {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { branch: true },
      });

      const isAllBranches = user?.branch?.isAllBranches;
      const userWarehouseId = user?.branch?.warehouseId;

      if (!isAllBranches) {
        // Filter to only include the user's branch warehouse
        return res.json(
          warehouses.filter((w) => w.id === userWarehouseId)
        );
      }
    }
    // -------------------------

    res.json(warehouses);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch warehouses", message: error.message });
  }
});

// GET warehouse by ID
router.get("/:id", async (req, res) => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!warehouse || !warehouse.isActive) {
      return res.status(404).json({ error: "Warehouse not found" });
    }
    res.json(warehouse);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch warehouse", message: error.message });
  }
});

// POST create new warehouse
router.post("/", requireCreatePermission("CREATES_WAREHOUSES"), async (req, res) => {
  try {
    const { name } = req.body;
    const warehouse = await prisma.warehouse.create({
      data: { name },
    });
    res.status(201).json(warehouse);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create warehouse", message: error.message });
  }
});

// PUT update warehouse - Requires WAREHOUSES management permission
router.put("/:id", requireAnyPermission(["WAREHOUSES", "CREATES_WAREHOUSES"]), async (req, res) => {
  try {
    const { name } = req.body;
    const warehouse = await prisma.warehouse.update({
      where: { id: parseInt(req.params.id) },
      data: { name },
    });
    res.json(warehouse);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update warehouse", message: error.message });
  }
});

// DELETE warehouse - Requires WAREHOUSES management permission
router.delete("/:id", requirePermission("WAREHOUSES"), async (req, res, next) => {
  try {
    await prisma.warehouse.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
