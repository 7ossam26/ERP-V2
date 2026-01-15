const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, getUserBranchFilter } = require("../middleware/auth");

// Protect all routes with PURCHASES permission
router.use(authenticateToken, requirePermission("PURCHASES"));

// GET all purchases
router.get("/", async (req, res) => {
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
      // Find warehouse for this branch
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { warehouseId: true }
      });
      if (branch && branch.warehouseId) {
        whereClause = { warehouseId: branch.warehouseId };
      } else {
        // Should not happen for valid branch
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
    res
      .status(500)
      .json({ error: "Failed to fetch purchases", message: error.message });
  }
});

// GET purchase by ID
router.get("/:id", async (req, res) => {
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
    res
      .status(500)
      .json({ error: "Failed to fetch purchase", message: error.message });
  }
});

// POST create new purchase
router.post("/", async (req, res) => {
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
      // Fallback to Main Warehouse from System Config if not provided
      const systemConfig = await prisma.systemConfiguration.findUnique({
        where: { id: 1 },
        select: { mainWarehouseId: true },
      });

      if (!systemConfig || !systemConfig.mainWarehouseId) {
        return res.status(400).json({
          error: "Warehouse is required and no Main Warehouse is configured.",
        });
      }
      effectiveWarehouseId = systemConfig.mainWarehouseId;
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
              warehouseId: effectiveWarehouseId,
            },
          },
          update: {
            quantity: { increment: Number(item.quantity) },
          },
          create: {
            itemId: parseInt(item.itemId),
            warehouseId: effectiveWarehouseId,
            quantity: Number(item.quantity),
          },
        });
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
          throw new Error("Treasury not found");
        }

        if (Number(treasury.balance) < Number(netTotal)) {
          throw new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
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
            throw new Error("Treasury not found");
          }

          if (Number(treasury.balance) < Number(paidAmount)) {
            throw new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
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
    console.error("❌ Error creating purchase:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Full error:", error);

    res
      .status(500)
      .json({ error: "Failed to create purchase", message: error.message });
  }
});

// PUT update purchase
router.put("/:id", async (req, res) => {
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
        throw new Error("Purchase not found");
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

      // 5. Deduct New Amount (User requested feature)
      if (Number(paidAmount) > 0) {
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
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Purchase not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to update purchase", message: error.message });
  }
});

// DELETE purchase
router.delete("/:id", async (req, res) => {
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
    if (error.message === "Purchase not found" || error.code === "P2025") {
      return res.status(404).json({ error: "Purchase not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete purchase", message: error.message });
  }
});

module.exports = router;
