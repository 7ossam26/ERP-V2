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
// GET /api/inventory-counts
// ─────────────────────────────────────────────
router.get(
  "/",
  requireAnyPermission(["COUNTS", "INVENTORY_COUNT"]),
  async (req, res, next) => {
    try {
      const { warehouseId, status, page = "1", limit = "20" } = req.query;
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
      if (status) where.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const [data, total] = await Promise.all([
        prisma.inventoryCount.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        }),
        prisma.inventoryCount.count({ where }),
      ]);

      res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / take) });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/inventory-counts/:id
// ─────────────────────────────────────────────
router.get(
  "/:id",
  requireAnyPermission(["COUNTS", "INVENTORY_COUNT"]),
  async (req, res, next) => {
    try {
      const count = await prisma.inventoryCount.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          warehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          adjustment: {
            select: { id: true, adjustmentNumber: true },
          },
          items: {
            include: {
              item: { select: { id: true, name: true, unit: true, itemType: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      });
      if (!count) return res.status(404).json({ error: "جلسة الجرد غير موجودة" });

      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(count.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية عرض هذا الجرد" });
      }

      res.json(count);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/inventory-counts  (start session)
// ─────────────────────────────────────────────
router.post(
  "/",
  requireAnyPermission(["COUNTS"]),
  requireModuleWrite("COUNTS"),
  async (req, res, next) => {
    try {
      const { warehouseId, notes } = req.body;
      if (!warehouseId) return res.status(400).json({ error: "يجب تحديد المخزن" });

      const wId = parseInt(warehouseId);
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(wId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية الجرد على هذا المخزن" });
      }

      // Check no OPEN count for this warehouse
      const existing = await prisma.inventoryCount.findFirst({
        where: { warehouseId: wId, status: "IN_PROGRESS" },
      });
      if (existing) {
        return res.status(400).json({
          error: `يوجد جرد مفتوح بالفعل لهذا المخزن (${existing.countNumber})`,
        });
      }

      const branch = await prisma.branch.findFirst({
        where: { warehouseId: wId },
        select: { id: true },
      });
      if (!branch) return res.status(400).json({ error: "لا يوجد فرع مرتبط بهذا المخزن" });

      // Snapshot current stock
      const inventoryRows = await prisma.inventory.findMany({
        where: { warehouseId: wId },
        include: { item: { select: { id: true, name: true } } },
      });

      const result = await prisma.$transaction(async (tx) => {
        const countNumber = await generateNumber("CNT", tx);

        const count = await tx.inventoryCount.create({
          data: {
            countNumber,
            warehouseId: wId,
            userId: req.user.id,
            branchId: branch.id,
            notes: notes || null,
          },
        });

        // Create snapshot items
        if (inventoryRows.length > 0) {
          await tx.inventoryCountItem.createMany({
            data: inventoryRows.map((inv) => ({
              inventoryCountId: count.id,
              itemId: inv.itemId,
              expectedQty: inv.quantity,
              actualQty: inv.quantity, // default = expected until counted
              difference: 0,
            })),
          });
        }

        return count;
      });

      // Re-fetch with items
      const full = await prisma.inventoryCount.findUnique({
        where: { id: result.id },
        include: {
          warehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          items: {
            include: { item: { select: { id: true, name: true, unit: true, itemType: true } } },
            orderBy: { id: "asc" },
          },
        },
      });

      res.status(201).json(full);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PUT /api/inventory-counts/:id/record
// Idempotent per itemId (last-write-wins)
// ─────────────────────────────────────────────
router.put(
  "/:id/record",
  requireAnyPermission(["COUNTS"]),
  requireModuleWrite("COUNTS"),
  async (req, res, next) => {
    try {
      const countId = parseInt(req.params.id);
      const { items } = req.body; // [{itemId, countedQuantity}]

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "يجب إدخال عنصر واحد على الأقل" });
      }

      const count = await prisma.inventoryCount.findUnique({
        where: { id: countId },
        select: { id: true, status: true, warehouseId: true },
      });
      if (!count) return res.status(404).json({ error: "جلسة الجرد غير موجودة" });
      if (count.status !== "IN_PROGRESS") {
        return res.status(400).json({ error: "لا يمكن تسجيل العد — الجلسة ليست مفتوحة" });
      }

      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(count.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية التعديل على هذا الجرد" });
      }

      // Upsert each count item
      for (const entry of items) {
        const itemId = parseInt(entry.itemId);
        const countedQty = Number(entry.countedQuantity);

        const existing = await prisma.inventoryCountItem.findUnique({
          where: { inventoryCountId_itemId: { inventoryCountId: countId, itemId } },
        });

        if (existing) {
          await prisma.inventoryCountItem.update({
            where: { id: existing.id },
            data: {
              actualQty: countedQty,
              difference: countedQty - Number(existing.expectedQty),
            },
          });
        } else {
          // Item not in snapshot — add with expected=0
          await prisma.inventoryCountItem.create({
            data: {
              inventoryCountId: countId,
              itemId,
              expectedQty: 0,
              actualQty: countedQty,
              difference: countedQty,
            },
          });
        }
      }

      res.json({ message: "تم تسجيل العد بنجاح" });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/inventory-counts/:id/finalize
// ─────────────────────────────────────────────
router.post(
  "/:id/finalize",
  requireAnyPermission(["COUNTS"]),
  requireModuleWrite("COUNTS"),
  async (req, res, next) => {
    try {
      const countId = parseInt(req.params.id);
      const { fabricAllocations } = req.body; // optional: {itemId: [{rollId, length}]}

      const count = await prisma.inventoryCount.findUnique({
        where: { id: countId },
        include: {
          items: {
            include: { item: { select: { id: true, name: true, itemType: true, costPrice: true } } },
          },
        },
      });
      if (!count) return res.status(404).json({ error: "جلسة الجرد غير موجودة" });
      if (count.status !== "IN_PROGRESS") {
        return res.status(400).json({ error: "لا يمكن إنهاء الجرد — الجلسة ليست مفتوحة" });
      }

      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(count.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية إنهاء هذا الجرد" });
      }

      // Filter items with variance
      const variances = count.items.filter((i) => Number(i.difference) !== 0);

      // Validate fabric items with variance have allocations (for negative variance = OUT)
      for (const v of variances) {
        if (v.item.itemType === "FABRIC" && Number(v.difference) < 0) {
          const allocs = fabricAllocations && fabricAllocations[String(v.itemId)];
          if (!allocs || !Array.isArray(allocs) || allocs.length === 0) {
            return res.status(400).json({
              error: `الصنف "${v.item.name}" من نوع قماش مع فرق سالب — يجب تحديد تخصيصات اللفات`,
            });
          }
          const allocTotal = allocs.reduce((s, a) => s + Number(a.length), 0);
          if (Math.abs(allocTotal - Math.abs(Number(v.difference))) > 0.0001) {
            return res.status(400).json({
              error: `مجموع تخصيصات اللفات (${allocTotal}) لا يطابق الفرق (${Math.abs(Number(v.difference))}) للصنف "${v.item.name}"`,
            });
          }
        }
      }

      if (variances.length === 0) {
        // No variances — just finalize without adjustment
        await prisma.inventoryCount.update({
          where: { id: countId },
          data: { status: "COMPLETED" },
        });
        return res.json({ message: "تم إنهاء الجرد بنجاح — لا توجد فروقات", adjustmentId: null });
      }

      // Get branch
      const branch = await prisma.branch.findFirst({
        where: { warehouseId: count.warehouseId },
        select: { id: true },
      });

      // Lookup unitCostAtTime
      const unitCosts = new Map();
      for (const v of variances) {
        const latest = await prisma.purchaseItem.findFirst({
          where: { itemId: v.itemId },
          orderBy: { id: "desc" },
          select: { finalUnitCost: true },
        });
        unitCosts.set(
          v.itemId,
          latest && latest.finalUnitCost ? Number(latest.finalUnitCost) : Number(v.item.costPrice)
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const adjNumber = await generateNumber("ADJ", tx);

        // Determine overall direction — use the dominant direction,
        // but COUNT_VARIANCE adjustments can be mixed, so we pick IN if net positive, else OUT
        const netQty = variances.reduce((s, v) => s + Number(v.difference), 0);
        const direction = netQty >= 0 ? "IN" : "OUT";

        const adjustment = await tx.inventoryAdjustment.create({
          data: {
            adjustmentNumber: adjNumber,
            warehouseId: count.warehouseId,
            direction,
            reasonCode: "COUNT_VARIANCE",
            reasonNote: `جرد رقم ${count.countNumber}`,
            userId: req.user.id,
            branchId: branch.id,
          },
        });

        for (const v of variances) {
          const diff = Number(v.difference);
          const absQty = Math.abs(diff);

          const adjItem = await tx.inventoryAdjustmentItem.create({
            data: {
              adjustmentId: adjustment.id,
              itemId: v.itemId,
              quantity: absQty,
              unitCostAtTime: unitCosts.get(v.itemId) || 0,
            },
          });

          // Update inventory — set to actual counted quantity
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: { itemId: v.itemId, warehouseId: count.warehouseId },
            },
            update: { quantity: { increment: diff } },
            create: { itemId: v.itemId, warehouseId: count.warehouseId, quantity: Math.max(0, diff) },
          });

          // Fabric roll cuts for negative variance
          if (v.item.itemType === "FABRIC" && diff < 0) {
            const allocs = fabricAllocations[String(v.itemId)];
            for (const alloc of allocs) {
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
                  notes: `فرق جرد ${count.countNumber}`,
                },
              });
            }
          }
        }

        // Finalize count
        await tx.inventoryCount.update({
          where: { id: countId },
          data: { status: "COMPLETED", adjustmentId: adjustment.id },
        });

        return adjustment;
      });

      res.json({
        message: "تم إنهاء الجرد وإنشاء تسوية الفروقات بنجاح",
        adjustmentId: result.id,
        adjustmentNumber: result.adjustmentNumber,
      });
    } catch (error) {
      if (error.message && error.message.includes("اللفة")) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

module.exports = router;
