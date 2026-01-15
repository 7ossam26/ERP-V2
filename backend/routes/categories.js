const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const authMiddleware = require("../middleware/auth");
const { authenticateToken, requirePermission, requireCreatePermission, requireAnyPermission, requireSensitiveAccess } = authMiddleware;

// Protect all routes with authentication
router.use(authenticateToken);

// GET all categories
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch categories", message: error.message });
  }
});

// GET category by ID
router.get("/:id", async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch category", message: error.message });
  }
});

// POST create new category
router.post("/", requireCreatePermission("CREATES_CATEGORIES"), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const category = await prisma.category.create({
      data: {
        name,
      },
    });
    res.status(201).json(category);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create category", message: error.message });
  }
});

// PUT update category - Requires SENSITIVE ACCESS
router.put("/:id", requireAnyPermission(["CATEGORIES", "CREATES_CATEGORIES"]), requireSensitiveAccess, async (req, res) => {
  try {
    const { name } = req.body;

    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
      },
    });
    res.json(category);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to update category", message: error.message });
  }
});

// DELETE category - Requires SENSITIVE ACCESS
router.delete("/:id", requirePermission("CATEGORIES"), requireSensitiveAccess, async (req, res) => {
  try {
    await prisma.category.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete category", message: error.message });
  }
});

module.exports = router;
