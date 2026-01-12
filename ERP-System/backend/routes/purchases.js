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

      // 3. Deduct from Treasury (User requested feature)
      if (Number(paidAmount) > 0) {
        // Decrease Balance
        await prisma.treasury.update({
          where: { id: parseInt(treasuryId) },
          data: {
            balance: { decrement: Number(paidAmount) },
          },
        });

        // 4. Create Expense Record (Log only)
        // Map payment method: CASH -> CASH, others -> CARD (as fallback or assume non-cash means bank/card)
        const expenseMethod = paymentMethod === "CASH" ? "CASH" : "CARD";

        await prisma.expense.create({
          data: {
            description: `Purchase Invocie #${supplierInvoiceNo || newPurchase.id}`,
            amount: Number(paidAmount),
            date: new Date(),
            type: "PURCHASE",
            treasuryId: parseInt(treasuryId),
            purchaseId: newPurchase.id,
            paymentMethod: expenseMethod,
          },
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
            description: `Purchase Invocie #${supplierInvoiceNo || purchaseId}`,
          },
          create: {
            description: `Purchase Invocie #${supplierInvoiceNo || purchaseId}`,
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
