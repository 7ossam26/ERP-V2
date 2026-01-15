const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");

// Helper function to generate unique transfer number
const generateTransferNumber = async () => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Get the count of transfers for this month
    const startOfMonth = new Date(year, now.getMonth(), 1);
    const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

    const count = await prisma.stockTransfer.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const sequence = String(count + 1).padStart(5, "0");
    return `STK-${year}${month}-${sequence}`;
  } catch (error) {
    console.error("Error generating transfer number:", error);
    return `STK-${Date.now()}`;
  }
};

// Protect all routes with STOCK_TRANSFER permission
router.use(authenticateToken, requirePermission("STOCK_TRANSFER"));

// GET all stock transfers
router.get("/", async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      fromWarehouseId,
      toWarehouseId,
      transferNumber,
    } = req.query;
    const where = {};

    if (transferNumber) {
      where.transferNumber = { contains: transferNumber };
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (fromWarehouseId && fromWarehouseId !== "all") {
      where.fromWarehouseId = parseInt(fromWarehouseId);
    }

    if (toWarehouseId && toWarehouseId !== "all") {
      where.toWarehouseId = parseInt(toWarehouseId);
    }

    const transfers = await prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        user: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            item: true,
          },
        },
      },
    });
    res.json(transfers);
  } catch (error) {
    next(error);
  }
});

// GET stock transfer by ID
router.get("/:id", async (req, res, next) => {
  try {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        user: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!transfer) {
      return res.status(404).json({ error: "Stock transfer not found" });
    }

    res.json(transfer);
  } catch (error) {
    next(error);
  }
});

// POST create new stock transfer
router.post("/", async (req, res, next) => {
  try {
    // console.log("📦 ============ STOCK TRANSFER API CALLED ============");
    // console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

    const { userId, fromWarehouseId, toWarehouseId, notes, items } = req.body;

    // Validation
    if (!userId) {
      console.error("❌ Validation failed: User ID is required");
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!toWarehouseId) {
      console.error("❌ Validation failed: Destination warehouse is required");
      return res
        .status(400)
        .json({ error: "Destination warehouse is required" });
    }

    if (!items || items.length === 0) {
      console.error("❌ Validation failed: At least one item is required");
      return res.status(400).json({ error: "At least one item is required" });
    }

    let sourceWarehouseId = fromWarehouseId;

    if (!sourceWarehouseId) {
      console.log(
        "📦 Source warehouse not provided, fetching main warehouse from system configuration..."
      );
      // Get main warehouse ID from system configuration
      const config = await prisma.systemConfiguration.findFirst({
        select: { mainWarehouseId: true },
      });

      if (!config || !config.mainWarehouseId) {
        console.error("❌ Main warehouse not configured in system settings");
        return res.status(400).json({
          error:
            "Source warehouse is required and Main warehouse is not configured.",
        });
      }
      sourceWarehouseId = config.mainWarehouseId;
    }

    console.log(`✅ Source Warehouse ID: ${sourceWarehouseId}`);

    // Prevent transfer to same warehouse
    if (parseInt(sourceWarehouseId) === parseInt(toWarehouseId)) {
      return res.status(400).json({
        error: "Cannot transfer to the same warehouse",
      });
    }

    console.log("📦 Step 2: Generating transfer number...");
    const transferNumber = await generateTransferNumber();
    console.log(`✅ Generated transfer number: ${transferNumber}`);

    console.log(
      "📦 Step 3: Executing Transaction (Create Transfer + Update Inventory)..."
    );
    // EXECUTE TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate stock availability for all items
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            itemId_warehouseId: {
              itemId: parseInt(item.itemId),
              warehouseId: parseInt(sourceWarehouseId),
            },
          },
          include: { item: true },
        });

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for item ${item.itemId
            } in source warehouse. Available: ${inventory ? inventory.quantity : 0
            }, Requested: ${item.quantity}`
          );
        }
      }

      // 2. Create Stock Transfer
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromWarehouseId: parseInt(sourceWarehouseId),
          toWarehouseId: parseInt(toWarehouseId),
          userId: parseInt(userId),
          status: "COMPLETED", // Immediately complete as we're updating inventory
          notes,
          items: {
            create: items.map((item) => ({
              itemId: parseInt(item.itemId),
              quantity: parseFloat(item.quantity),
            })),
          },
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          user: { select: { id: true, name: true, username: true } },
          items: {
            include: {
              item: true,
            },
          },
        },
      });

      // 3. Update Inventory (Decrement from source, Increment to destination)
      for (const item of items) {
        //  Decrement from source warehouse
        await tx.inventory.update({
          where: {
            itemId_warehouseId: {
              itemId: parseInt(item.itemId),
              warehouseId: parseInt(sourceWarehouseId),
            },
          },
          data: {
            quantity: { decrement: parseFloat(item.quantity) },
          },
        });

        // Increment to destination warehouse (upsert in case it doesn't exist)
        await tx.inventory.upsert({
          where: {
            itemId_warehouseId: {
              itemId: parseInt(item.itemId),
              warehouseId: parseInt(toWarehouseId),
            },
          },
          create: {
            itemId: parseInt(item.itemId),
            warehouseId: parseInt(toWarehouseId),
            quantity: parseFloat(item.quantity),
          },
          update: {
            quantity: { increment: parseFloat(item.quantity) },
          },
        });
      }

      return transfer;
    });

    // console.log(
    //   "✅✅✅ Transaction completed successfully! Transfer ID:",
    //   result.id
    // );
    // console.log("============================================");
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE stock transfer
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.stockTransfer.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
