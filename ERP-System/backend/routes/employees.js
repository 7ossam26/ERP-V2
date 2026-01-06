const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all employees
router.get("/", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(employees);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch employees", message: error.message });
  }
});

// GET employee by ID
router.get("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json(employee);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch employee", message: error.message });
  }
});

// POST create new employee
router.post("/", async (req, res) => {
  try {
    const employee = await prisma.employee.create({
      data: req.body,
    });
    res.status(201).json(employee);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create employee", message: error.message });
  }
});

// PUT update employee
router.put("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(employee);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update employee", message: error.message });
  }
});

// DELETE employee
router.delete("/:id", async (req, res) => {
  try {
    await prisma.employee.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete employee", message: error.message });
  }
});

module.exports = router;
