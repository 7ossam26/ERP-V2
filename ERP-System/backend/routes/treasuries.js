const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all treasuries
router.get("/", async (req, res) => {
  try {
    const treasuries = await prisma.treasury.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(treasuries);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch treasuries", message: error.message });
  }
});

// GET treasury by ID
router.get("/:id", async (req, res) => {
  try {
    const treasury = await prisma.treasury.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!treasury) {
      return res.status(404).json({ error: "Treasury not found" });
    }
    res.json(treasury);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch treasury", message: error.message });
  }
});

// POST create new treasury
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    const treasury = await prisma.treasury.create({
      data: { name },
    });
    res.status(201).json(treasury);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create treasury", message: error.message });
  }
});

// PUT update treasury
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const treasury = await prisma.treasury.update({
      where: { id: parseInt(req.params.id) },
      data: { name },
    });
    res.json(treasury);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update treasury", message: error.message });
  }
});

// DELETE treasury
router.delete("/:id", async (req, res) => {
  try {
    await prisma.treasury.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete treasury", message: error.message });
  }
});

module.exports = router;
