const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, getUserBranchFilter } = require("../middleware/auth");

// Protect all routes with INVENTORY permission
router.use(authenticateToken, requirePermission("INVENTORY"));

// GET Inventory (All items with stock levels)
router.get("/", async (req, res) => {
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
    if (warehouseId && warehouseId !== "all") {
      whereClause.inventory = {
        some: {
          warehouseId: parseInt(warehouseId),
        },
      };
    }

    // Determine warehouse limitation based on user branch
    const branchId = await getUserBranchFilter(req.user.id);
    let inventoryWhere = {};

    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { warehouseId: true }
      });
      if (branch && branch.warehouseId) {
        inventoryWhere = { warehouseId: branch.warehouseId };
      }
    }

    // Fetch items with inventory data
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
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform data
    const formattedItems = items.map((item) => {
      // Calculate Total Quantity
      let totalQuantity = 0;
      let availableWarehouses = [];

      if (warehouseId && warehouseId !== "all") {
        const stock = item.inventory.find(
          (inv) => inv.warehouseId === parseInt(warehouseId)
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
        category: primaryCategory,
        categoryColor: getCategoryColor(primaryCategory),
        quantity: totalQuantity,
        warehouses: availableWarehouses, // List of warehouses with stock
        unit: item.unit,
        purchasePrice: Number(item.price), // Assuming price is cost/purchase price
        sellPrice: Number(item.price), // Using item price as sell price
        price: Number(item.price), // Add explicit price field just in case
        status: totalQuantity <= item.reorderPoint ? "Low Stock" : "In Stock",
        reorderPoint: item.reorderPoint,
        categories: item.categories.map((c) => c.category.id), // Return array of category IDs for filtering
      };
    });

    res.json(formattedItems);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory data" });
  }
});

// GET Dashboard Stats
router.get("/stats", async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: {
        inventory: true,
      },
    });

    const totalItems = items.length;
    let lowStockCount = 0;
    let totalValue = 0;

    items.forEach((item) => {
      const totalQuantity = item.inventory.reduce(
        (sum, inv) => sum + Number(inv.quantity),
        0
      );

      if (totalQuantity <= item.reorderPoint) {
        lowStockCount++;
      }

      totalValue += totalQuantity * Number(item.price);
    });

    res.json({
      totalItems,
      lowStockCount,
      totalValue,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
