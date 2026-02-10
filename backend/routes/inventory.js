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
    const branchFilter = await getUserBranchFilter(req.user.id);
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
    const branchFilter = await getUserBranchFilter(req.user.id);
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
      totalProfit += totalQuantity * (Number(item.price) - avgPurchasePrice);
    });

    res.json({
      totalItems,
      lowStockCount,
      totalValue,
      totalProfit,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
