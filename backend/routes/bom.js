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

// GET all BOMs
router.get("/", async (req, res) => {
  try {
    const boms = await prisma.bOM.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        outputItem: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });
    res.json(boms);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch BOMs", message: error.message });
  }
});

// GET BOM by ID
router.get("/:id", async (req, res) => {
  try {
    const bom = await prisma.bOM.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        outputItem: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });
    if (!bom) {
      return res.status(404).json({ error: "BOM not found" });
    }
    res.json(bom);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch BOM", message: error.message });
  }
});

// POST create new BOM
// POST create new BOM
router.post(
  "/",
  requireCreatePermission("CREATES_PRODUCTION"),
  async (req, res) => {
    try {
      const { name, outputQuantity, isActive, notes, items, newItem } =
        req.body;

      if (!name) {
        return res
          .status(400)
          .json({ error: "BOM name (Product Name) is required" });
      }

      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one material item is required" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Find or Create/Update Item
        let item = await tx.item.findFirst({
          where: { name: name },
        });

        if (item) {
          // Update existing item if newItem details provided
          if (newItem) {
            item = await tx.item.update({
              where: { id: item.id },
              data: {
                price: parseFloat(newItem.price) || item.price,
                unit: newItem.unit || item.unit,
                showInPos: true, // Ensure it's visible if we are defining it
              },
            });
          }
        } else {
          // Create new item
          item = await tx.item.create({
            data: {
              name,
              price: parseFloat(newItem?.price) || 0,
              unit: newItem?.unit || "piece",
              showInPos: true,
              suppliers: {}, // No suppliers initially
              categories: {},
            },
          });
        }

        // 2. Create BOM
        const bom = await tx.bOM.create({
          data: {
            name, // BOM name matches Item name
            outputItemId: item.id,
            outputQuantity: parseFloat(outputQuantity) || 1,
            isActive: isActive !== false,
            notes: notes || null,
            items: {
              create: items.map((item) => ({
                itemId: parseInt(item.itemId),
                quantity: parseFloat(item.quantity),
                notes: item.notes || null,
              })),
            },
          },
          include: {
            outputItem: true,
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        return bom;
      });

      res.status(201).json(result);
    } catch (error) {
      if (error.code === "P2002") {
        // Check if it's the BOM name constraint
        if (error.meta?.target?.includes("name"))
          return res
            .status(400)
            .json({ error: "A BOM for this product already exists" });
      }
      res
        .status(500)
        .json({ error: "Failed to create BOM", message: error.message });
    }
  },
);

// PUT update BOM
router.put(
  "/:id",
  requireAnyPermission(["PRODUCTION", "CREATES_PRODUCTION"]),
  requireSensitiveAccess,
  async (req, res) => {
    try {
      const {
        name,
        outputItemId,
        outputQuantity,
        isActive,
        notes,
        items,
        newItem,
      } = req.body;
      const bomId = parseInt(req.params.id);

      const result = await prisma.$transaction(async (tx) => {
        // 1. Get current BOM to find the Item ID if outputItemId not provided or different
        const currentBom = await tx.bOM.findUnique({ where: { id: bomId } });
        if (!currentBom) {
          throw { code: "P2025" }; // Not Found
        }

        // Determine Item to update. Usually it's the currentBom.outputItemId
        // If outputItemId is passed and different, we might be switching items (unlikely but possible).
        const targetItemId = outputItemId
          ? parseInt(outputItemId)
          : currentBom.outputItemId;

        // 2. Update Item details (Name, Price, Unit)
        if (newItem || name !== currentBom.name) {
          await tx.item.update({
            where: { id: targetItemId },
            data: {
              name: name, // Keep Item Name in sync with BOM Name
              price: newItem?.price ? parseFloat(newItem.price) : undefined,
              unit: newItem?.unit || undefined,
            },
          });
        }

        // 3. Update BOM basic fields
        await tx.bOM.update({
          where: { id: bomId },
          data: {
            name,
            outputItemId: targetItemId,
            outputQuantity: parseFloat(outputQuantity) || 1,
            isActive: isActive !== false,
            notes: notes || null,
          },
        });

        // 4. Replace all BOM items
        if (items) {
          await tx.bOMItem.deleteMany({ where: { bomId } });
          if (items.length > 0) {
            await tx.bOMItem.createMany({
              data: items.map((item) => ({
                bomId,
                itemId: parseInt(item.itemId),
                quantity: parseFloat(item.quantity),
                notes: item.notes || null,
              })),
            });
          }
        }

        // 5. Return updated BOM
        return await tx.bOM.findUnique({
          where: { id: bomId },
          include: {
            outputItem: true,
            items: { include: { item: true } },
          },
        });
      });

      res.json(result);
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "BOM not found" });
      }
      if (error.code === "P2002") {
        return res.status(400).json({ error: "BOM/Item name already exists" });
      }
      res
        .status(500)
        .json({ error: "Failed to update BOM", message: error.message });
    }
  },
);

// DELETE BOM
router.delete(
  "/:id",
  requirePermission("PRODUCTION"),
  requireSensitiveAccess,
  async (req, res) => {
    try {
      await prisma.bOM.delete({
        where: { id: parseInt(req.params.id) },
      });
      res.status(204).send();
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "BOM not found" });
      }
      res
        .status(500)
        .json({ error: "Failed to delete BOM", message: error.message });
    }
  },
);

module.exports = router;
