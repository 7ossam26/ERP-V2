const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireCreatePermission,
  getUserBranchFilter,
  requireAnyPermission,
} = require("../middleware/auth");

// Protect all routes with WAREHOUSES permission
// Protect all routes with authentication
router.use(authenticateToken);

// GET all warehouses — scoped to the caller's assigned branch(es) by default so
// each user sees their own branch warehouse. Cross-branch flows (stock transfer,
// production, admin/settings) pass ?all=true to get every warehouse. Global
// roles (Superadmin/Admin/…) always see all via getUserBranchFilter → null.
router.get("/", async (req, res) => {
  try {
    // Don't pass req — scope to the user's assigned branch(es), not the active-branch header.
    const branchFilter = await getUserBranchFilter(req.user.id);
    const showAll = String(req.query.all || "").toLowerCase() === "true";

    const where = { isActive: true };
    if (branchFilter && !showAll) {
      // Warehouse has an optional 1:1 back-relation to Branch (Branch.warehouseId).
      where.branch = branchFilter.id.in
        ? { id: { in: branchFilter.id.in } }
        : { id: branchFilter.id };
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

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
router.post(
  "/",
  requireCreatePermission("CREATES_WAREHOUSES"),
  async (req, res) => {
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
  },
);

// PUT update warehouse - Requires WAREHOUSES management permission
router.put(
  "/:id",
  requireAnyPermission(["WAREHOUSES", "CREATES_WAREHOUSES"]),
  async (req, res) => {
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
  },
);

// DELETE warehouse - Requires WAREHOUSES management permission
router.delete(
  "/:id",
  requirePermission("WAREHOUSES"),
  async (req, res, next) => {
    try {
      await prisma.warehouse.update({
        where: { id: parseInt(req.params.id) },
        data: { isActive: false },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
