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
        categories: { include: { category: true } },
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
        categories: { include: { category: true } },
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
router.post(
  "/",
  requireCreatePermission("CREATES_PRODUCTION"),
  async (req, res) => {
    try {
      const {
        name,
        outputItemId,
        outputQuantity,
        isActive,
        notes,
        items,
        price,
        unit,
        categoryIds,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "BOM Name is required" });
      }

      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one material item is required" });
      }

      // Check if BOM name exists
      const existing = await prisma.bOM.findUnique({ where: { name } });
      if (existing) {
        return res
          .status(400)
          .json({ error: "A BOM with this name already exists" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Create BOM
        // If outputItemId is provided, we link it. If not, it's independent.
        // We store price/unit directly on BOM now.

        const bom = await tx.bOM.create({
          data: {
            name,
            outputItemId: outputItemId ? parseInt(outputItemId) : null,
            outputQuantity: parseFloat(outputQuantity) || 1,
            price: parseFloat(price) || 0,
            unit: unit || "piece",
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
        // Link categories if provided
        if (categoryIds && categoryIds.length > 0) {
          await tx.bOMCategory.createMany({
            data: categoryIds.map((catId) => ({
              bomId: bom.id,
              categoryId: parseInt(catId),
            })),
          });
        }

        return await tx.bOM.findUnique({
          where: { id: bom.id },
          include: {
            outputItem: true,
            categories: { include: { category: true } },
            items: { include: { item: true } },
          },
        });
      });

      res.status(201).json(result);
    } catch (error) {
      console.error(error);
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
        price,
        unit,
        categoryIds,
      } = req.body;
      const bomId = parseInt(req.params.id);

      const result = await prisma.$transaction(async (tx) => {
        const currentBom = await tx.bOM.findUnique({ where: { id: bomId } });
        if (!currentBom) {
          throw { code: "P2025" };
        }

        // Update BOM fields
        await tx.bOM.update({
          where: { id: bomId },
          data: {
            name,
            outputItemId: outputItemId ? parseInt(outputItemId) : null,
            outputQuantity: parseFloat(outputQuantity) || 1,
            price: price !== undefined ? parseFloat(price) : currentBom.price,
            unit: unit || currentBom.unit,
            isActive: isActive !== false,
            notes: notes || null,
          },
        });

        // Replace BOM items if provided
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

        // Replace categories if provided
        if (categoryIds !== undefined) {
          await tx.bOMCategory.deleteMany({ where: { bomId } });
          if (categoryIds.length > 0) {
            await tx.bOMCategory.createMany({
              data: categoryIds.map((catId) => ({
                bomId,
                categoryId: parseInt(catId),
              })),
            });
          }
        }

        return await tx.bOM.findUnique({
          where: { id: bomId },
          include: {
            outputItem: true,
            categories: { include: { category: true } },
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
        return res.status(400).json({ error: "BOM name already exists" });
      }
      console.error(error);
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
