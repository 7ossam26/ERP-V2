const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");

/**
 * GET /api/reports/general
 * Retrieve general report data (Sales, Expenses, Inventory, Charts)
 * Query Params:
 * - startDate (YYYY-MM-DD)
 * - endDate (YYYY-MM-DD)
 * - branchId (Optional)
 */
// Protect all routes with authentication
router.use(authenticateToken);

router.get("/general", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    // console.log("📊 Generating General Report...", {
    //   startDate,
    //   endDate,
    //   branchId,
    // });

    // --- 1. Filter Setup ---
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const isAllBranches = !branchId || branchId === "all";
    const branchFilter = isAllBranches ? {} : { branchId: parseInt(branchId) };

    // --- 2. Fetch Data ---

    // A. Sales Data
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...branchFilter,
        status: "COMPLETED",
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        branch: true,
      },
    });

    // B. Expenses Data
    const expenseWhere = {
      date: { gte: start, lte: end },
    };

    if (!isAllBranches) {
      // Filter expenses where the treasury belongs to the branch
      expenseWhere.treasury = {
        branch: {
          id: parseInt(branchId),
        },
      };
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
    });

    // C. Inventory (Snapshot - Current State)
    // We can't easily "go back in time" for inventory without a ledger, so we return CURRENT warning levels.
    // C. Inventory (Snapshot - Current State)
    let inventoryWhere = {};
    if (!isAllBranches) {
      const branch = await prisma.branch.findUnique({
        where: { id: parseInt(branchId) },
        select: { warehouseId: true }, // Get the linked warehouse
      });
      if (branch && branch.warehouseId) {
        inventoryWhere = { warehouseId: branch.warehouseId };
        // console.log(
        //   `[DEBUG] Branch ${branchId} resolved to Warehouse ${branch.warehouseId}`
        // );
      } else {
        // console.log(`[DEBUG] Branch ${branchId} has no warehouse linked!`);
        // Fallback or empty? If no warehouse, no inventory.
        inventoryWhere = { warehouseId: -1 };
      }
    }

    const inventoryRecords = await prisma.inventory.findMany({
      where: inventoryWhere,
      include: {
        item: true,
      },
    });

    // --- 3. Inventory Alerts Calculation (Aggregated) ---
    // Fetch all items to ensure we check items with 0 stock
    const allItems = await prisma.item.findMany();

    // Group inventory quantities by item
    const itemQuantities = {};
    allItems.forEach((item) => {
      itemQuantities[item.id] = 0;
    });

    inventoryRecords.forEach((rec) => {
      if (itemQuantities[rec.itemId] !== undefined) {
        itemQuantities[rec.itemId] += parseFloat(rec.quantity);
      }
    });

    const stockAlertsList = allItems
      .map((item) => ({
        itemName: item.name,
        quantity: itemQuantities[item.id],
        reorderPoint: item.reorderPoint,
      }))
      .filter((s) => s.reorderPoint > 0 && s.quantity <= s.reorderPoint);

    // --- 3. Calculations ---

    // console.log(
    //   `[DEBUG] Found ${inventoryRecords.length} inventory records. Computed ${stockAlertsList.length} alerts.`
    // );

    // > Summary Cards
    const totalSales = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.total),
      0,
    );
    const totalExpenses = expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.amount),
      0,
    );
    // Rough Net Profit = Sales - Expenses (ignores COGS for now as it's complex)
    const netProfit = totalSales - totalExpenses;
    const invoiceCount = sales.length;

    // Inventory Alerts (Items below reorder point)
    const stockAlerts = stockAlertsList.length;

    // > Sales Chart (Over Time)
    // If range is 1 day => Group by Hour
    // If range > 1 day => Group by Day
    // > Sales Chart (Over Time)
    // If range is 1 day => Group by Hour
    // If range > 1 day => Group by Day
    const isSingleDay = start.toDateString() === end.toDateString();
    const salesOverTime = {};

    // Initialize zero-filled data
    if (isSingleDay) {
      for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, "0") + ":00";
        salesOverTime[hour] = 0;
      }
    } else {
      // Fill days between start and end
      const current = new Date(start);
      while (current <= end) {
        const day = current.toISOString().split("T")[0];
        salesOverTime[day] = 0;
        current.setDate(current.getDate() + 1);
      }
    }

    sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      // Adjust for local time offset if needed, but for now assuming server time is consistent
      // If running locally, Date objects are local.

      let key;
      if (isSingleDay) {
        const hour = String(date.getHours()).padStart(2, "0") + ":00";
        key = hour;
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (salesOverTime[key] !== undefined) {
        salesOverTime[key] += parseFloat(sale.total);
      }
    });

    // > Sales By Category (Doughnut)
    const salesByCategory = {};
    sales.forEach((sale) => {
      sale.items.forEach((saleItem) => {
        const itemName = saleItem.item.name;
        if (!salesByCategory[itemName]) salesByCategory[itemName] = 0;
        salesByCategory[itemName] += parseFloat(saleItem.total);
      });
    });
    // console.log("[DEBUG] Final Sales By Item:", salesByCategory);

    // > Sales By Branch (Table)
    const branchStats = {};
    sales.forEach((sale) => {
      const branchName = sale.branch ? sale.branch.name : "Unknown";
      if (!branchStats[branchName]) {
        branchStats[branchName] = {
          name: branchName,
          totalSales: 0,
          invoiceCount: 0,
        };
      }
      branchStats[branchName].totalSales += parseFloat(sale.total);
      branchStats[branchName].invoiceCount += 1;
    });

    // Calculate Averages for Branch table
    const salesByBranch = Object.values(branchStats).map((stat) => ({
      ...stat,
      averageInvoice: stat.invoiceCount
        ? stat.totalSales / stat.invoiceCount
        : 0,
      percentage: totalSales ? (stat.totalSales / totalSales) * 100 : 0,
    }));

    // --- 4. Response Construction ---
    res.json({
      summary: {
        totalSales,
        netProfit,
        invoiceCount,
        stockAlerts,
      },
      charts: {
        salesOverTime: {
          labels: Object.keys(salesOverTime),
          data: Object.values(salesOverTime),
        },
        salesByItem: {
          labels: Object.keys(salesByCategory),
          data: Object.values(salesByCategory),
        },
      },
      tables: {
        salesByBranch,
        // We can add stock alerts detail if needed
        // We can add stock alerts detail if needed
        stockAlertsList: stockAlertsList.slice(0, 5), // Top 5
      },
    });
  } catch (error) {
    console.error("❌ Error generating report:", error);
    res
      .status(500)
      .json({ error: "Failed to generate report", details: error.message });
  }
});

module.exports = router;
