const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all categories
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
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
      include: { items: true },
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
router.post("/", async (req, res) => {
  try {
    const category = await prisma.category.create({
      data: req.body,
    });
    res.status(201).json(category);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create category", message: error.message });
  }
});

// PUT update category
router.put("/:id", async (req, res) => {
  try {
    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(category);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update category", message: error.message });
  }
});

// DELETE category
router.delete("/:id", async (req, res) => {
  try {
    await prisma.category.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete category", message: error.message });
  }
});

module.exports = router;
