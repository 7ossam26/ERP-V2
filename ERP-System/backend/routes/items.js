const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all items (with optional category filter)
router.get("/", async (req, res) => {
  try {
    const { category_id } = req.query;
    const where = category_id ? { categoryId: parseInt(category_id) } : {};

    const items = await prisma.item.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch items", message: error.message });
  }
});

// GET item by ID
router.get("/:id", async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { category: true },
    });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch item", message: error.message });
  }
});

// POST create new item
router.post("/", async (req, res) => {
  try {
    const item = await prisma.item.create({
      data: req.body,
      include: { category: true },
    });
    res.status(201).json(item);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create item", message: error.message });
  }
});

// PUT update item
router.put("/:id", async (req, res) => {
  try {
    const item = await prisma.item.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
      include: { category: true },
    });
    res.json(item);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update item", message: error.message });
  }
});

// DELETE item
router.delete("/:id", async (req, res) => {
  try {
    await prisma.item.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete item", message: error.message });
  }
});

module.exports = router;
