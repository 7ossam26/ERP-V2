const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireCreatePermission, requireAnyPermission, requireSensitiveAccess } = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET all suppliers
router.get("/", async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(suppliers);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch suppliers", message: error.message });
  }
});

// GET supplier by ID
router.get("/:id", async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(supplier);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch supplier", message: error.message });
  }
});

// POST create new supplier
router.post("/", requireCreatePermission("CREATES_SUPPLIERS"), async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phoneNumber: phoneNumber || "",
      },
    });
    res.status(201).json(supplier);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create supplier", message: error.message });
  }
});

// PUT update supplier - Requires SENSITIVE ACCESS
router.put("/:id", requireAnyPermission(["SUPPLIERS", "CREATES_SUPPLIERS"]), requireSensitiveAccess, async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        phoneNumber,
      },
    });
    res.json(supplier);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to update supplier", message: error.message });
  }
});

// DELETE supplier - Requires SENSITIVE ACCESS
router.delete("/:id", requirePermission("SUPPLIERS"), requireSensitiveAccess, async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete supplier", message: error.message });
  }
});

module.exports = router;
