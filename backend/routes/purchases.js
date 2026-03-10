const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, getUserBranchFilter } = require("../middleware/auth");

// Protect all routes with PURCHASES permission
router.use(authenticateToken, requirePermission("PURCHASES"));

// GET all purchases
router.get("/", async (req, res, next) => {
  try {
    const branchId = await getUserBranchFilter(req.user.id);
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

    const branchId = await getUserBranchFilter(req.user.id);
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
        items: {
          include: {
            item: true,
          },
        },
      },
    });
    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }
    res.json(purchase);
  } catch (error) {
    next(error);
  }
});

// POST create new purchase
router.post("/", async (req, res, next) => {
  try {
    console.log("📦 Received purchase creation request");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

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
    } = req.body;

    if (!supplierId) {
      console.error("❌ Validation failed: Supplier is required");
      return res.status(400).json({ error: "Supplier is required" });
    }
    if (!treasuryId) {
      console.error("❌ Validation failed: Treasury is required");
      return res.status(400).json({ error: "Treasury is required" });
    }

    let effectiveWarehouseId = warehouseId;

    if (!effectiveWarehouseId) {
      // Fallback to user's branch warehouse if not provided
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { branch: true },
      });

      if (!user || !user.branch || !user.branch.warehouseId) {
        return res.status(400).json({
          error: "Warehouse is required and user's branch warehouse is not configured.",
        });
      }
      effectiveWarehouseId = user.branch.warehouseId;
      console.log(`📍 Using branch warehouse ID: ${effectiveWarehouseId} for user's branch: ${user.branch.name}`);
    }

    if (!items || items.length === 0) {
      console.error("❌ Validation failed: At least one item is required");
      return res.status(400).json({ error: "At least one item is required" });
    }

    console.log("✅ Validations passed, creating purchase...");

    const purchase = await prisma.$transaction(async (prisma) => {
      // 1. Create Purchase Record
      const newPurchase = await prisma.purchase.create({
        data: {
          supplierId: parseInt(supplierId),
          treasuryId: parseInt(treasuryId),
          warehouseId: parseInt(effectiveWarehouseId),
          supplierInvoiceNo,
          paymentMethod: paymentMethod || "CASH",
          subtotal,
          discountType: discountType || "PERCENTAGE",
          discountValue,
          discountAmount,
          netTotal,
          paidAmount,
          remaining,
          items: {
            create: items.map((item) => ({
              itemId: parseInt(item.itemId),
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
              sellPrice: item.sellPrice,
              total: item.total,
            })),
          },
        },
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

      // 2. Update Inventory for each item
      for (const item of items) {
        await prisma.inventory.upsert({
          where: {
            itemId_warehouseId: {
              itemId: parseInt(item.itemId),
              warehouseId: parseInt(effectiveWarehouseId),
            },
          },
          update: {
            quantity: { increment: Number(item.quantity) },
          },
          create: {
            itemId: parseInt(item.itemId),
            warehouseId: parseInt(effectiveWarehouseId),
            quantity: Number(item.quantity),
          },
        });
      }

      // 2.5 Update Item Selling Price & Cost Price
      for (const item of items) {
        const updateData = {};
        if (item.sellPrice && Number(item.sellPrice) > 0) {
          updateData.price = Number(item.sellPrice);
        }
        if (item.purchasePrice && Number(item.purchasePrice) > 0) {
          updateData.costPrice = Number(item.purchasePrice);
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.item.update({
            where: { id: parseInt(item.itemId) },
            data: updateData,
          });
        }
      }

      // 3. Handle Payment Methods and Treasury/Expense Logic
      // CASH: Pay with cash now - deduct full amount, create full expense
      // CREDIT: Pay with card now - deduct full amount, create expense as CARD
      // DEFERRED: Pay later (آجل) - NO deduction, NO expense, add to supplier account
      // MIXED: Partial payment now + partial later

      if (paymentMethod === "CASH" || paymentMethod === "CREDIT") {
        // Full payment now (cash or card)
        // Check treasury balance first
        const treasury = await prisma.treasury.findUnique({
          where: { id: parseInt(treasuryId) },
        });

        if (!treasury) {
          const err = new Error("Treasury not found");
          err.status = 404;
          throw err;
        }

        if (Number(treasury.balance) < Number(netTotal)) {
          const err = new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
          err.status = 400;
          throw err;
        }

        // Deduct from treasury
        await prisma.treasury.update({
          where: { id: parseInt(treasuryId) },
          data: {
            balance: { decrement: Number(netTotal) },
          },
        });

        // Create expense (map CREDIT to CARD for expense record)
        const expenseMethod = paymentMethod === "CASH" ? "CASH" : "CARD";
        await prisma.expense.create({
          data: {
            description: `Purchase Invoice #${supplierInvoiceNo || newPurchase.id}`,
            amount: Number(netTotal),
            date: new Date(),
            type: "PURCHASE",
            treasuryId: parseInt(treasuryId),
            purchaseId: newPurchase.id,
            paymentMethod: expenseMethod,
          },
        });

        // Update purchase payment status to PAID
        await prisma.purchase.update({
          where: { id: newPurchase.id },
          data: { paymentStatus: "PAID" },
        });
      } else if (paymentMethod === "DEFERRED") {
        // Pay later (آجل) - NO treasury deduction, NO expense
        // Add full amount to supplier account balance
        await prisma.supplierAccount.upsert({
          where: { supplierId: parseInt(supplierId) },
          update: {
            balance: { increment: Number(netTotal) },
          },
          create: {
            supplierId: parseInt(supplierId),
            balance: Number(netTotal),
          },
        });

        // Update purchase payment status to UNPAID
        await prisma.purchase.update({
          where: { id: newPurchase.id },
          data: { paymentStatus: "UNPAID" },
        });
      } else if (paymentMethod === "MIXED") {
        // Partial payment (part now, part later)
        if (Number(paidAmount) > 0) {
          // Check treasury balance for paid amount
          const treasury = await prisma.treasury.findUnique({
            where: { id: parseInt(treasuryId) },
          });

          if (!treasury) {
            const err = new Error("Treasury not found");
            err.status = 404;
            throw err;
          }

          if (Number(treasury.balance) < Number(paidAmount)) {
            const err = new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
            err.status = 400;
            throw err;
          }

          // Deduct paid amount from treasury
          await prisma.treasury.update({
            where: { id: parseInt(treasuryId) },
            data: {
              balance: { decrement: Number(paidAmount) },
            },
          });

          // Create partial expense
          // Note: For mixed, we don't track if paid amount was cash or card
          // Defaulting to CASH, but could add UI field for this later
          await prisma.expense.create({
            data: {
              description: `Purchase Invoice #${supplierInvoiceNo || newPurchase.id} (Partial Payment)`,
              amount: Number(paidAmount),
              date: new Date(),
              type: "PURCHASE",
              treasuryId: parseInt(treasuryId),
              purchaseId: newPurchase.id,
              paymentMethod: "CASH", // Could be CASH or CARD
            },
          });
        }

        // Add remaining to supplier account
        if (Number(remaining) > 0) {
          await prisma.supplierAccount.upsert({
            where: { supplierId: parseInt(supplierId) },
            update: {
              balance: { increment: Number(remaining) },
            },
            create: {
              supplierId: parseInt(supplierId),
              balance: Number(remaining),
            },
          });
        }

        // Update purchase payment status to PARTIALLY_PAID
        await prisma.purchase.update({
          where: { id: newPurchase.id },
          data: { paymentStatus: "PARTIALLY_PAID" },
        });
      }

      return newPurchase;
    });

    console.log("✅ Purchase created successfully:", purchase.id);
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
    } = req.body;
    const purchaseId = parseInt(req.params.id);

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
            data: items.map((item) => ({
              purchaseId,
              itemId: parseInt(item.itemId),
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
              sellPrice: item.sellPrice,
              total: item.total,
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
