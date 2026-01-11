const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all items
router.get("/", async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        suppliers: {
          include: {
            supplier: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
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
      include: {
        suppliers: {
          include: {
            supplier: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
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
    const { name, price, unit, reorderPoint, suppliers, categories } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const item = await prisma.item.create({
      data: {
        name,
        price,
        unit: unit || "piece",
        reorderPoint: parseInt(reorderPoint) || 10,
        // Explicit relations creation
        suppliers: {
          create:
            suppliers?.map((id) => ({
              supplier: { connect: { id: parseInt(id) } },
            })) || [],
        },
        categories: {
          create:
            categories?.map((id) => ({
              category: { connect: { id: parseInt(id) } },
            })) || [],
        },
      },
      include: {
        suppliers: { include: { supplier: true } },
        categories: { include: { category: true } },
      },
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
    const { name, price, unit, reorderPoint, suppliers, categories } = req.body;
    const itemId = parseInt(req.params.id);

    // Transaction to update relations safely
    const item = await prisma.$transaction(async (prisma) => {
      // 1. Update basic fields
      const updatedItem = await prisma.item.update({
        where: { id: itemId },
        data: {
          name,
          price,
          unit,
          reorderPoint: parseInt(reorderPoint) || 10,
        },
      });

      // 2. Update Suppliers: Delete all and recreate selected
      if (suppliers) {
        await prisma.itemSupplier.deleteMany({
          where: { itemId },
        });
        if (suppliers.length > 0) {
          await prisma.itemSupplier.createMany({
            data: suppliers.map((supplierId) => ({
              itemId,
              supplierId: parseInt(supplierId),
            })),
          });
        }
      }

      // 3. Update Categories: Delete all and recreate selected
      if (categories) {
        await prisma.itemCategory.deleteMany({
          where: { itemId },
        });
        if (categories.length > 0) {
          await prisma.itemCategory.createMany({
            data: categories.map((categoryId) => ({
              itemId,
              categoryId: parseInt(categoryId),
            })),
          });
        }
      }

      // 4. Return updated item with relations
      return await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          suppliers: { include: { supplier: true } },
          categories: { include: { category: true } },
        },
      });
    });

    res.json(item);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
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
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Item not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete item", message: error.message });
  }
});

module.exports = router;
