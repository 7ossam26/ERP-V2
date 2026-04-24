const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");
const { generateRollNumber } = require("../services/rollNumberService");
const { generateNumber } = require("../services/numberSequenceService");

// All routes require authentication
router.use(authenticateToken);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Resolve warehouseIds the requesting user can see. Returns null = no restriction. */
const resolveWarehouseFilter = async (userId, req) => {
  const branchFilter = await getUserBranchFilter(userId, req);
  if (!branchFilter) return null; // global role — no restriction

  const branches = await prisma.branch.findMany({
    where: branchFilter,
    select: { warehouseId: true },
  });
  const ids = branches.map((b) => b.warehouseId).filter(Boolean);
  return ids.length ? ids : [-1]; // -1 forces empty result if no warehouses found
};

const STATUS_ACTIVE = ["AVAILABLE", "PARTIALLY_CUT"];

// ─────────────────────────────────────────────
// GET /api/fabric-rolls/pickable
// Must be before /:id to avoid route conflict
// ─────────────────────────────────────────────
router.get(
  "/pickable",
  requirePermission("FABRIC_ROLLS"),
  async (req, res, next) => {
    try {
      const { itemId, warehouseId, sort = "shortest-first" } = req.query;

      if (!itemId || !warehouseId) {
        return res
          .status(400)
          .json({ error: "itemId and warehouseId are required" });
      }

      // Branch isolation check
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      const wId = parseInt(warehouseId);
      if (allowedWarehouses && !allowedWarehouses.includes(wId)) {
        return res
          .status(403)
          .json({ error: "ليس لديك صلاحية عرض هذا المخزن" });
      }

      const orderBy = (() => {
        switch (sort) {
          case "longest-first":
            return { remainingLength: "desc" };
          case "oldest":
            return { createdAt: "asc" };
          case "newest":
            return { createdAt: "desc" };
          default: // shortest-first
            return { remainingLength: "asc" };
        }
      })();

      const rolls = await prisma.fabricRoll.findMany({
        where: {
          itemId: parseInt(itemId),
          warehouseId: wId,
          status: { in: STATUS_ACTIVE },
        },
        orderBy,
        select: {
          id: true,
          rollNumber: true,
          remainingLength: true,
          lastCutAt: true,
          barcode: true,
          warehouse: { select: { name: true } },
        },
      });

      res.json(
        rolls.map((r) => ({
          rollId: r.id,
          rollNumber: r.rollNumber,
          remainingLength: Number(r.remainingLength),
          warehouseName: r.warehouse.name,
          lastCutAt: r.lastCutAt,
          barcode: r.barcode,
        }))
      );
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/fabric-rolls
// ─────────────────────────────────────────────
router.get(
  "/",
  requirePermission("FABRIC_ROLLS"),
  async (req, res, next) => {
    try {
      const {
        itemId,
        warehouseId,
        status,
        q,
        hasRemaining,
        page = "1",
        limit = "20",
      } = req.query;

      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);

      const where = {};

      // Branch-scoped warehouse filter
      if (allowedWarehouses) {
        where.warehouseId = { in: allowedWarehouses };
      }

      if (warehouseId) {
        const wId = parseInt(warehouseId);
        if (allowedWarehouses && !allowedWarehouses.includes(wId)) {
          return res.json({ data: [], total: 0, page: 1, totalPages: 0 });
        }
        where.warehouseId = wId;
      }

      if (itemId) where.itemId = parseInt(itemId);

      if (status) {
        const statuses = status.split(",").map((s) => s.trim());
        where.status = { in: statuses };
      }

      if (hasRemaining === "true") {
        where.remainingLength = { gt: 0 };
        where.status = { in: STATUS_ACTIVE };
      }

      if (q) {
        where.OR = [
          { rollNumber: { contains: q } },
          { barcode: { contains: q } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const [rolls, total] = await Promise.all([
        prisma.fabricRoll.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            item: { select: { id: true, name: true, unit: true, itemType: true } },
            warehouse: { select: { id: true, name: true } },
          },
        }),
        prisma.fabricRoll.count({ where }),
      ]);

      res.json({
        data: rolls,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / take),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/fabric-rolls/:id
// ─────────────────────────────────────────────
router.get(
  "/:id",
  requirePermission("FABRIC_ROLLS"),
  async (req, res, next) => {
    try {
      const roll = await prisma.fabricRoll.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          item: { select: { id: true, name: true, unit: true, itemType: true } },
          warehouse: { select: { id: true, name: true } },
          cuts: {
            orderBy: { createdAt: "desc" },
            include: {
              saleItem: {
                include: { sale: { select: { id: true, saleNumber: true } } },
              },
              adjustment: { select: { id: true, reasonCode: true } },
            },
          },
        },
      });

      if (!roll) {
        return res.status(404).json({ error: "اللفة غير موجودة" });
      }

      // Branch isolation
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(roll.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية عرض هذه اللفة" });
      }

      res.json(roll);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/fabric-rolls  (batch create)
// ─────────────────────────────────────────────
router.post(
  "/",
  requireAnyPermission(["FABRIC_ROLLS", "CREATES_FABRIC_ROLLS"]),
  async (req, res, next) => {
    try {
      const { rolls } = req.body; // array of roll objects

      if (!Array.isArray(rolls) || rolls.length === 0) {
        return res.status(400).json({ error: "يرجى إدخال لفة واحدة على الأقل" });
      }

      // Validate each roll
      const errors = [];
      for (let i = 0; i < rolls.length; i++) {
        const r = rolls[i];
        if (!r.itemId) errors.push(`الصف ${i + 1}: itemId مطلوب`);
        if (!r.warehouseId) errors.push(`الصف ${i + 1}: warehouseId مطلوب`);
        if (!r.originalLength || Number(r.originalLength) <= 0)
          errors.push(`الصف ${i + 1}: الطول الأصلي يجب أن يكون أكبر من صفر`);
      }
      if (errors.length) return res.status(400).json({ errors });

      // Validate that all items are FABRIC type
      const itemIds = [...new Set(rolls.map((r) => parseInt(r.itemId)))];
      const items = await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, itemType: true },
      });
      const nonFabric = items.filter((i) => i.itemType !== "FABRIC");
      if (nonFabric.length) {
        return res.status(400).json({
          error: `الأصناف التالية ليست من نوع قماش: ${nonFabric.map((i) => i.name).join(", ")}`,
        });
      }

      const created = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const r of rolls) {
          const rollNumber = await generateRollNumber(tx);
          const origLen = Number(r.originalLength);

          const roll = await tx.fabricRoll.create({
            data: {
              itemId: parseInt(r.itemId),
              warehouseId: parseInt(r.warehouseId),
              rollNumber,
              lengthMeters: origLen,
              originalLength: origLen,
              remainingLength: origLen,
              unitCost: r.unitCost ? Number(r.unitCost) : 0,
              widthCm: r.widthCm ? Number(r.widthCm) : null,
              weightKg: r.weightKg ? Number(r.weightKg) : null,
              colorCode: r.colorCode || null,
              barcode: r.barcode || null,
              notes: r.notes || null,
              status: "AVAILABLE",
            },
          });

          // Increment Inventory.quantity by originalLength
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: parseInt(r.itemId),
                warehouseId: parseInt(r.warehouseId),
              },
            },
            update: { quantity: { increment: origLen } },
            create: {
              itemId: parseInt(r.itemId),
              warehouseId: parseInt(r.warehouseId),
              quantity: origLen,
            },
          });

          results.push(roll);
        }

        return results;
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// PUT /api/fabric-rolls/:id  (edit notes / barcode)
// ─────────────────────────────────────────────
router.put(
  "/:id",
  requireAnyPermission(["FABRIC_ROLLS", "CREATES_FABRIC_ROLLS"]),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { notes, barcode } = req.body;

      const existing = await prisma.fabricRoll.findUnique({
        where: { id },
        include: { cuts: { select: { id: true }, take: 1 } },
      });

      if (!existing) {
        return res.status(404).json({ error: "اللفة غير موجودة" });
      }

      // Branch isolation
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(existing.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل هذه اللفة" });
      }

      const updateData = {};
      if (notes !== undefined) updateData.notes = notes;

      // Only allow setting barcode if it wasn't already set
      if (barcode !== undefined) {
        if (existing.barcode && existing.barcode !== barcode) {
          return res
            .status(400)
            .json({ error: "لا يمكن تغيير الباركود بعد تعيينه" });
        }
        updateData.barcode = barcode || null;
      }

      const updated = await prisma.fabricRoll.update({
        where: { id },
        data: updateData,
        include: {
          item: { select: { id: true, name: true, unit: true } },
          warehouse: { select: { id: true, name: true } },
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/fabric-rolls/:id/mark-damaged
// ─────────────────────────────────────────────
router.post(
  "/:id/mark-damaged",
  requireAnyPermission(["FABRIC_ROLLS", "CREATES_FABRIC_ROLLS"]),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;

      const roll = await prisma.fabricRoll.findUnique({ where: { id } });
      if (!roll) return res.status(404).json({ error: "اللفة غير موجودة" });

      if (roll.status === "DAMAGED") {
        return res.status(400).json({ error: "اللفة محددة بالفعل كتالفة" });
      }
      if (roll.status === "DEPLETED") {
        return res.status(400).json({ error: "اللفة مستنفذة بالكامل ولا يمكن تعليمها كتالفة" });
      }

      // Branch isolation
      const allowedWarehouses = await resolveWarehouseFilter(req.user.id, req);
      if (allowedWarehouses && !allowedWarehouses.includes(roll.warehouseId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل هذه اللفة" });
      }

      // Get branch for the adjustment record
      const branch = await prisma.branch.findFirst({
        where: { warehouseId: roll.warehouseId },
        select: { id: true },
      });
      if (!branch) {
        return res.status(400).json({ error: "لا يوجد فرع مرتبط بهذا المخزن" });
      }

      const remainingLen = Number(roll.remainingLength);

      await prisma.$transaction(async (tx) => {
        // 1. Mark roll as DAMAGED
        await tx.fabricRoll.update({
          where: { id },
          data: {
            status: "DAMAGED",
            notes: notes ? `${roll.notes ? roll.notes + "\n" : ""}[تالف] ${notes}` : roll.notes,
          },
        });

        // 2. Decrement inventory only if there was remaining length
        if (remainingLen > 0) {
          await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: roll.itemId,
                warehouseId: roll.warehouseId,
              },
            },
            data: { quantity: { decrement: remainingLen } },
          });

          // 3. Write InventoryAdjustment document + item
          const adjNumber = await generateNumber("ADJ", tx);
          const adj = await tx.inventoryAdjustment.create({
            data: {
              adjustmentNumber: adjNumber,
              warehouseId: roll.warehouseId,
              direction: "OUT",
              reasonCode: "DAMAGE",
              notes: notes || `تلف لفة رقم ${roll.rollNumber}`,
              userId: req.user.id,
              branchId: branch.id,
            },
          });
          await tx.inventoryAdjustmentItem.create({
            data: {
              adjustmentId: adj.id,
              itemId: roll.itemId,
              quantity: remainingLen,
              unitCostAtTime: Number(roll.unitCost) || 0,
            },
          });
        }
      });

      res.json({ message: "تم تعليم اللفة كتالفة بنجاح" });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/fabric-rolls/:id/cut
// Internal endpoint — called by POS/adjustments
// ─────────────────────────────────────────────
router.post(
  "/:id/cut",
  requirePermission("FABRIC_ROLLS"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { length, saleItemId, adjustmentItemId: rawAdjItemId, notes } = req.body;
      const adjustmentItemId = rawAdjItemId ? parseInt(rawAdjItemId) : null;

      if (!length || Number(length) <= 0) {
        return res.status(400).json({ error: "يجب تحديد طول القطع وأن يكون أكبر من صفر" });
      }

      const cutLen = Number(length);

      const roll = await prisma.fabricRoll.findUnique({ where: { id } });
      if (!roll) return res.status(404).json({ error: "اللفة غير موجودة" });

      if (!STATUS_ACTIVE.includes(roll.status)) {
        return res.status(400).json({
          error: `لا يمكن القطع من لفة بحالة "${roll.status}"`,
        });
      }

      const remaining = Number(roll.remainingLength);
      if (cutLen > remaining) {
        return res.status(400).json({
          error: `الطول المطلوب (${cutLen}) يتجاوز المتبقي (${remaining})`,
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const newRemaining = remaining - cutLen;
        const newStatus = newRemaining === 0 ? "DEPLETED" : "PARTIALLY_CUT";

        // Update roll
        const updatedRoll = await tx.fabricRoll.update({
          where: { id },
          data: {
            remainingLength: newRemaining,
            status: newStatus,
            lastCutAt: new Date(),
          },
        });

        // Create cut record
        const cut = await tx.fabricRollCut.create({
          data: {
            fabricRollId: id,
            lengthCut: cutLen,
            saleItemId: saleItemId ? parseInt(saleItemId) : null,
            adjustmentItemId: adjustmentItemId || null,
            notes: notes || null,
          },
        });

        // Decrement inventory
        await tx.inventory.update({
          where: {
            itemId_warehouseId: {
              itemId: roll.itemId,
              warehouseId: roll.warehouseId,
            },
          },
          data: { quantity: { decrement: cutLen } },
        });

        return { roll: updatedRoll, cut };
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
