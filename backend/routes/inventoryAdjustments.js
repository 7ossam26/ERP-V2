const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requireAnyPermission,
  requireModuleWrite,
  getUserBranchFilter,
} = require("../middleware/auth");
const { generateNumber } = require("../services/numberSequenceService");

router.use(authenticateToken);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const resolveWarehouseFilter = async (userId, req) => {
  const branchFilter = await getUserBranchFilter(userId, req);
  if (!branchFilter) return null;
  const branches = await prisma.branch.findMany({
    where: branchFilter,
    select: { warehouseId: true },
  });
  const ids = branches.map((b) => b.warehouseId).filter(Boolean);
  return ids.length ? ids : [-1];
};

// ─────────────────────────────────────────────
// GET /api/inventory-adjustments
// ─────────────────────────────────────────────
router.get(
  "/",
  requireAnyPermission(["ADJUSTMENTS", "INVENTORY"]),
  async (req, res, next) => {
    try {
      const { warehouseId, reason, direction, dateFrom, dateTo, q, page = "1", limit = "20" } = req.query;

      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      const where = {};

      if (allowedWarehouses) where.warehouseId = { in: allowedWarehouses };
      if (warehouseId) {
        const wId = parseInt(warehouseId);
        if (allowedWarehouses && !allowedWarehouses.includes(wId)) {
          return res.json({ data: [], total: 0, page: 1, totalPages: 0 });
        }
        where.warehouseId = wId;
      }
      if (reason) where.reasonCode = reason;
      if (direction) where.direction = direction;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
      }
      if (q) {
        where.OR = [
          { adjustmentNumber: { contains: q } },
          { notes: { contains: q } },
          { reasonNote: { contains: q } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const [data, total] = await Promise.all([
        prisma.inventoryAdjustment.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            items: {
              include: { item: { select: { id: true, name: true, unit: true, itemType: true } } },
            },
          },
        }),
        prisma.inventoryAdjustment.count({ where }),
      ]);

      res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / take) });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/inventory-adjustments/:id
// ─────────────────────────────────────────────
router.get(
  "/:id",
  requireAnyPermission(["ADJUSTMENTS", "INVENTORY"]),
  async (req, res, next) => {
    try {
      const adj = await prisma.inventoryAdjustment.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          warehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, name: true, unit: true, itemType: true } },
              fabricRollCuts: {
                include: {
                  fabricRoll: { select: { id: true, rollNumber: true } },
                },
              },
            },
          },
        },
      });
      if (!adj) return res.status(404).json({ error: "التسوية غير موجودة" });

      // Branch isolation
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(adj.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية عرض هذه التسوية" });
      }

      res.json(adj);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/inventory-adjustments
// ─────────────────────────────────────────────
router.post(
  "/",
  requireAnyPermission(["ADJUSTMENTS"]),
  requireModuleWrite("ADJUSTMENTS"),
  async (req, res, next) => {
    try {
      const { warehouseId, reason, reasonNote, direction, items } = req.body;

      // Validation
      if (!warehouseId) return res.status(400).json({ error: "يجب تحديد المخزن" });
      if (!reason) return res.status(400).json({ error: "يجب تحديد سبب التسوية" });
      if (!direction || !["IN", "OUT"].includes(direction)) {
        return res.status(400).json({ error: "يجب تحديد الاتجاه (IN أو OUT)" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "يجب إضافة صنف واحد على الأقل" });
      }

      // Branch isolation
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      const wId = parseInt(warehouseId);
      if (allowedWarehouses && !allowedWarehouses.includes(wId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية التعديل على هذا المخزن" });
      }

      // Get branch for the warehouse
      const branch = await prisma.branch.findFirst({
        where: { warehouseId: wId },
        select: { id: true },
      });
      if (!branch) return res.status(400).json({ error: "لا يوجد فرع مرتبط بهذا المخزن" });

      // Validate items exist
      const itemIds = items.map((i) => parseInt(i.itemId));
      const dbItems = await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, itemType: true, costPrice: true },
      });
      const dbItemMap = new Map(dbItems.map((i) => [i.id, i]));

      for (const item of items) {
        const dbItem = dbItemMap.get(parseInt(item.itemId));
        if (!dbItem) return res.status(400).json({ error: `الصنف رقم ${item.itemId} غير موجود` });
        if (!item.quantity || Number(item.quantity) <= 0) {
          return res.status(400).json({ error: `الكمية يجب أن تكون أكبر من صفر للصنف ${dbItem.name}` });
        }
        // Fabric items with OUT direction require rollAllocations
        if (dbItem.itemType === "FABRIC" && direction === "OUT") {
          if (!item.rollAllocations || !Array.isArray(item.rollAllocations) || item.rollAllocations.length === 0) {
            return res.status(400).json({
              error: `الصنف "${dbItem.name}" من نوع قماش — يجب تحديد تخصيصات اللفات (rollAllocations)`,
            });
          }
          const allocTotal = item.rollAllocations.reduce((s, a) => s + Number(a.length), 0);
          if (Math.abs(allocTotal - Number(item.quantity)) > 0.0001) {
            return res.status(400).json({
              error: `مجموع تخصيصات اللفات (${allocTotal}) لا يطابق الكمية (${item.quantity}) للصنف "${dbItem.name}"`,
            });
          }
        }
      }

      // Look up unitCostAtTime per item — latest purchase finalUnitCost, fallback to item.costPrice
      const unitCosts = new Map();
      for (const dbItem of dbItems) {
        const latestPurchaseItem = await prisma.purchaseItem.findFirst({
          where: { itemId: dbItem.id },
          orderBy: { id: "desc" },
          select: { finalUnitCost: true },
        });
        unitCosts.set(
          dbItem.id,
          latestPurchaseItem && latestPurchaseItem.finalUnitCost
            ? Number(latestPurchaseItem.finalUnitCost)
            : Number(dbItem.costPrice)
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const adjNumber = await generateNumber("ADJ", tx);

        const adjustment = await tx.inventoryAdjustment.create({
          data: {
            adjustmentNumber: adjNumber,
            warehouseId: wId,
            direction,
            reasonCode: reason,
            reasonNote: reasonNote || null,
            userId: req.user.id,
            branchId: branch.id,
          },
        });

        for (const item of items) {
          const iId = parseInt(item.itemId);
          const qty = Number(item.quantity);
          const dbItem = dbItemMap.get(iId);

          const adjItem = await tx.inventoryAdjustmentItem.create({
            data: {
              adjustmentId: adjustment.id,
              itemId: iId,
              quantity: qty,
              unitCostAtTime: unitCosts.get(iId) || 0,
            },
          });

          // Update Inventory
          const change = direction === "IN" ? qty : -qty;
          await tx.inventory.upsert({
            where: { itemId_warehouseId: { itemId: iId, warehouseId: wId } },
            update: { quantity: { increment: change } },
            create: { itemId: iId, warehouseId: wId, quantity: Math.max(0, change) },
          });

          // Fabric roll cuts for OUT direction
          if (dbItem.itemType === "FABRIC" && direction === "OUT" && item.rollAllocations) {
            for (const alloc of item.rollAllocations) {
              const rollId = parseInt(alloc.rollId);
              const cutLen = Number(alloc.length);

              const roll = await tx.fabricRoll.findUnique({ where: { id: rollId } });
              if (!roll) throw new Error(`اللفة رقم ${rollId} غير موجودة`);

              const remaining = Number(roll.remainingLength);
              if (cutLen > remaining) {
                throw new Error(`الطول المطلوب (${cutLen}) يتجاوز المتبقي (${remaining}) في اللفة ${roll.rollNumber}`);
              }

              const newRemaining = remaining - cutLen;
              await tx.fabricRoll.update({
                where: { id: rollId },
                data: {
                  remainingLength: newRemaining,
                  status: newRemaining === 0 ? "DEPLETED" : "PARTIALLY_CUT",
                  lastCutAt: new Date(),
                },
              });

              await tx.fabricRollCut.create({
                data: {
                  fabricRollId: rollId,
                  lengthCut: cutLen,
                  adjustmentItemId: adjItem.id,
                  notes: `تسوية مخزون ${adjNumber}`,
                },
              });
            }
          }
        }

        return adjustment;
      });

      // Re-fetch with full relations
      const full = await prisma.inventoryAdjustment.findUnique({
        where: { id: result.id },
        include: {
          warehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, name: true, unit: true, itemType: true } },
              fabricRollCuts: {
                include: { fabricRoll: { select: { id: true, rollNumber: true } } },
              },
            },
          },
        },
      });

      res.status(201).json(full);
    } catch (error) {
      if (error.message && error.message.includes("اللفة")) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PUT & DELETE → 405 (append-only)
// ─────────────────────────────────────────────
router.put("/:id", authenticateToken, (req, res) => {
  res.status(405).json({
    error: "لا يمكن تعديل تسوية المخزون — قم بإنشاء تسوية عكسية بدلاً من ذلك",
  });
});

router.delete("/:id", authenticateToken, (req, res) => {
  res.status(405).json({
    error: "لا يمكن حذف تسوية المخزون — قم بإنشاء تسوية عكسية بدلاً من ذلك",
  });
});

module.exports = router;
