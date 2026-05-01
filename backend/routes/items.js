const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireCreatePermission,
  requireAnyPermission,
  requireSensitiveAccess,
} = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

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
        inventory: true,
        bomOutputs: { select: { id: true } },
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
router.post("/", requireCreatePermission("CREATES_ITEMS"), async (req, res) => {
  try {
    const { name, price, unit, reorderPoint, suppliers, categories } = req.body;

    let showInPos = req.body.showInPos;

    // Handle string booleans if sent as multipart/form-data or similar
    if (showInPos === "true") showInPos = true;
    if (showInPos === "false") showInPos = false;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const item = await prisma.item.create({
      data: {
        name,
        price: parseFloat(price) || 0,
        costPrice: parseFloat(req.body.costPrice) || 0,
        unit: unit || "piece",
        reorderPoint: parseInt(reorderPoint) || 10,
        showInPos: showInPos !== undefined ? showInPos : true,
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
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target && target.includes("name")) {
        return res.status(400).json({ error: "Item name already exists" });
      }
      if (target === "PRIMARY") {
        return res.status(500).json({
          error: "System ID conflict (Auto-increment sync error)",
          details: "Please contact support to reset database counters.",
        });
      }
      return res
        .status(400)
        .json({ error: "Duplicate value for unique field: " + target });
    }
    res
      .status(500)
      .json({ error: "Failed to create item", message: error.message });
  }
});

// PUT update item - Requires SENSITIVE ACCESS
router.put(
  "/:id",
  requireAnyPermission(["ITEMS", "CREATES_ITEMS"]),
  requireSensitiveAccess,
  async (req, res) => {
    try {
      const {
        name,
        price,
        unit,
        reorderPoint,
        showInPos,
        suppliers,
        categories,
      } = req.body;
      const itemId = parseInt(req.params.id);

      // Transaction to update relations safely
      const item = await prisma.$transaction(async (prisma) => {
        // 1. Update basic fields
        const updatedItem = await prisma.item.update({
          where: { id: itemId },
          data: {
            name,
            price: parseFloat(price) || 0,
            costPrice: req.body.costPrice !== undefined ? parseFloat(req.body.costPrice) : undefined,
            unit,
            reorderPoint: parseInt(reorderPoint) || 10,
            showInPos: showInPos !== undefined ? showInPos : undefined,
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
      if (error.code === "P2002") {
        return res.status(400).json({ error: "Item name already exists" });
      }
      res
        .status(500)
        .json({ error: "Failed to update item", message: error.message });
    }
  },
);

// DELETE item - Requires SENSITIVE ACCESS
router.delete(
  "/:id",
  requirePermission("ITEMS"),
  requireSensitiveAccess,
  async (req, res) => {
    try {
      await prisma.item.delete({
        where: { id: parseInt(req.params.id) },
      });
      res.status(204).send();
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Item not found" });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          error: "Cannot delete item",
          message: "Item is referenced by other records (e.g., Sales, Purchases) and cannot be deleted."
        });
      }
      res
        .status(500)
        .json({ error: "Failed to delete item", message: error.message });
    }
  },
);

module.exports = router;
