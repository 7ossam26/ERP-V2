const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  getUserBranchFilter,
  requireAnyPermission,
} = require("../middleware/auth");

// Protect all routes with authentication, specific permissions checked per route or broadened here
router.use(
  authenticateToken,
  requireAnyPermission(["INVENTORY", "POS", "INVENTORY_COUNT"]),
);

// GET Inventory (All items with stock levels)
router.get("/", async (req, res, next) => {
  try {
    const { warehouseId, category } = req.query;

    const whereClause = {};

    if (category && category !== "الكل") {
      whereClause.categories = {
        some: {
          category: {
            name: category,
          },
        },
      };
    }

    // Filter by warehouse presence if warehouseId is provided
    // REMOVED: Strict filtering that hides items without inventory records in target warehouse
    /*
    if (warehouseId && warehouseId !== "all") {
      whereClause.inventory = {
        some: {
          warehouseId: parseInt(warehouseId),
        },
      };
    }
    */

    // Only show items marked for POS
    // whereClause.showInPos = true; // REMOVED: Inventory should show all items including raw materials

    // Determine warehouse limitation based on user branch
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    let inventoryWhere = {};

    if (branchFilter) {
      const branch = await prisma.branch.findFirst({
        where: branchFilter,
        select: { warehouseId: true },
      });
      if (branch && branch.warehouseId) {
        inventoryWhere = { warehouseId: branch.warehouseId };
      }
    }

    // Fetch items with inventory data + BOM relations
    const items = await prisma.item.findMany({
      where: whereClause,
      include: {
        inventory: {
          where: inventoryWhere,
          include: {
            warehouse: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        purchaseItems: {
          select: {
            quantity: true,
            purchasePrice: true,
          },
        },
        bomOutputs: {
          where: { isActive: true },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform data
    const formattedItems = items.map((item) => {
      // Calculate Total Quantity
      let totalQuantity = 0;
      let availableWarehouses = [];

      // Treat "All Branches Warehouse" as "all" (if we had a specific ID for it, currently relying on "all" string)
      const isAllWarehouses = !warehouseId || warehouseId === "all";

      if (!isAllWarehouses) {
        const stock = item.inventory.find(
          (inv) => inv.warehouseId === parseInt(warehouseId),
        );
        totalQuantity = stock ? Number(stock.quantity) : 0;
      } else {
        totalQuantity = item.inventory.reduce((sum, inv) => {
          const qty = Number(inv.quantity);
          if (qty > 0 && inv.warehouse) {
            availableWarehouses.push(inv.warehouse.name);
          }
          return sum + qty;
        }, 0);
      }

      // Calculate Weighted Average Purchase Price
      let totalCost = 0;
      let totalPurchasedQty = 0;

      if (item.purchaseItems && item.purchaseItems.length > 0) {
        item.purchaseItems.forEach((p) => {
          const qty = Number(p.quantity);
          const price = Number(p.purchasePrice);
          totalCost += qty * price;
          totalPurchasedQty += qty;
        });
      }

      let avgPurchasePrice = 0;
      if (totalPurchasedQty > 0) {
        avgPurchasePrice = totalCost / totalPurchasedQty;
      } else {
        // Fallback to current item price if no purchase history exists
        // (This might be the case for manually added items)
        avgPurchasePrice = Number(item.price);
      }

      // Determine Category Name & Color (First category found)
      const primaryCategory =
        item.categories.length > 0
          ? item.categories[0].category.name
          : "غير مصنف";

      // Map category to color (simple mapping for now, or fetch from DB)
      const getCategoryColor = (catName) => {
        const colors = {
          "بن القهوة": "bg-brown-500",
          مخبوزات: "bg-orange-500",
          مشروبات: "bg-blue-500",
          مستلزمات: "bg-gray-500",
        };
        return colors[catName] || "bg-primary";
      };

      return {
        id: item.id,
        name: item.name,
        code: item.id, // Using ID as code for now
        inventory: item.inventory, // Include raw inventory data for frontend calculations
        category: primaryCategory,
        categoryColor: getCategoryColor(primaryCategory),
        quantity: totalQuantity,
        warehouses: availableWarehouses, // List of warehouses with stock
        unit: item.unit,
        purchasePrice: Number(avgPurchasePrice.toFixed(2)), // Calculated Avg Price
        costPrice: Number(item.costPrice), // Stored Cost Price
        sellPrice: Number(item.price), // Using item price as sell price
        price: Number(item.price),
        status: totalQuantity <= item.reorderPoint ? "Low Stock" : "In Stock",
        reorderPoint: item.reorderPoint,
        showInPos: item.showInPos,
        categories: item.categories.map((c) => c.category.id), // Return array of category IDs for filtering
        hasBom: item.bomOutputs && item.bomOutputs.length > 0,
        bom:
          item.bomOutputs && item.bomOutputs.length > 0
            ? {
                id: item.bomOutputs[0].id,
                name: item.bomOutputs[0].name,
                outputQuantity: Number(item.bomOutputs[0].outputQuantity),
                items: item.bomOutputs[0].items.map((bi) => ({
                  itemId: bi.itemId,
                  itemName: bi.item.name,
                  quantity: Number(bi.quantity),
                })),
              }
            : null,
      };
    });

    res.json(formattedItems);
  } catch (error) {
    next(error);
  }
});

// GET Dashboard Stats
router.get("/stats", async (req, res, next) => {
  try {
    const { warehouseId, category } = req.query;
    const whereClause = {};

    if (category && category !== "الكل") {
      whereClause.categories = {
        some: {
          category: {
            name: category,
          },
        },
      };
    }

    // Determine warehouse limitation based on user branch
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    let inventoryWhere = {};

    if (branchFilter) {
      const branch = await prisma.branch.findFirst({
        where: branchFilter,
        select: { warehouseId: true },
      });
      if (branch && branch.warehouseId) {
        inventoryWhere = { warehouseId: branch.warehouseId };
      }
    }

    const items = await prisma.item.findMany({
      where: whereClause,
      include: {
        inventory: {
          where: inventoryWhere,
        },
        purchaseItems: {
          select: {
            quantity: true,
            purchasePrice: true,
          },
        },
      },
    });

    const totalItems = items.length;
    let lowStockCount = 0;
    let totalValue = 0;
    let totalSellingPrice = 0;
    let totalProfit = 0;

    items.forEach((item) => {
      let totalQuantity = 0;

      // Treat "All Branches Warehouse" as "all"
      const isAllWarehouses = !warehouseId || warehouseId === "all";

      if (!isAllWarehouses) {
        const stock = item.inventory.find(
          (inv) => inv.warehouseId === parseInt(warehouseId),
        );
        totalQuantity = stock ? Number(stock.quantity) : 0;
      } else {
        totalQuantity = item.inventory.reduce(
          (sum, inv) => sum + Number(inv.quantity),
          0,
        );
      }

      if (totalQuantity <= item.reorderPoint) {
        lowStockCount++;
      }

      // Calculate Weighted Average Purchase Price
      let totalCost = 0;
      let totalPurchasedQty = 0;

      if (item.purchaseItems && item.purchaseItems.length > 0) {
        item.purchaseItems.forEach((p) => {
          const qty = Number(p.quantity);
          const price = Number(p.purchasePrice);
          totalCost += qty * price;
          totalPurchasedQty += qty;
        });
      }

      let avgPurchasePrice = 0;
      if (totalPurchasedQty > 0) {
        avgPurchasePrice = totalCost / totalPurchasedQty;
      } else {
        avgPurchasePrice = Number(item.price);
      }

      totalValue += totalQuantity * avgPurchasePrice;
      totalSellingPrice += totalQuantity * Number(item.price);
      totalProfit += totalQuantity * (Number(item.price) - avgPurchasePrice);
    });

    res.json({
      totalItems,
      lowStockCount,
      totalValue,
      totalSellingPrice,
      totalProfit,
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/inventory/reorder-alerts
// ─────────────────────────────────────────────
router.get("/reorder-alerts", async (req, res, next) => {
  try {
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    let warehouseIds = null;

    if (branchFilter) {
      const branches = await prisma.branch.findMany({
        where: branchFilter,
        select: { warehouseId: true, name: true },
      });
      warehouseIds = branches.map((b) => b.warehouseId).filter(Boolean);
      if (warehouseIds.length === 0) return res.json([]);
    }

    const inventoryRows = await prisma.inventory.findMany({
      where: {
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
      include: {
        item: { select: { id: true, name: true, unit: true, reorderPoint: true, itemType: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });

    const alerts = inventoryRows
      .filter((inv) => Number(inv.quantity) <= inv.item.reorderPoint)
      .map((inv) => ({
        itemId: inv.itemId,
        itemName: inv.item.name,
        unit: inv.item.unit,
        itemType: inv.item.itemType,
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        quantity: Number(inv.quantity),
        reorderPoint: inv.item.reorderPoint,
        severity: inv.item.reorderPoint > 0
          ? Number(inv.quantity) / inv.item.reorderPoint
          : 0,
      }))
      .sort((a, b) => a.severity - b.severity);

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/inventory/dead-stock
// ─────────────────────────────────────────────
router.get("/dead-stock", async (req, res, next) => {
  try {
    const { days = "90" } = req.query;
    const daysNum = parseInt(days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const branchFilter = await getUserBranchFilter(req.user.id, req);
    let warehouseIds = null;
    if (branchFilter) {
      const branches = await prisma.branch.findMany({
        where: branchFilter,
        select: { warehouseId: true },
      });
      warehouseIds = branches.map((b) => b.warehouseId).filter(Boolean);
      if (warehouseIds.length === 0) return res.json([]);
    }

    // Get items with stock > 0
    const inventoryRows = await prisma.inventory.findMany({
      where: {
        quantity: { gt: 0 },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
      include: {
        item: { select: { id: true, name: true, unit: true, price: true, costPrice: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });

    const results = [];
    for (const inv of inventoryRows) {
      // Find latest sale for this item
      const lastSale = await prisma.saleItem.findFirst({
        where: { itemId: inv.itemId },
        orderBy: { id: "desc" },
        include: { sale: { select: { createdAt: true } } },
      });

      const lastSaleDate = lastSale ? lastSale.sale.createdAt : null;
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;

      if (daysSinceLastSale >= daysNum) {
        results.push({
          itemId: inv.itemId,
          itemName: inv.item.name,
          unit: inv.item.unit,
          warehouseId: inv.warehouseId,
          warehouseName: inv.warehouse.name,
          quantity: Number(inv.quantity),
          costPrice: Number(inv.item.costPrice),
          sellingPrice: Number(inv.item.price),
          stockValue: Number(inv.quantity) * Number(inv.item.costPrice),
          lastSaleDate,
          daysSinceLastSale: daysSinceLastSale === Infinity ? null : daysSinceLastSale,
        });
      }
    }

    results.sort((a, b) => (b.daysSinceLastSale || 9999) - (a.daysSinceLastSale || 9999));
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/inventory/reconcile-fabric
// ─────────────────────────────────────────────
router.get("/reconcile-fabric", async (req, res, next) => {
  try {
    const branchFilter = await getUserBranchFilter(req.user.id, req);
    let warehouseIds = null;
    if (branchFilter) {
      const branches = await prisma.branch.findMany({
        where: branchFilter,
        select: { warehouseId: true },
      });
      warehouseIds = branches.map((b) => b.warehouseId).filter(Boolean);
      if (warehouseIds.length === 0) return res.json([]);
    }

    // Get all fabric items with inventory
    const inventoryRows = await prisma.inventory.findMany({
      where: {
        item: { itemType: "FABRIC" },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
      include: {
        item: { select: { id: true, name: true, unit: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });

    const results = [];
    for (const inv of inventoryRows) {
      // Sum remaining length of AVAILABLE + PARTIALLY_CUT rolls
      const rollSum = await prisma.fabricRoll.aggregate({
        where: {
          itemId: inv.itemId,
          warehouseId: inv.warehouseId,
          status: { in: ["AVAILABLE", "PARTIALLY_CUT"] },
        },
        _sum: { remainingLength: true },
      });

      const sumRemaining = Number(rollSum._sum.remainingLength || 0);
      const inventoryQuantity = Number(inv.quantity);
      const drift = sumRemaining - inventoryQuantity;

      results.push({
        itemId: inv.itemId,
        itemName: inv.item.name,
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        sumRemaining,
        inventoryQuantity,
        drift,
      });
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/inventory/reconcile-fabric/apply
// Owner-only — corrects Inventory to match roll sum
// ─────────────────────────────────────────────
router.post("/reconcile-fabric/apply", async (req, res, next) => {
  try {
    // Owner-only check
    if (req.user.role !== "Superadmin" && req.user.role !== "Admin" && req.user.role !== "Owner") {
      return res.status(403).json({ error: "هذا الإجراء متاح فقط للمالك" });
    }

    const { generateNumber } = require("../services/numberSequenceService");

    const branchFilter = await getUserBranchFilter(req.user.id, req);
    let warehouseIds = null;
    if (branchFilter) {
      const branches = await prisma.branch.findMany({
        where: branchFilter,
        select: { warehouseId: true },
      });
      warehouseIds = branches.map((b) => b.warehouseId).filter(Boolean);
    }

    // Gather drifts
    const inventoryRows = await prisma.inventory.findMany({
      where: {
        item: { itemType: "FABRIC" },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
      include: {
        item: { select: { id: true, name: true, costPrice: true } },
      },
    });

    const corrections = [];
    for (const inv of inventoryRows) {
      const rollSum = await prisma.fabricRoll.aggregate({
        where: {
          itemId: inv.itemId,
          warehouseId: inv.warehouseId,
          status: { in: ["AVAILABLE", "PARTIALLY_CUT"] },
        },
        _sum: { remainingLength: true },
      });
      const sumRemaining = Number(rollSum._sum.remainingLength || 0);
      const invQty = Number(inv.quantity);
      const drift = sumRemaining - invQty;
      if (Math.abs(drift) > 0.0001) {
        corrections.push({ itemId: inv.itemId, warehouseId: inv.warehouseId, drift, costPrice: Number(inv.item.costPrice) });
      }
    }

    if (corrections.length === 0) {
      return res.json({ message: "لا توجد فروقات تحتاج تصحيح", adjustments: [] });
    }

    // Group corrections by warehouse
    const byWarehouse = new Map();
    for (const c of corrections) {
      if (!byWarehouse.has(c.warehouseId)) byWarehouse.set(c.warehouseId, []);
      byWarehouse.get(c.warehouseId).push(c);
    }

    const adjustmentIds = [];

    await prisma.$transaction(async (tx) => {
      for (const [wId, items] of byWarehouse) {
        const branch = await tx.branch.findFirst({ where: { warehouseId: wId }, select: { id: true } });
        if (!branch) continue;

        const netDrift = items.reduce((s, i) => s + i.drift, 0);
        const direction = netDrift >= 0 ? "IN" : "OUT";
        const adjNumber = await generateNumber("ADJ", tx);

        const adj = await tx.inventoryAdjustment.create({
          data: {
            adjustmentNumber: adjNumber,
            warehouseId: wId,
            direction,
            reasonCode: "COUNT_VARIANCE",
            reasonNote: "تصحيح تلقائي — مطابقة الأقمشة",
            userId: req.user.id,
            branchId: branch.id,
          },
        });

        for (const c of items) {
          await tx.inventoryAdjustmentItem.create({
            data: {
              adjustmentId: adj.id,
              itemId: c.itemId,
              quantity: Math.abs(c.drift),
              unitCostAtTime: c.costPrice,
            },
          });

          // Set inventory to match roll sum
          await tx.inventory.update({
            where: { itemId_warehouseId: { itemId: c.itemId, warehouseId: wId } },
            data: { quantity: { increment: c.drift } },
          });
        }

        adjustmentIds.push(adj.id);
      }
    });

    res.json({
      message: `تم تصحيح ${corrections.length} صنف في ${adjustmentIds.length} تسوية`,
      adjustmentIds,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
