const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all purchases
router.get("/", async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
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
      return res.status(400).json({ error: "Supplier is required" });
    }
    if (!treasuryId) {
      return res.status(400).json({ error: "Treasury is required" });
    }
    if (!warehouseId) {
      return res.status(400).json({ error: "Warehouse is required" });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }

    const purchase = await prisma.purchase.create({
      data: {
        supplierId: parseInt(supplierId),
        treasuryId: parseInt(treasuryId),
        warehouseId: parseInt(warehouseId),
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
    res.status(201).json(purchase);
  } catch (error) {
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
      // 1. Update basic fields
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

      // 2. Delete old items and create new ones
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

      // 3. Return updated purchase with relations
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
    await prisma.purchase.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Purchase not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete purchase", message: error.message });
  }
});

module.exports = router;
