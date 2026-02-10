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
router.post(
  "/",
  requireCreatePermission("CREATES_PRODUCTION"),
  async (req, res) => {
    try {
      const { name, outputItemId, outputQuantity, isActive, notes, items } =
        req.body;

      if (!name) {
        return res.status(400).json({ error: "BOM name is required" });
      }
      if (!outputItemId) {
        return res.status(400).json({ error: "Output item is required" });
      }
      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one material item is required" });
      }

      const bom = await prisma.bOM.create({
        data: {
          name,
          outputItemId: parseInt(outputItemId),
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

      res.status(201).json(bom);
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(400).json({ error: "BOM name already exists" });
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
      const { name, outputItemId, outputQuantity, isActive, notes, items } =
        req.body;
      const bomId = parseInt(req.params.id);

      const bom = await prisma.$transaction(async (tx) => {
        // 1. Update basic fields
        await tx.bOM.update({
          where: { id: bomId },
          data: {
            name,
            outputItemId: parseInt(outputItemId),
            outputQuantity: parseFloat(outputQuantity) || 1,
            isActive: isActive !== false,
            notes: notes || null,
          },
        });

        // 2. Replace all BOM items
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

        // 3. Return updated BOM
        return await tx.bOM.findUnique({
          where: { id: bomId },
          include: {
            outputItem: true,
            items: { include: { item: true } },
          },
        });
      });

      res.json(bom);
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "BOM not found" });
      }
      if (error.code === "P2002") {
        return res.status(400).json({ error: "BOM name already exists" });
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
