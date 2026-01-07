const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all clients
router.get("/", async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(clients);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch clients", message: error.message });
  }
});

// GET client by ID
router.get("/:id", async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch client", message: error.message });
  }
});

// POST create new client
router.post("/", async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const client = await prisma.client.create({
      data: {
        name,
        phoneNumber: phoneNumber || "",
      },
    });
    res.status(201).json(client);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create client", message: error.message });
  }
});

// PUT update client
router.put("/:id", async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    const client = await prisma.client.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        phoneNumber,
      },
    });
    res.json(client);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Client not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to update client", message: error.message });
  }
});

// DELETE client
router.delete("/:id", async (req, res) => {
  try {
    await prisma.client.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Client not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete client", message: error.message });
  }
});

module.exports = router;
