const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all warehouses
router.get("/", async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
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
    if (!warehouse) {
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
router.post("/", async (req, res) => {
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

// PUT update warehouse
router.put("/:id", async (req, res) => {
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

// DELETE warehouse
router.delete("/:id", async (req, res) => {
  try {
    await prisma.warehouse.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete warehouse", message: error.message });
  }
});

module.exports = router;
