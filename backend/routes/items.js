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
// Only items with no transactional history can be deleted. Any reference from
// sales, purchases, returns, transfers, production, BOMs, bulk orders, opening
// stock, or current stock on hand blocks the delete and returns a clear reason.
// Genuinely unused items are removed, cleaning up their residual zero-quantity
// stock rows first (supplier/category links and bulk-contract prices cascade).
router.delete(
  "/:id",
  requirePermission("ITEMS"),
  requireSensitiveAccess,
  async (req, res) => {
    const itemId = parseInt(req.params.id);
    if (Number.isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid item id" });
    }

    try {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          inventory: { select: { quantity: true } },
          _count: {
            select: {
              saleItems: true,
              purchaseItems: true,
              purchaseReturnItems: true,
              stockTransferItems: true,
              productionOrderItems: true,
              bomItems: true,
              bomOutputs: true,
              bulkOrderItems: true,
              initialInventoryEntries: true,
            },
          },
        },
      });

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      // Build a human-readable list of what references this item.
      const c = item._count;
      const hasStock = item.inventory.some((row) => Number(row.quantity) !== 0);
      const blockers = [];
      if (c.saleItems) blockers.push("فواتير مبيعات");
      if (c.purchaseItems) blockers.push("فواتير مشتريات");
      if (c.purchaseReturnItems) blockers.push("مرتجعات مشتريات");
      if (c.stockTransferItems) blockers.push("تحويلات مخزنية");
      if (c.productionOrderItems) blockers.push("أوامر إنتاج");
      if (c.bomItems) blockers.push("قوائم تصنيع (كمكوّن)");
      if (c.bomOutputs) blockers.push("قائمة تصنيع (كمنتج نهائي)");
      if (c.bulkOrderItems) blockers.push("طلبات جملة");
      if (c.initialInventoryEntries) blockers.push("رصيد افتتاحي");
      if (hasStock) blockers.push("رصيد مخزون حالي");

      if (blockers.length > 0) {
        return res.status(400).json({
          error: "Cannot delete item",
          message: `لا يمكن حذف الصنف لأنه مستخدم في: ${blockers.join(
            "، ",
          )}. يمكنك إخفاؤه من نقاط البيع بدلاً من حذفه.`,
        });
      }

      // Unused item: clear residual zero-quantity stock rows (Restrict FK), then
      // delete. Supplier/category links and bulk-contract prices cascade.
      await prisma.$transaction(async (tx) => {
        await tx.inventory.deleteMany({ where: { itemId } });
        await tx.item.delete({ where: { id: itemId } });
      });

      res.status(204).send();
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Item not found" });
      }
      // Safety net: if a reference we didn't explicitly check still blocks the
      // delete, return the same clear guidance instead of a raw 500.
      if (error.code === "P2003") {
        return res.status(400).json({
          error: "Cannot delete item",
          message:
            "لا يمكن حذف الصنف لأنه مرتبط بسجلات أخرى (مثل المبيعات والمشتريات). يمكنك إخفاؤه من نقاط البيع بدلاً من حذفه.",
        });
      }
      res
        .status(500)
        .json({ error: "Failed to delete item", message: error.message });
    }
  },
);

module.exports = router;
