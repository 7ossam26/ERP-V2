const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, getUserBranchFilter } = require("../middleware/auth");

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

    // --- 1. Filter Setup ---
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get user's allowed branches (without req to get full list, not active-branch filtered)
    const authorizedBranchFilter = await getUserBranchFilter(req.user.id);

    // Determine allowed branch IDs
    let allowedBranchIds = null; // null = global role, can see all
    if (authorizedBranchFilter) {
      allowedBranchIds = authorizedBranchFilter.id.in
        ? authorizedBranchFilter.id.in
        : [authorizedBranchFilter.id];
    }

    // Build branchFilter: respect query param branchId but validate against allowed list
    let branchFilter = {};
    let isAllBranches = false;
    let filterBranchIds = [];

    const requestedBranchId = branchId && branchId !== "all" ? parseInt(branchId) : null;

    if (requestedBranchId) {
      // User requested a specific branch — validate access
      if (allowedBranchIds && !allowedBranchIds.includes(requestedBranchId)) {
        return res.status(403).json({ error: "Access denied to this branch" });
      }
      branchFilter = { branchId: requestedBranchId };
      filterBranchIds = [requestedBranchId];
    } else if (!allowedBranchIds) {
      // Global role requesting all branches
      isAllBranches = true;
    } else {
      // Non-global role with no specific branch — scope to all allowed branches
      branchFilter = allowedBranchIds.length === 1
        ? { branchId: allowedBranchIds[0] }
        : { branchId: { in: allowedBranchIds } };
      filterBranchIds = allowedBranchIds;
    }

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
      // Filter expenses where the treasury belongs to the authorized branches
      expenseWhere.treasury = {
        branch: {
          id: filterBranchIds.length === 1 ? filterBranchIds[0] : { in: filterBranchIds },
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
      const branches = await prisma.branch.findMany({
        where: { id: { in: filterBranchIds } },
        select: { warehouseId: true },
      });
      const warehouseIds = branches
        .map(b => b.warehouseId)
        .filter(id => id != null);
      if (warehouseIds.length > 0) {
        inventoryWhere = { warehouseId: { in: warehouseIds } };
      } else {
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

/**
 * GET /api/reports/call-center
 * KPI report for call-center orders.
 * Query Params: startDate, endDate, branchId (optional)
 */
router.get("/call-center", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const where = {
      channel: "CALL_CENTER",
      createdAt: { gte: start, lte: end },
    };
    if (branchId && branchId !== "all") {
      where.branchId = parseInt(branchId);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        sale: { select: { total: true } },
      },
    });

    const total = orders.length;
    const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;

    const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;

    const totalRevenue = orders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + parseFloat(o.sale?.total ?? 0), 0);

    // Avg prep time: CREATED → READY (ms → minutes)
    const ordersWithReadyAt = orders.filter((o) => o.readyAt);
    const avgPrepMinutes =
      ordersWithReadyAt.length > 0
        ? ordersWithReadyAt.reduce(
            (sum, o) =>
              sum + (new Date(o.readyAt) - new Date(o.createdAt)) / 60000,
            0,
          ) / ordersWithReadyAt.length
        : null;

    // Orders per agent
    const agentMap = {};
    orders.forEach((o) => {
      const name = o.createdBy?.name ?? "غير محدد";
      if (!agentMap[name]) agentMap[name] = { name, total: 0, delivered: 0, cancelled: 0 };
      agentMap[name].total++;
      if (o.status === "DELIVERED") agentMap[name].delivered++;
      if (o.status === "CANCELLED") agentMap[name].cancelled++;
    });

    // Orders per branch
    const branchMap = {};
    orders.forEach((o) => {
      const name = o.branch?.name ?? "غير محدد";
      if (!branchMap[name]) branchMap[name] = { name, total: 0, revenue: 0 };
      branchMap[name].total++;
      if (o.status === "DELIVERED") {
        branchMap[name].revenue += parseFloat(o.sale?.total ?? 0);
      }
    });

    // Cancellations grouped by reason (null-safe — rows pre-migration have no reason)
    const reasonMap = {};
    orders.forEach((o) => {
      if (o.status !== "CANCELLED") return;
      const reason = o.cancellationReason || "UNSPECIFIED";
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });
    const cancellationsByReason = Object.entries(reasonMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      summary: {
        total,
        delivered,
        cancelled,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        totalRevenue,
        avgPrepMinutes: avgPrepMinutes !== null ? Math.round(avgPrepMinutes) : null,
      },
      byAgent: Object.values(agentMap),
      byBranch: Object.values(branchMap),
      cancellationsByReason,
    });
  } catch (error) {
    console.error("❌ Error generating call-center report:", error);
    res.status(500).json({ error: "Failed to generate report", details: error.message });
  }
});

module.exports = router;
