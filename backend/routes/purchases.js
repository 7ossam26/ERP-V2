const express = require("express");
const router = express.Router();

/**
 * Allocates totalLanded across purchase lines.
 *
 * Rules:
 * - BY_VALUE:    allocated_i = totalLanded × (line_total_i / subtotal)
 * - BY_QUANTITY: allocated_i = totalLanded × (qty_i / totalQty)
 * - MANUAL:      caller passes manualAllocatedLandedCost per line; we validate sum == totalLanded
 * - NONE:        all zero
 *
 * Rounding: values are rounded to 2 decimal places per line.
 * The rounding delta (sum − totalLanded) is absorbed into the LAST line so
 * that Σ allocatedLandedCost == totalLanded exactly.
 *
 * Returns array of { allocatedLandedCost, finalUnitCost } aligned with `items`.
 * Throws { status, message } on validation failure.
 */
function allocateLandedCost({ items, totalLanded, method }) {
  const n = items.length;
  const result = items.map(() => ({ allocatedLandedCost: 0, finalUnitCost: 0 }));

  if (method === "NONE" || totalLanded === 0) {
    items.forEach((item, i) => {
      result[i].finalUnitCost = parseFloat(item.purchasePrice);
    });
    return result;
  }

  let rawAllocations;

  if (method === "BY_VALUE") {
    const subtotal = items.reduce((s, item) => s + parseFloat(item.purchasePrice) * parseFloat(item.quantity), 0);
    if (subtotal === 0) {
      throw { status: 400, message: "لا يمكن توزيع التكاليف الإضافية على فاتورة قيمتها صفر" };
    }
    rawAllocations = items.map(item => {
      const lineTotal = parseFloat(item.purchasePrice) * parseFloat(item.quantity);
      return totalLanded * (lineTotal / subtotal);
    });

  } else if (method === "BY_QUANTITY") {
    const totalQty = items.reduce((s, item) => s + parseFloat(item.quantity), 0);
    if (totalQty === 0) {
      throw { status: 400, message: "لا يمكن توزيع التكاليف الإضافية على فاتورة قيمتها صفر" };
    }
    rawAllocations = items.map(item => {
      return totalLanded * (parseFloat(item.quantity) / totalQty);
    });

  } else if (method === "MANUAL") {
    const manualSum = items.reduce((s, item) => s + parseFloat(item.manualAllocatedLandedCost || 0), 0);
    const diff = Math.abs(manualSum - totalLanded);
    if (diff > 0.02) {
      throw {
        status: 400,
        message: `مجموع التوزيع اليدوي (${manualSum.toFixed(2)}) لا يساوي إجمالي التكاليف الإضافية (${totalLanded.toFixed(2)})`,
      };
    }
    rawAllocations = items.map(item => parseFloat(item.manualAllocatedLandedCost || 0));

  } else {
    throw { status: 400, message: `طريقة توزيع غير معروفة: ${method}` };
  }

  // Round to 2 decimals, absorb rounding delta into last line
  let runningSum = 0;
  for (let i = 0; i < n - 1; i++) {
    const rounded = Math.round(rawAllocations[i] * 100) / 100;
    result[i].allocatedLandedCost = rounded;
    runningSum += rounded;
  }
  // Last line absorbs rounding error
  result[n - 1].allocatedLandedCost = Math.round((totalLanded - runningSum) * 100) / 100;

  // Compute finalUnitCost per line
  items.forEach((item, i) => {
    const qty = parseFloat(item.quantity);
    const alloc = result[i].allocatedLandedCost;
    result[i].finalUnitCost = Math.round((parseFloat(item.purchasePrice) + (qty > 0 ? alloc / qty : 0)) * 100) / 100;
  });

  return result;
}

/**
 * Validates that fabric line items have rolls arrays whose lengths sum exactly
 * to the line quantity. Also checks each roll has originalLength > 0.
 *
 * @param {Array} items - purchase line items
 * @param {Object} itemTypeMap - { [itemId]: itemType } pre-fetched
 * Throws { status, message } on failure.
 */
function validateFabricRolls(items, itemTypeMap) {
  for (const item of items) {
    const isFabric = itemTypeMap[parseInt(item.itemId)] === "FABRIC";
    if (!isFabric) continue;

    const rolls = item.rolls || [];
    if (rolls.length === 0) {
      throw {
        status: 400,
        message: `الصنف ${item.itemId} من نوع قماش — يجب تحديد اللفات (rolls)`,
      };
    }

    const rollsTotal = rolls.reduce((s, r) => s + parseFloat(r.originalLength || 0), 0);
    const lineQty = parseFloat(item.quantity);
    const diff = Math.abs(rollsTotal - lineQty);
    if (diff > 0.001) {
      throw {
        status: 400,
        message: `مجموع أطوال اللفات (${rollsTotal}) لا يساوي كمية السطر (${lineQty}) للصنف ${item.itemId}`,
      };
    }

    for (const roll of rolls) {
      if (!roll.originalLength || parseFloat(roll.originalLength) <= 0) {
        throw { status: 400, message: `كل لفة يجب أن يكون لها طول أصلي أكبر من صفر` };
      }
    }
  }
}

const prisma = require("../config/database");
const { authenticateToken, requirePermission, getUserBranchFilter } = require("../middleware/auth");
const { generateRollNumber } = require("../services/rollNumberService");

// Protect all routes with PURCHASES permission
router.use(authenticateToken, requirePermission("PURCHASES"));

// GET all purchases
router.get("/", async (req, res, next) => {
  try {
    const branchId = await getUserBranchFilter(req.user.id, req);
    // Purchases are linked to a warehouse. Branches are linked to a warehouse.
    // However, the Purchase model links to `warehouse`. 
    // We should filter purchases where the warehouse belongs to the user's branch.
    // OR, if the purchase has a branchId field? Let's check schema.
    // Assuming Purchase has branchId or we filter by warehouse.branch.
    // Simplifying assumption: Purchase has branchId or we filter by warehouseId linked to branch.
    // Let's check schema first.
    // If Purchase doesn't have branchId, we need to find the warehouseId for the branch.

    let whereClause = {};
    if (branchId) {
      // branchId is actually a filter object (e.g. { id: 1 } or { id: { in: [...] } })
      const branches = await prisma.branch.findMany({
        where: branchId,
        select: { warehouseId: true }
      });

      const warehouseIds = branches.map((b) => b.warehouseId).filter((id) => id);

      if (warehouseIds.length > 0) {
        whereClause = { warehouseId: { in: warehouseIds } };
      } else {
        whereClause = { id: -1 }; // Force empty result
      }
    }

    // Phase 4 filters
    if (req.query.isInternational !== undefined) {
      whereClause.isInternational = req.query.isInternational === "true";
    }
    if (req.query.hasLandedCost !== undefined) {
      whereClause.landedCostEnabled = req.query.hasLandedCost === "true";
    }

    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: true,
        treasury: true,
        warehouse: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });
    res.json(purchases);
  } catch (error) {
    next(error);
  }
});

// GET search purchases (must be before /:id)
router.get("/search", async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const branchId = await getUserBranchFilter(req.user.id, req);
    let whereClause = {};
    if (branchId) {
      const branches = await prisma.branch.findMany({
        where: branchId,
        select: { warehouseId: true },
      });
      const warehouseIds = branches.map((b) => b.warehouseId).filter(Boolean);
      if (warehouseIds.length > 0) {
        whereClause = { warehouseId: { in: warehouseIds } };
      } else {
        return res.json([]);
      }
    }

    const numericId = parseInt(q);
    const purchases = await prisma.purchase.findMany({
      where: {
        ...whereClause,
        OR: [
          ...(isNaN(numericId) ? [] : [{ id: numericId }]),
          { supplierInvoiceNo: { contains: q } },
          { supplier: { name: { contains: q } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        supplier: true,
        treasury: true,
        warehouse: true,
        items: { include: { item: true } },
        returns: true,
      },
    });
    res.json(purchases);
  } catch (error) {
    next(error);
  }
});

// GET purchase by ID
router.get("/:id", async (req, res, next) => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        supplier: true,
        treasury: true,
        warehouse: true,
        items: { include: { item: true } },
        returns: { include: { items: true } },
      },
    });

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    // Phase 4: attach generated rolls per fabric line
    const fabricItemIds = purchase.items
      .filter(li => li.item.itemType === "FABRIC")
      .map(li => li.itemId);

    let rollsByItemId = {};
    if (fabricItemIds.length > 0) {
      const rolls = await prisma.fabricRoll.findMany({
        where: {
          itemId: { in: fabricItemIds },
          warehouseId: purchase.warehouseId,
        },
        select: {
          id: true,
          rollNumber: true,
          originalLength: true,
          remainingLength: true,
          status: true,
          unitCost: true,
          barcode: true,
          itemId: true,
        },
      });
      rolls.forEach(r => {
        if (!rollsByItemId[r.itemId]) rollsByItemId[r.itemId] = [];
        rollsByItemId[r.itemId].push(r);
      });
    }

    const enrichedItems = purchase.items.map(li => ({
      ...li,
      fabricRolls: rollsByItemId[li.itemId] || [],
    }));

    res.json({ ...purchase, items: enrichedItems });
  } catch (error) {
    next(error);
  }
});

// POST create new purchase
router.post("/", async (req, res, next) => {
  try {
    const {
      supplierId,
      treasuryId,
      warehouseId,
      supplierInvoiceNo,
      paymentMethod,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      netTotal,
      paidAmount,
      remaining,
      items,
      // Phase 4 — landed cost
      isInternational = false,
      landedCostEnabled = false,
      landedCostAllocation = "NONE",
      freightCost = 0,
      customsCost = 0,
      clearanceCost = 0,
      otherLandedCost = 0,
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────
    if (!supplierId) return res.status(400).json({ error: "Supplier is required" });
    if (!treasuryId) return res.status(400).json({ error: "Treasury is required" });
    if (!items || items.length === 0) return res.status(400).json({ error: "At least one item is required" });

    // ── Resolve warehouse ────────────────────────────────────────────────
    let effectiveWarehouseId = warehouseId;
    if (!effectiveWarehouseId) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { branch: true },
      });
      if (!user || !user.branch || !user.branch.warehouseId) {
        return res.status(400).json({ error: "Warehouse is required and user's branch warehouse is not configured." });
      }
      effectiveWarehouseId = user.branch.warehouseId;
    }

    // ── Pre-fetch item types (needed for fabric validation) ──────────────
    const itemIds = items.map(i => parseInt(i.itemId));
    const dbItems = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, itemType: true },
    });
    const itemTypeMap = {};
    dbItems.forEach(i => { itemTypeMap[i.id] = i.itemType; });

    // ── Validate fabric rolls ───────────────────────────────────────────
    try {
      validateFabricRolls(items, itemTypeMap);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // ── Compute landed cost totals ──────────────────────────────────────
    const totalLanded = landedCostEnabled
      ? parseFloat(freightCost) + parseFloat(customsCost) + parseFloat(clearanceCost) + parseFloat(otherLandedCost)
      : 0;

    // ── Allocate landed cost per line ───────────────────────────────────
    let lineAllocations;
    try {
      lineAllocations = allocateLandedCost({
        items,
        totalLanded,
        method: landedCostEnabled ? landedCostAllocation : "NONE",
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // ── Main transaction ────────────────────────────────────────────────
    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          supplierId: parseInt(supplierId),
          treasuryId: parseInt(treasuryId),
          warehouseId: parseInt(effectiveWarehouseId),
          supplierInvoiceNo: supplierInvoiceNo || null,
          paymentMethod: paymentMethod || "CASH",
          subtotal: parseFloat(subtotal),
          discountType: discountType || "PERCENTAGE",
          discountValue: parseFloat(discountValue) || 0,
          discountAmount: parseFloat(discountAmount) || 0,
          netTotal: parseFloat(netTotal),
          paidAmount: parseFloat(paidAmount) || 0,
          remaining: parseFloat(remaining) || 0,
          // Phase 4
          isInternational: Boolean(isInternational),
          shippingCost: parseFloat(freightCost) || 0,
          customsDuty: parseFloat(customsCost) || 0,
          clearanceCost: parseFloat(clearanceCost) || 0,
          otherLandingCosts: parseFloat(otherLandedCost) || 0,
          landedCostEnabled: Boolean(landedCostEnabled),
          landedCostAllocation: landedCostEnabled ? landedCostAllocation : "NONE",
          paymentStatus:
            (paymentMethod || "CASH") === "DEFERRED" ? "UNPAID" :
            (paymentMethod || "CASH") === "MIXED" ? "PARTIALLY_PAID" : "PAID",
        },
      });

      // 2. Create PurchaseItems + inventory + fabric rolls
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const alloc = lineAllocations[i];
        const isFabric = itemTypeMap[parseInt(item.itemId)] === "FABRIC";

        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            itemId: parseInt(item.itemId),
            quantity: parseFloat(item.quantity),
            purchasePrice: parseFloat(item.purchasePrice),
            sellPrice: parseFloat(item.sellPrice) || 0,
            total: parseFloat(item.total),
            allocatedLandedCost: alloc.allocatedLandedCost,
            finalUnitCost: alloc.finalUnitCost,
          },
        });

        // Update item cost/sell prices
        const updateData = {};
        const finalCost = alloc.finalUnitCost > 0 ? alloc.finalUnitCost : parseFloat(item.purchasePrice);
        if (finalCost > 0) updateData.costPrice = finalCost;
        if (parseFloat(item.sellPrice) > 0) updateData.price = parseFloat(item.sellPrice);
        if (Object.keys(updateData).length > 0) {
          await tx.item.update({
            where: { id: parseInt(item.itemId) },
            data: updateData,
          });
        }

        if (isFabric) {
          // 3a. Fabric line: generate rolls inside the same transaction
          const rolls = item.rolls || [];
          for (const rollInput of rolls) {
            const rollNumber = await generateRollNumber(tx);
            await tx.fabricRoll.create({
              data: {
                itemId: parseInt(item.itemId),
                warehouseId: parseInt(effectiveWarehouseId),
                rollNumber,
                lengthMeters: parseFloat(rollInput.originalLength),
                originalLength: parseFloat(rollInput.originalLength),
                remainingLength: parseFloat(rollInput.originalLength),
                status: "AVAILABLE",
                unitCost: rollInput.unitCost != null ? parseFloat(rollInput.unitCost) : alloc.finalUnitCost,
                barcode: rollInput.barcode || null,
                notes: rollInput.notes || null,
              },
            });

            // Upsert inventory for each roll
            await tx.inventory.upsert({
              where: {
                itemId_warehouseId: {
                  itemId: parseInt(item.itemId),
                  warehouseId: parseInt(effectiveWarehouseId),
                },
              },
              update: { quantity: { increment: parseFloat(rollInput.originalLength) } },
              create: {
                itemId: parseInt(item.itemId),
                warehouseId: parseInt(effectiveWarehouseId),
                quantity: parseFloat(rollInput.originalLength),
              },
            });
          }
        } else {
          // 3b. Non-fabric line: plain inventory increment
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: parseInt(item.itemId),
                warehouseId: parseInt(effectiveWarehouseId),
              },
            },
            update: { quantity: { increment: parseFloat(item.quantity) } },
            create: {
              itemId: parseInt(item.itemId),
              warehouseId: parseInt(effectiveWarehouseId),
              quantity: parseFloat(item.quantity),
            },
          });
        }
      }

      // 4. Financial effects
      const netTotalNum = parseFloat(netTotal);
      const paidAmountNum = parseFloat(paidAmount) || 0;
      const remainingNum = parseFloat(remaining) || 0;
      const effectiveMethod = paymentMethod || "CASH";

      if (effectiveMethod === "CASH" || effectiveMethod === "CREDIT") {
        const treasury = await tx.treasury.findUnique({ where: { id: parseInt(treasuryId) } });
        if (!treasury) {
          const err = new Error("Treasury not found");
          err.status = 404;
          throw err;
        }
        if (parseFloat(treasury.balance) < netTotalNum) {
          const err = new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
          err.status = 400;
          throw err;
        }
        await tx.treasury.update({
          where: { id: parseInt(treasuryId) },
          data: { balance: { decrement: netTotalNum } },
        });
        await tx.expense.create({
          data: {
            description: `Purchase Invoice #${supplierInvoiceNo || newPurchase.id}`,
            amount: netTotalNum,
            date: new Date(),
            type: "PURCHASE",
            treasuryId: parseInt(treasuryId),
            purchaseId: newPurchase.id,
            paymentMethod: effectiveMethod === "CREDIT" ? "CARD" : "CASH",
          },
        });

      } else if (effectiveMethod === "DEFERRED") {
        await tx.supplierAccount.upsert({
          where: { supplierId: parseInt(supplierId) },
          update: { balance: { increment: netTotalNum } },
          create: { supplierId: parseInt(supplierId), balance: netTotalNum },
        });

      } else if (effectiveMethod === "MIXED") {
        if (paidAmountNum > 0) {
          const treasury = await tx.treasury.findUnique({ where: { id: parseInt(treasuryId) } });
          if (!treasury) {
            const err = new Error("Treasury not found");
            err.status = 404;
            throw err;
          }
          if (parseFloat(treasury.balance) < paidAmountNum) {
            const err = new Error("رصيد الخزينة غير كافي للدفع الجزئي");
            err.status = 400;
            throw err;
          }
          await tx.treasury.update({
            where: { id: parseInt(treasuryId) },
            data: { balance: { decrement: paidAmountNum } },
          });
          await tx.expense.create({
            data: {
              description: `Purchase Invoice #${supplierInvoiceNo || newPurchase.id} (Partial Payment)`,
              amount: paidAmountNum,
              date: new Date(),
              type: "PURCHASE",
              treasuryId: parseInt(treasuryId),
              purchaseId: newPurchase.id,
              paymentMethod: "CASH",
            },
          });
        }
        if (remainingNum > 0) {
          await tx.supplierAccount.upsert({
            where: { supplierId: parseInt(supplierId) },
            update: { balance: { increment: remainingNum } },
            create: { supplierId: parseInt(supplierId), balance: remainingNum },
          });
        }
      }

      // Return with all relations
      return tx.purchase.findUnique({
        where: { id: newPurchase.id },
        include: {
          supplier: true,
          treasury: true,
          warehouse: true,
          items: { include: { item: true } },
        },
      });
    });

    res.status(201).json(purchase);
  } catch (error) {
    next(error);
  }
});

// PUT update purchase
router.put("/:id", async (req, res, next) => {
  try {
    const {
      supplierId,
      treasuryId,
      warehouseId,
      supplierInvoiceNo,
      paymentMethod,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      netTotal,
      paidAmount,
      remaining,
      items,
      // Phase 4
      isInternational = false,
      landedCostEnabled = false,
      landedCostAllocation = "NONE",
      freightCost = 0,
      customsCost = 0,
      clearanceCost = 0,
      otherLandedCost = 0,
    } = req.body;
    const purchaseId = parseInt(req.params.id);

    // Phase 4: compute landed cost allocations
    let lineAllocations;
    try {
      const totalLanded = landedCostEnabled
        ? parseFloat(freightCost) + parseFloat(customsCost) + parseFloat(clearanceCost) + parseFloat(otherLandedCost)
        : 0;
      lineAllocations = allocateLandedCost({
        items: items || [],
        totalLanded,
        method: landedCostEnabled ? landedCostAllocation : "NONE",
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const purchase = await prisma.$transaction(async (prisma) => {
      // 1. Get old purchase details for financial adjustment
      const oldPurchase = await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: { items: true },
      });

      if (!oldPurchase) {
        const err = new Error("Purchase not found");
        err.status = 404;
        throw err;
      }

      // 2. Refund Old Amount (User requested feature)
      if (Number(oldPurchase.paidAmount) > 0) {
        await prisma.treasury.update({
          where: { id: oldPurchase.treasuryId },
          data: {
            balance: { increment: Number(oldPurchase.paidAmount) },
          },
        });
      }

      // 3. Update basic fields
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          supplierId: parseInt(supplierId),
          treasuryId: parseInt(treasuryId),
          warehouseId: parseInt(warehouseId),
          supplierInvoiceNo,
          paymentMethod,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          netTotal,
          paidAmount,
          remaining,
          // Phase 4
          isInternational: Boolean(isInternational),
          shippingCost: parseFloat(freightCost) || 0,
          customsDuty: parseFloat(customsCost) || 0,
          clearanceCost: parseFloat(clearanceCost) || 0,
          otherLandingCosts: parseFloat(otherLandedCost) || 0,
          landedCostEnabled: Boolean(landedCostEnabled),
          landedCostAllocation: landedCostEnabled ? landedCostAllocation : "NONE",
        },
      });

      // 6.6 Decrement Old Items from Inventory
      // We must decrement the stock for the items that were in the OLD purchase
      // The oldPurchase fetched at the start needs to include items
      if (oldPurchase.items && oldPurchase.items.length > 0) {
        for (const item of oldPurchase.items) {
          await prisma.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: item.itemId,
                // Assuming the warehouse didn't change for the item.
                // However, the purchase itself has a warehouseId.
                // We should use the OLD warehouseId.
                warehouseId: oldPurchase.warehouseId,
              },
            },
            data: {
              quantity: { decrement: Number(item.quantity) },
            },
          });
        }
      }

      // 4. Delete old items and create new ones
      if (items) {
        await prisma.purchaseItem.deleteMany({
          where: { purchaseId },
        });

        if (items.length > 0) {
          await prisma.purchaseItem.createMany({
            data: items.map((item, idx) => ({
              purchaseId,
              itemId: parseInt(item.itemId),
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
              sellPrice: item.sellPrice,
              total: item.total,
              allocatedLandedCost: lineAllocations[idx].allocatedLandedCost,
              finalUnitCost: lineAllocations[idx].finalUnitCost,
            })),
          });

          // 6.7 Increment New Items to Inventory
          // We must increment the stock for the NEW items
          let newWarehouseId = warehouseId ? parseInt(warehouseId) : oldPurchase.warehouseId;

          for (const item of items) {
            await prisma.inventory.upsert({
              where: {
                itemId_warehouseId: {
                  itemId: parseInt(item.itemId),
                  warehouseId: newWarehouseId,
                },
              },
              update: {
                quantity: { increment: Number(item.quantity) },
              },
              create: {
                itemId: parseInt(item.itemId),
                warehouseId: newWarehouseId,
                quantity: Number(item.quantity),
              },
            });
          }
        }
      }

      // 5. Deduct New Amount — verify treasury has sufficient balance first (NEW-08 fix)
      if (Number(paidAmount) > 0) {
        const newTreasury = await prisma.treasury.findUnique({
          where: { id: parseInt(treasuryId) },
        });
        if (!newTreasury) {
          const err = new Error("Treasury not found");
          err.status = 404;
          throw err;
        }
        if (Number(newTreasury.balance) < Number(paidAmount)) {
          const err = new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
          err.status = 400;
          throw err;
        }
        await prisma.treasury.update({
          where: { id: parseInt(treasuryId) },
          data: {
            balance: { decrement: Number(paidAmount) },
          },
        });
      }

      // 6. Sync Expense Record
      if (Number(paidAmount) > 0) {
        const expenseMethod = paymentMethod === "CASH" ? "CASH" : "CARD";
        await prisma.expense.upsert({
          where: { purchaseId: purchaseId },
          update: {
            amount: Number(paidAmount),
            treasuryId: parseInt(treasuryId),
            paymentMethod: expenseMethod,
            description: `Purchase Invoice #${supplierInvoiceNo || purchaseId}`,
          },
          create: {
            description: `Purchase Invoice #${supplierInvoiceNo || purchaseId}`,
            amount: Number(paidAmount),
            date: oldPurchase.createdAt, // Keep original date
            type: "PURCHASE",
            treasuryId: parseInt(treasuryId),
            purchaseId: purchaseId,
            paymentMethod: expenseMethod,
          },
        });
      } else {
        // If paidAmount became 0, we should delete the expense record if it exists
        // But upsert doesn't convert to delete.
        // We can try deleteMany (safe if not exists)
        await prisma.expense.deleteMany({
          where: { purchaseId: purchaseId },
        });
      }

      // 7. Return updated purchase with relations
      return await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          supplier: true,
          treasury: true,
          warehouse: true,
          items: {
            include: {
              item: true,
            },
          },
        },
      });
    });

    res.json(purchase);
  } catch (error) {
    next(error);
  }
});

// NOTE: Purchase returns do NOT reverse landed cost allocation.
// Only original purchasePrice × quantity is reversed on return.
// This is by design — landed cost is a one-way cost absorption.

// DELETE purchase
router.delete("/:id", async (req, res, next) => {
  try {
    const purchaseId = parseInt(req.params.id);

    await prisma.$transaction(async (prisma) => {
      // 1. Get purchase details before deletion
      const purchase = await prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: { items: true },
      });

      if (!purchase) {
        throw new Error("Purchase not found");
      }

      // 2. Refund Treasury
      if (Number(purchase.paidAmount) > 0) {
        await prisma.treasury.update({
          where: { id: purchase.treasuryId },
          data: {
            balance: { increment: Number(purchase.paidAmount) },
          },
        });
      }

      // 2.5 Revert Stock (Remove items from Inventory)
      if (purchase.items && purchase.items.length > 0) {
        for (const item of purchase.items) {
          await prisma.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: item.itemId,
                warehouseId: purchase.warehouseId,
              },
            },
            data: {
              quantity: { decrement: Number(item.quantity) },
            },
          });
        }
      }

      // 3. Delete Purchase (Cascade deletes Expense and Items)
      await prisma.purchase.delete({
        where: { id: purchaseId },
      });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST create a purchase return (مرتجع)
router.post("/:id/return", async (req, res, next) => {
  try {
    const purchaseId = parseInt(req.params.id);
    const { items, managerUsername, managerPassword, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "يرجى اختيار صنف واحد على الأقل للإرجاع" });
    }
    if (!managerUsername || !managerPassword) {
      return res.status(400).json({ error: "بيانات المدير مطلوبة" });
    }

    // Verify manager credentials
    const bcrypt = require("bcryptjs");
    const manager = await prisma.user.findUnique({
      where: { username: managerUsername },
      include: { role: true },
    });
    if (!manager) {
      return res.status(401).json({ error: "اسم المستخدم غير موجود" });
    }
    const isValidPassword = await bcrypt.compare(managerPassword, manager.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "كلمة مرور المدير غير صحيحة" });
    }
    const allowedRoles = ["Superadmin", "Manager", "Branch Manager", "General Manager"];
    if (!allowedRoles.includes(manager.role?.name)) {
      return res.status(403).json({ error: "ليس لديك صلاحية اعتماد الإرجاع" });
    }

    // Get original purchase
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: { include: { item: true } } },
    });
    if (!purchase) {
      return res.status(404).json({ error: "الفاتورة غير موجودة" });
    }

    // Validate items & quantities
    for (const ri of items) {
      const orig = purchase.items.find((pi) => pi.itemId === parseInt(ri.itemId));
      if (!orig) {
        return res.status(400).json({ error: `الصنف رقم ${ri.itemId} غير موجود في الفاتورة` });
      }
      // Check against already-returned quantities
      const alreadyReturned = await prisma.purchaseReturnItem.aggregate({
        where: {
          itemId: parseInt(ri.itemId),
          purchaseReturn: { purchaseId },
        },
        _sum: { quantity: true },
      });
      const returnedSoFar = Number(alreadyReturned._sum.quantity || 0);
      if (Number(ri.quantity) > Number(orig.quantity) - returnedSoFar) {
        return res.status(400).json({
          error: `كمية الإرجاع للصنف "${orig.item.name}" تتجاوز الكمية المتاحة للإرجاع`,
        });
      }
      // Check current warehouse stock — cannot return more than what's physically in stock
      const currentStock = await prisma.inventory.findUnique({
        where: {
          itemId_warehouseId: {
            itemId: parseInt(ri.itemId),
            warehouseId: purchase.warehouseId,
          },
        },
      });
      const availableQty = currentStock ? Number(currentStock.quantity) : 0;
      if (Number(ri.quantity) > availableQty) {
        return res.status(400).json({
          error: `لا يوجد مخزون كافٍ للصنف "${orig.item.name}" — المتاح: ${availableQty}، المطلوب إرجاعه: ${ri.quantity}`,
        });
      }
    }

    // Calculate return amount (proportional discount applied)
    const discountRatio =
      Number(purchase.subtotal) > 0
        ? Number(purchase.discountAmount) / Number(purchase.subtotal)
        : 0;
    let returnSubtotal = 0;
    for (const ri of items) {
      const orig = purchase.items.find((pi) => pi.itemId === parseInt(ri.itemId));
      returnSubtotal += Number(ri.quantity) * Number(orig.purchasePrice);
    }
    const returnAmount = returnSubtotal * (1 - discountRatio);

    const result = await prisma.$transaction(async (tx) => {
      // Generate unique return number
      const count = await tx.purchaseReturn.count();
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const returnNumber = `RET-${yearMonth}-${String(count + 1).padStart(5, "0")}`;

      // Create PurchaseReturn record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          purchaseId,
          returnNumber,
          notes: notes || null,
          totalAmount: returnAmount,
          items: {
            create: items.map((ri) => {
              const orig = purchase.items.find((pi) => pi.itemId === parseInt(ri.itemId));
              return {
                itemId: parseInt(ri.itemId),
                quantity: Number(ri.quantity),
                purchasePrice: Number(orig.purchasePrice),
                total: Number(ri.quantity) * Number(orig.purchasePrice),
              };
            }),
          },
        },
        include: { items: { include: { item: true } } },
      });

      // Reverse inventory (decrease warehouse stock)
      for (const ri of items) {
        await tx.inventory.update({
          where: {
            itemId_warehouseId: {
              itemId: parseInt(ri.itemId),
              warehouseId: purchase.warehouseId,
            },
          },
          data: { quantity: { decrement: Number(ri.quantity) } },
        });
      }

      // Update purchase remaining & mark as RETURNED if fully returned
      const newRemaining = Math.max(0, Number(purchase.remaining) - returnAmount);
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          remaining: newRemaining,
          paymentStatus: newRemaining === 0 ? "RETURNED" : purchase.paymentStatus,
        },
      });

      // Reverse financial effects based on original payment method
      const paidRatio =
        Number(purchase.netTotal) > 0
          ? Number(purchase.paidAmount) / Number(purchase.netTotal)
          : 0;

      if (purchase.paymentMethod === "CASH" || purchase.paymentMethod === "CREDIT") {
        // Full payment was made — refund money back to treasury
        await tx.treasury.update({
          where: { id: purchase.treasuryId },
          data: { balance: { increment: returnAmount } },
        });
      } else if (purchase.paymentMethod === "DEFERRED") {
        // Nothing was paid — reduce the debt owed to supplier
        await tx.supplierAccount.updateMany({
          where: { supplierId: purchase.supplierId },
          data: { balance: { decrement: returnAmount } },
        });
      } else if (purchase.paymentMethod === "MIXED") {
        // Proportional: partial treasury refund + partial supplier account reduction
        const treasuryRefund = returnAmount * paidRatio;
        const supplierReduction = returnAmount * (1 - paidRatio);
        if (treasuryRefund > 0) {
          await tx.treasury.update({
            where: { id: purchase.treasuryId },
            data: { balance: { increment: treasuryRefund } },
          });
        }
        if (supplierReduction > 0) {
          await tx.supplierAccount.updateMany({
            where: { supplierId: purchase.supplierId },
            data: { balance: { decrement: supplierReduction } },
          });
        }
      }

      return purchaseReturn;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
