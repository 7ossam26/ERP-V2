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

// ============================================================
// GET /production-orders — List all production orders
// IMPORTANT: Must be BEFORE /:id to prevent route conflict
// ============================================================
router.get("/production-orders", async (req, res) => {
  try {
    const orders = await prisma.productionOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bom: { select: { id: true, name: true, unit: true } },
        sourceWarehouse: { select: { id: true, name: true } },
        destWarehouse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { item: { select: { id: true, name: true, unit: true } } },
        },
      },
    });

    // Manually enrich cancelledBy since Prisma client predates this relation
    const cancellerIds = [...new Set(orders.filter(o => o.cancelledById).map(o => o.cancelledById))];
    let cancellerMap = {};
    if (cancellerIds.length > 0) {
      const cancellers = await prisma.user.findMany({
        where: { id: { in: cancellerIds } },
        select: { id: true, name: true },
      });
      cancellerMap = Object.fromEntries(cancellers.map(u => [u.id, u]));
    }
    const enriched = orders.map(o => ({
      ...o,
      cancelledBy: o.cancelledById ? (cancellerMap[o.cancelledById] || null) : null,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch production orders",
      message: error.message,
    });
  }
});

// ============================================================
// GET /production-orders/:id — Get single production order
// IMPORTANT: Must be BEFORE /:id to prevent route conflict
// ============================================================
router.get("/production-orders/:id", async (req, res) => {
  try {
    const order = await prisma.productionOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        bom: { select: { id: true, name: true, unit: true } },
        sourceWarehouse: { select: { id: true, name: true } },
        destWarehouse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { item: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    if (!order)
      return res.status(404).json({ error: "Production order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch production order",
      message: error.message,
    });
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
        outputItemId,
        outputQuantity,
        isActive,
        notes,
        items,
        price,
        unit,
        categoryIds,
      } = req.body;

      let { name } = req.body;
      if (typeof name === "string") {
        name = name.trim();
      }

      if (!name) {
        return res.status(400).json({ error: "اسم الوصفة مطلوب" }); // Localized "BOM Name is required"
      }

      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one material item is required" });
      }

      // Check if BOM name exists
      const existing = await prisma.bOM.findUnique({ where: { name } });
      if (existing) {
        return res.status(400).json({ error: "الوصفة موجودة بالفعل" });
      }

      const result = await prisma.$transaction(async (tx) => {
        let finalOutputItemId = outputItemId ? parseInt(outputItemId) : null;

        // Auto-create an Item if one isn't linked, so it can be tracked in Inventory and POS
        if (!finalOutputItemId) {
          const newItem = await tx.item.create({
            data: {
              name,
              price: parseFloat(price) || 0,
              unit: unit || "piece",
              showInPos: isActive !== false,
              isBom: true,
            },
          });
          finalOutputItemId = newItem.id;
        } else {
          // If using an existing item, make sure isBom is set to true
          await tx.item.update({
            where: { id: finalOutputItemId },
            data: { isBom: true },
          });
        }

        const bom = await tx.bOM.create({
          data: {
            name,
            outputItemId: finalOutputItemId,
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
        // Link categories to BOM and to the output Item
        if (categoryIds && categoryIds.length > 0) {
          await tx.bOMCategory.createMany({
            data: categoryIds.map((catId) => ({
              bomId: bom.id,
              categoryId: parseInt(catId),
            })),
          });
          // Mirror categories to the linked Item
          await tx.itemCategory.createMany({
            data: categoryIds.map((catId) => ({
              itemId: finalOutputItemId,
              categoryId: parseInt(catId),
            })),
            skipDuplicates: true,
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
        outputItemId,
        outputQuantity,
        isActive,
        notes,
        items,
        price,
        unit,
        categoryIds,
      } = req.body;

      let { name } = req.body;
      if (typeof name === "string") {
        name = name.trim();
      }

      const bomId = parseInt(req.params.id);

      const result = await prisma.$transaction(async (tx) => {
        const currentBom = await tx.bOM.findUnique({ where: { id: bomId } });
        if (!currentBom) {
          throw { code: "P2025" };
        }

        let finalOutputItemId = outputItemId
          ? parseInt(outputItemId)
          : currentBom.outputItemId;

        // Auto-create an Item if none is linked yet
        if (!finalOutputItemId) {
          const newItem = await tx.item.create({
            data: {
              name,
              price:
                price !== undefined
                  ? parseFloat(price)
                  : parseFloat(currentBom.price),
              unit: unit || currentBom.unit,
              showInPos: isActive !== false,
              isBom: true,
            },
          });
          finalOutputItemId = newItem.id;
        } else {
          // Keep the linked item in sync
          await tx.item.update({
            where: { id: finalOutputItemId },
            data: {
              name,
              price:
                price !== undefined
                  ? parseFloat(price)
                  : parseFloat(currentBom.price),
              unit: unit || currentBom.unit,
              showInPos: isActive !== false,
              isBom: true,
            },
          });
        }

        // If the output item changed, check if the old one is used by any other BOM. If not, set isBom to false.
        if (
          currentBom.outputItemId &&
          currentBom.outputItemId !== finalOutputItemId
        ) {
          const otherBomsUsingOldItem = await tx.bOM.count({
            where: {
              outputItemId: currentBom.outputItemId,
              id: { not: bomId },
            },
          });
          if (otherBomsUsingOldItem === 0) {
            await tx.item.update({
              where: { id: currentBom.outputItemId },
              data: { isBom: false },
            });
          }
        }

        // Update BOM fields
        await tx.bOM.update({
          where: { id: bomId },
          data: {
            name,
            outputItemId: finalOutputItemId,
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
          // Also reset item categories
          await tx.itemCategory.deleteMany({
            where: { itemId: finalOutputItemId },
          });
          if (categoryIds.length > 0) {
            await tx.bOMCategory.createMany({
              data: categoryIds.map((catId) => ({
                bomId,
                categoryId: parseInt(catId),
              })),
            });
            // Mirror to the linked Item
            await tx.itemCategory.createMany({
              data: categoryIds.map((catId) => ({
                itemId: finalOutputItemId,
                categoryId: parseInt(catId),
              })),
              skipDuplicates: true,
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
        return res.status(400).json({ error: "الوصفة موجودة بالفعل" });
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
      const bomId = parseInt(req.params.id);

      await prisma.$transaction(async (tx) => {
        const bom = await tx.bOM.findUnique({ where: { id: bomId } });
        if (!bom) throw { code: "P2025" };

        // 1. Delete ProductionOrderItems for all orders of this BOM
        const orders = await tx.productionOrder.findMany({ where: { bomId } });
        const orderIds = orders.map((o) => o.id);
        if (orderIds.length > 0) {
          await tx.productionOrderItem.deleteMany({
            where: { productionOrderId: { in: orderIds } },
          });
          await tx.productionOrder.deleteMany({ where: { bomId } });
        }

        // 2. Delete BOMItems and BOMCategories (cascade-safe)
        await tx.bOMItem.deleteMany({ where: { bomId } });
        await tx.bOMCategory.deleteMany({ where: { bomId } });

        // 3. Unlink outputItemId before deleting the BOM
        const outputItemId = bom.outputItemId;
        await tx.bOM.update({
          where: { id: bomId },
          data: { outputItemId: null },
        });

        // 4. Delete the BOM
        await tx.bOM.delete({ where: { id: bomId } });

        // 5. Delete the auto-created output Item (careful: only if nothing else references it)
        if (outputItemId) {
          try {
            await tx.itemCategory.deleteMany({
              where: { itemId: outputItemId },
            });
            await tx.item.delete({ where: { id: outputItemId } });
          } catch (e) {
            // If item is used in sales/purchases, just leave it — don't block BOM deletion
            // But since it's no longer a BOM output (or we must check), update its isBom flag
            const otherBomsUsingItem = await tx.bOM.count({
              where: { outputItemId },
            });
            if (otherBomsUsingItem === 0) {
              await tx.item.update({
                where: { id: outputItemId },
                data: { isBom: false },
              });
            }
            console.warn(
              `[BOM DELETE] Could not delete linked item ${outputItemId}, reset isBom flag instead:`,
              e.message,
            );
          }
        }
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

// ============================================================
// POST /:id/execute — Execute a production order
// ============================================================
router.post(
  "/:id/execute",
  requireCreatePermission("CREATES_PRODUCTION"),
  async (req, res) => {
    try {
      const bomId = parseInt(req.params.id);
      const {
        sourceWarehouseId,
        destWarehouseId,
        targetOutputQty,
        actualOutputQty,
        notes,
      } = req.body;

      if (!sourceWarehouseId)
        return res.status(400).json({ error: "مستودع الخصم مطلوب" });
      if (!targetOutputQty || parseFloat(targetOutputQty) <= 0)
        return res
          .status(400)
          .json({ error: "الكمية المستهدفة يجب أن تكون أكبر من صفر" });
      if (actualOutputQty === undefined || parseFloat(actualOutputQty) < 0)
        return res.status(400).json({ error: "الكمية الفعلية غير صحيحة" });
      if (parseFloat(actualOutputQty) > parseFloat(targetOutputQty))
        return res
          .status(400)
          .json({ error: "الكمية الفعلية لا يمكن أن تتجاوز الكمية المستهدفة" });

      const parsedTarget = parseFloat(targetOutputQty);
      const parsedActual = parseFloat(actualOutputQty);
      const parsedWaste = parseFloat((parsedTarget - parsedActual).toFixed(3));

      // Load BOM with items
      const bom = await prisma.bOM.findUnique({
        where: { id: bomId },
        include: { items: { include: { item: true } }, outputItem: true },
      });
      if (!bom) return res.status(404).json({ error: "BOM not found" });

      // Each material quantity is BOMItem.quantity * (targetOutputQty / bom.outputQuantity)
      const multiplier = parsedTarget / parseFloat(bom.outputQuantity);
      const materialUsage = bom.items.map((bi) => ({
        itemId: bi.itemId,
        itemName: bi.item.name,
        quantityUsed: parseFloat(
          (parseFloat(bi.quantity) * multiplier).toFixed(6),
        ),
        costPrice: parseFloat(bi.item.costPrice || 0),
      }));

      // Validate stock in source warehouse
      const inventoryChecks = await prisma.inventory.findMany({
        where: {
          warehouseId: parseInt(sourceWarehouseId),
          itemId: { in: materialUsage.map((m) => m.itemId) },
        },
      });

      const shortages = [];
      for (const mat of materialUsage) {
        const inv = inventoryChecks.find((i) => i.itemId === mat.itemId);
        const available = inv ? parseFloat(inv.quantity) : 0;
        if (available < mat.quantityUsed) {
          shortages.push({
            itemId: mat.itemId,
            itemName: mat.itemName,
            available,
            required: mat.quantityUsed,
          });
        }
      }
      if (shortages.length > 0) {
        return res
          .status(400)
          .json({ error: "رصيد غير كافٍ لبعض المواد الخام", shortages });
      }

      // Calculate total cost
      const totalCost = materialUsage.reduce(
        (sum, m) => sum + m.costPrice * m.quantityUsed,
        0,
      );

      // Execute in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Deduct raw materials from source warehouse
        for (const mat of materialUsage) {
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: mat.itemId,
                warehouseId: parseInt(sourceWarehouseId),
              },
            },
            update: { quantity: { decrement: mat.quantityUsed } },
            create: {
              itemId: mat.itemId,
              warehouseId: parseInt(sourceWarehouseId),
              quantity: 0, // Stock validated before transaction; create path shouldn't occur
            },
          });
        }

        // 2. Add finished goods to dest warehouse (if BOM has output item and destWarehouse is set)
        if (bom.outputItemId && destWarehouseId) {
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: bom.outputItemId,
                warehouseId: parseInt(destWarehouseId),
              },
            },
            update: { quantity: { increment: parsedActual } },
            create: {
              itemId: bom.outputItemId,
              warehouseId: parseInt(destWarehouseId),
              quantity: parsedActual,
            },
          });
        }

        // 3. Create production order record
        const order = await tx.productionOrder.create({
          data: {
            bomId,
            sourceWarehouseId: parseInt(sourceWarehouseId),
            destWarehouseId: destWarehouseId ? parseInt(destWarehouseId) : null,
            targetOutputQty: parsedTarget,
            actualOutputQty: parsedActual,
            outputWasteQty: parsedWaste,
            totalCost: parseFloat(totalCost.toFixed(2)),
            notes: notes || null,
            createdById: req.user.id,
            items: {
              create: materialUsage.map((m) => ({
                itemId: m.itemId,
                quantityUsed: m.quantityUsed,
              })),
            },
          },
          include: {
            bom: { select: { name: true } },
            sourceWarehouse: { select: { name: true } },
            destWarehouse: { select: { name: true } },
            items: {
              include: { item: { select: { name: true, unit: true } } },
            },
          },
        });

        return order;
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("[BOM EXECUTE]", error);
      res
        .status(500)
        .json({ error: "فشل تنفيذ أمر الإنتاج", message: error.message });
    }
  },
);

// ============================================================
// POST /production-orders/:id/cancel — Cancel & reverse a production order
// ============================================================
router.post(
  "/production-orders/:id/cancel",
  requireCreatePermission("CREATES_PRODUCTION"),
  async (req, res) => {
    const { writeAudit } = require("../utils/auditLogger");
    try {
      const orderId = parseInt(req.params.id);

      // Fetch the order with all relations needed for reversal
      const order = await prisma.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          bom: { select: { id: true, name: true, outputItemId: true } },
          sourceWarehouse: { select: { id: true, name: true } },
          destWarehouse: { select: { id: true, name: true } },
          items: { include: { item: { select: { id: true, name: true, unit: true } } } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      if (!order) {
        return res.status(404).json({ error: "أمر الإنتاج غير موجود" });
      }

      if (order.status !== "COMPLETED") {
        return res.status(400).json({ error: "هذا الأمر تم إلغاؤه مسبقاً" });
      }

      // Stock check: can we remove finished goods from dest warehouse?
      if (order.destWarehouseId && order.bom.outputItemId) {
        const finishedStock = await prisma.inventory.findUnique({
          where: {
            itemId_warehouseId: {
              itemId: order.bom.outputItemId,
              warehouseId: order.destWarehouseId,
            },
          },
        });
        const available = finishedStock ? parseFloat(finishedStock.quantity) : 0;
        const required = parseFloat(order.actualOutputQty);
        if (available < required) {
          return res.status(400).json({
            error: `لا يوجد رصيد كافٍ من المنتج النهائي للإلغاء. متاح: ${available.toFixed(3)}, مطلوب: ${required.toFixed(3)}`,
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Return raw materials to source warehouse
        for (const item of order.items) {
          await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: item.itemId,
                warehouseId: order.sourceWarehouseId,
              },
            },
            data: { quantity: { increment: parseFloat(item.quantityUsed) } },
          });
        }

        // 2. Remove finished goods from dest warehouse (if applicable)
        if (order.destWarehouseId && order.bom.outputItemId) {
          await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: order.bom.outputItemId,
                warehouseId: order.destWarehouseId,
              },
            },
            data: { quantity: { decrement: parseFloat(order.actualOutputQty) } },
          });
        }

        // 3. Create the paired RETURNED entry first (we need its id for linkedOrderId)
        const returnEntry = await tx.productionOrder.create({
          data: {
            bomId: order.bomId,
            sourceWarehouseId: order.sourceWarehouseId,
            destWarehouseId: order.destWarehouseId || null,
            targetOutputQty: order.targetOutputQty,
            actualOutputQty: order.actualOutputQty,
            outputWasteQty: order.outputWasteQty,
            totalCost: order.totalCost,
            status: "RETURNED",
            createdById: req.user.id,
            cancelledById: req.user.id,
            cancelledAt: new Date(),
            linkedOrderId: orderId,
            notes: `إلغاء أمر الإنتاج #${orderId}`,
            items: {
              create: order.items.map((i) => ({
                itemId: i.itemId,
                quantityUsed: i.quantityUsed,
              })),
            },
          },
        });

        // 4. Mark original order as CANCELLED
        const cancelled = await tx.productionOrder.update({
          where: { id: orderId },
          data: {
            status: "CANCELLED",
            cancelledById: req.user.id,
            cancelledAt: new Date(),
            linkedOrderId: returnEntry.id,
          },
        });

        return { cancelled, returnEntry };
      });

      // 5. Write audit log
      await writeAudit({
        action: "CANCEL",
        targetEntity: "production_order",
        targetId: String(orderId),
        userId: req.user.id,
        newValues: {
          cancelledById: req.user.id,
          cancelledAt: new Date(),
          returnedOrderId: result.returnEntry.id,
          bomName: order.bom.name,
        },
        oldValues: {
          status: "COMPLETED",
          targetOutputQty: order.targetOutputQty,
          actualOutputQty: order.actualOutputQty,
          totalCost: order.totalCost,
          createdById: order.createdBy?.id,
          createdByName: order.createdBy?.name,
        },
        ipAddress: req.ip,
      });

      res.json({
        message: "تم إلغاء أمر الإنتاج وإعادة المواد للمخزون",
        cancelledOrder: result.cancelled,
        returnEntry: result.returnEntry,
      });
    } catch (error) {
      console.error("[BOM CANCEL]", error);
      res.status(500).json({ error: "فشل إلغاء أمر الإنتاج", message: error.message });
    }
  },
);

// ============================================================
// PUT /production-orders/:id — Edit a production order (delete + recreate)
// ============================================================
router.put(
  "/production-orders/:id",
  requireCreatePermission("CREATES_PRODUCTION"),
  async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { targetOutputQty, actualOutputQty, outputWasteQty, notes } =
        req.body;

      if (!targetOutputQty || parseFloat(targetOutputQty) <= 0) {
        return res
          .status(400)
          .json({ error: "الكمية المستهدفة يجب أن تكون أكبر من صفر" });
      }

      const parsedTarget = parseFloat(targetOutputQty);
      const parsedActual = parseFloat(actualOutputQty || targetOutputQty);
      const parsedWaste = parseFloat(outputWasteQty || 0);

      // Fetch original order with all relations
      const original = await prisma.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          bom: { include: { items: { include: { item: true } } } },
          items: { include: { item: true } },
          sourceWarehouse: true,
          destWarehouse: true,
        },
      });

      if (!original) {
        return res.status(404).json({ error: "أمر الإنتاج غير موجود" });
      }

      if (original.status !== "COMPLETED") {
        return res.status(400).json({ error: "لا يمكن تعديل أمر ملغي أو مُرجَع" });
      }

      const { bom, sourceWarehouseId, destWarehouseId } = original;
      const bomOutputQty = Number(bom.outputQuantity);
      const newMultiplier = parsedTarget / bomOutputQty;

      // Calculate new material usage
      const newMaterialUsage = bom.items.map((bomItem) => ({
        itemId: bomItem.itemId,
        quantityUsed: Number(bomItem.quantity) * newMultiplier,
      }));

      // Validate material availability (new - old delta)
      const oldMultiplier = Number(original.targetOutputQty) / bomOutputQty;
      for (const mat of newMaterialUsage) {
        const oldUsed =
          (bom.items.find((b) => b.itemId === mat.itemId)?.quantity || 0) *
          oldMultiplier;
        const delta = mat.quantityUsed - Number(oldUsed);
        if (delta > 0) {
          const inv = await prisma.inventory.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: mat.itemId,
                warehouseId: sourceWarehouseId,
              },
            },
          });
          const avail = inv ? Number(inv.quantity) : 0;
          if (avail < delta) {
            const matName = bom.items.find(
              (b) => b.itemId === mat.itemId,
            )?.item?.name;
            return res.status(400).json({
              error: `مواد خام غير كافية: ${matName}. متاح: ${avail.toFixed(2)}, إضافة مطلوبة: ${delta.toFixed(2)}`,
            });
          }
        }
      }

      const newTotalCost = newMaterialUsage.reduce((sum, mat) => {
        const bomItem = bom.items.find((b) => b.itemId === mat.itemId);
        return sum + mat.quantityUsed * Number(bomItem?.item?.costPrice || 0);
      }, 0);

      const result = await prisma.$transaction(async (tx) => {
        // 1. Reverse original inventory changes
        //    a. Re-add raw materials to source warehouse
        for (const origItem of original.items) {
          await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: origItem.itemId,
                warehouseId: sourceWarehouseId,
              },
            },
            data: { quantity: { increment: Number(origItem.quantityUsed) } },
          });
        }
        //    b. Remove finished goods from dest warehouse
        if (bom.outputItemId && destWarehouseId) {
          await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: bom.outputItemId,
                warehouseId: destWarehouseId,
              },
            },
            data: {
              quantity: { decrement: Number(original.actualOutputQty) },
            },
          });
        }

        // 2. Delete original order items and order
        await tx.productionOrderItem.deleteMany({
          where: { productionOrderId: orderId },
        });
        await tx.productionOrder.delete({ where: { id: orderId } });

        // 3. Deduct new raw materials
        for (const mat of newMaterialUsage) {
          await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: mat.itemId,
                warehouseId: sourceWarehouseId,
              },
            },
            data: { quantity: { decrement: mat.quantityUsed } },
          });
        }

        // 4. Add new finished goods
        if (bom.outputItemId && destWarehouseId) {
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: bom.outputItemId,
                warehouseId: destWarehouseId,
              },
            },
            update: { quantity: { increment: parsedActual } },
            create: {
              itemId: bom.outputItemId,
              warehouseId: destWarehouseId,
              quantity: parsedActual,
            },
          });
        }

        // 5. Create new production order
        const newOrder = await tx.productionOrder.create({
          data: {
            bomId: bom.id,
            sourceWarehouseId,
            destWarehouseId: destWarehouseId || null,
            targetOutputQty: parsedTarget,
            actualOutputQty: parsedActual,
            outputWasteQty: parsedWaste,
            totalCost: parseFloat(newTotalCost.toFixed(2)),
            notes: notes || original.notes,
            createdById: req.user.id,
            items: {
              create: newMaterialUsage.map((m) => ({
                itemId: m.itemId,
                quantityUsed: m.quantityUsed,
              })),
            },
          },
          include: {
            bom: { select: { name: true } },
            sourceWarehouse: { select: { name: true } },
            destWarehouse: { select: { name: true } },
            items: {
              include: { item: { select: { name: true, unit: true } } },
            },
          },
        });

        return newOrder;
      });

      res.json(result);
    } catch (error) {
      console.error("[BOM EDIT PRODUCTION]", error);
      res
        .status(500)
        .json({ error: "فشل تعديل أمر الإنتاج", message: error.message });
    }
  },
);

module.exports = router;
