const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, getUserBranchFilter } = require("../middleware/auth");
const XLSX = require("xlsx");

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

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildXlsxBuffer(sheetName, headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function sendXlsx(res, filename, sheetName, headers, rows) {
  const buf = buildXlsxBuffer(sheetName, headers, rows);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`);
  res.send(buf);
}

function parseDateRange(from, to) {
  const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getAccessibleBranchIds(userId, req) {
  const branchWhere = await getUserBranchFilter(userId, req);
  if (!branchWhere) return null; // global role — all branches
  const branches = await prisma.branch.findMany({ where: branchWhere, select: { id: true } });
  return branches.map((b) => b.id);
}

function buildSaleWhere(start, end, accessibleBranchIds, requestedBranchId) {
  const where = { status: "COMPLETED", createdAt: { gte: start, lte: end } };
  if (requestedBranchId && requestedBranchId !== "all") {
    const id = parseInt(requestedBranchId);
    if (accessibleBranchIds && !accessibleBranchIds.includes(id)) {
      const err = new Error("Branch not accessible"); err.status = 403; throw err;
    }
    where.branchId = id;
  } else if (accessibleBranchIds) {
    where.branchId = { in: accessibleBranchIds };
  }
  return where;
}

function getBucketKey(date, groupBy) {
  if (groupBy === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (groupBy === "week") {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d.toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
}

// ── GET /api/reports/sales/daily ─────────────────────────────────────────────
router.get("/sales/daily", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId, groupBy = "day" } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const sales = await prisma.sale.findMany({ where, select: { total: true, createdAt: true } });
    const buckets = {};
    for (const s of sales) {
      const key = getBucketKey(new Date(s.createdAt), groupBy);
      buckets[key] = (buckets[key] || 0) + parseFloat(s.total);
    }
    const labels = Object.keys(buckets).sort();
    const data = labels.map((l) => +(buckets[l] || 0).toFixed(2));
    res.json({ labels, data, total: +data.reduce((a, b) => a + b, 0).toFixed(2) });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate daily sales report" });
  }
});

router.get("/sales/daily/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId, groupBy = "day" } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const sales = await prisma.sale.findMany({ where, select: { total: true, createdAt: true } });
    const buckets = {};
    for (const s of sales) { const key = getBucketKey(new Date(s.createdAt), groupBy); buckets[key] = (buckets[key] || 0) + parseFloat(s.total); }
    const labels = Object.keys(buckets).sort();
    const rows = labels.map((l) => [l, +(buckets[l] || 0).toFixed(2)]);
    sendXlsx(res, "تقرير-المبيعات-اليومية", "المبيعات", ["التاريخ", "الإجمالي (EGP)"], rows);
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/sales/by-dimension ──────────────────────────────────────
router.get("/sales/by-dimension", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId, dimension = "branch" } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const map = {};

    if (dimension === "branch") {
      const sales = await prisma.sale.findMany({ where, select: { total: true, branch: { select: { name: true } } } });
      for (const s of sales) { const k = s.branch?.name || "غير معروف"; map[k] = (map[k] || 0) + parseFloat(s.total); }
    } else if (dimension === "tier") {
      const sales = await prisma.sale.findMany({ where, select: { total: true, client: { select: { tier: true } } } });
      for (const s of sales) { const k = s.client?.tier === "WHOLESALE" ? "جملة" : "تجزئة"; map[k] = (map[k] || 0) + parseFloat(s.total); }
    } else if (dimension === "paymentMethod") {
      const sales = await prisma.sale.findMany({ where, select: { total: true, paymentMethod: true } });
      for (const s of sales) { const k = s.paymentMethod === "CASH" ? "نقدي" : "إنستاباي"; map[k] = (map[k] || 0) + parseFloat(s.total); }
    } else if (dimension === "category") {
      const saleItems = await prisma.saleItem.findMany({ where: { sale: where }, select: { total: true, item: { select: { categories: { select: { category: { select: { name: true } } } } } } } });
      for (const si of saleItems) { const cats = si.item?.categories?.map((c) => c.category.name) || ["بدون تصنيف"]; for (const cat of cats) { map[cat] = (map[cat] || 0) + parseFloat(si.total); } }
    } else if (dimension === "item") {
      const saleItems = await prisma.saleItem.findMany({ where: { sale: where }, select: { total: true, item: { select: { name: true } } } });
      for (const si of saleItems) { const k = si.item?.name || "BOM"; map[k] = (map[k] || 0) + parseFloat(si.total); }
    } else {
      return res.status(400).json({ error: "Invalid dimension" });
    }

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 20);
    res.json({ labels: sorted.map((e) => e[0]), data: sorted.map((e) => +e[1].toFixed(2)) });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.get("/sales/by-dimension/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId, dimension = "branch" } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const map = {};
    const dimLabel = { branch: "الفرع", tier: "الشريحة", category: "التصنيف", paymentMethod: "طريقة الدفع", item: "الصنف" };
    if (dimension === "branch") { const s = await prisma.sale.findMany({ where, select: { total: true, branch: { select: { name: true } } } }); for (const x of s) { const k = x.branch?.name || "غير معروف"; map[k] = (map[k] || 0) + parseFloat(x.total); } }
    else if (dimension === "tier") { const s = await prisma.sale.findMany({ where, select: { total: true, client: { select: { tier: true } } } }); for (const x of s) { const k = x.client?.tier === "WHOLESALE" ? "جملة" : "تجزئة"; map[k] = (map[k] || 0) + parseFloat(x.total); } }
    else if (dimension === "paymentMethod") { const s = await prisma.sale.findMany({ where, select: { total: true, paymentMethod: true } }); for (const x of s) { const k = x.paymentMethod === "CASH" ? "نقدي" : "إنستاباي"; map[k] = (map[k] || 0) + parseFloat(x.total); } }
    else if (dimension === "item") { const si = await prisma.saleItem.findMany({ where: { sale: where }, select: { total: true, item: { select: { name: true } } } }); for (const x of si) { const k = x.item?.name || "BOM"; map[k] = (map[k] || 0) + parseFloat(x.total); } }
    else { const si = await prisma.saleItem.findMany({ where: { sale: where }, select: { total: true, item: { select: { categories: { select: { category: { select: { name: true } } } } } } } }); for (const x of si) { const cats = x.item?.categories?.map((c) => c.category.name) || ["بدون تصنيف"]; for (const cat of cats) { map[cat] = (map[cat] || 0) + parseFloat(x.total); } } }
    const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +v.toFixed(2)]);
    sendXlsx(res, `مبيعات-حسب-${dimLabel[dimension] || dimension}`, "المبيعات", [dimLabel[dimension] || dimension, "الإجمالي (EGP)"], rows);
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/margin-by-sku ────────────────────────────────────────────
router.get("/margin-by-sku", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const saleItems = await prisma.saleItem.findMany({
      where: { sale: where, itemId: { not: null } },
      select: { quantity: true, total: true, itemId: true, item: { select: { name: true, costPrice: true } } },
    });
    const itemIds = [...new Set(saleItems.map((si) => si.itemId).filter(Boolean))];
    const latestCosts = {};
    await Promise.all(itemIds.map(async (itemId) => {
      const latest = await prisma.purchaseItem.findFirst({ where: { itemId }, orderBy: { purchase: { createdAt: "desc" } }, select: { finalUnitCost: true } });
      latestCosts[itemId] = latest ? parseFloat(latest.finalUnitCost) : null;
    }));
    const map = {};
    for (const si of saleItems) {
      const key = si.item?.name || `item_${si.itemId}`;
      if (!map[key]) map[key] = { itemName: key, revenue: 0, cost: 0, costPrice: parseFloat(si.item?.costPrice || 0), itemId: si.itemId };
      map[key].revenue += parseFloat(si.total);
      const unitCost = latestCosts[si.itemId] ?? map[key].costPrice;
      map[key].cost += unitCost * parseFloat(si.quantity);
    }
    const items = Object.values(map).map(({ itemName, revenue, cost }) => {
      const margin = revenue - cost;
      return { itemName, revenue: +revenue.toFixed(2), cost: +cost.toFixed(2), margin: +margin.toFixed(2), marginPct: +(revenue > 0 ? (margin / revenue) * 100 : 0).toFixed(1) };
    }).sort((a, b) => b.revenue - a.revenue);
    res.json({ items });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate margin report" });
  }
});

router.get("/margin-by-sku/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const saleItems = await prisma.saleItem.findMany({ where: { sale: where, itemId: { not: null } }, select: { quantity: true, total: true, itemId: true, item: { select: { name: true, costPrice: true } } } });
    const itemIds = [...new Set(saleItems.map((si) => si.itemId).filter(Boolean))];
    const latestCosts = {};
    await Promise.all(itemIds.map(async (id) => { const l = await prisma.purchaseItem.findFirst({ where: { itemId: id }, orderBy: { purchase: { createdAt: "desc" } }, select: { finalUnitCost: true } }); latestCosts[id] = l ? parseFloat(l.finalUnitCost) : null; }));
    const map = {};
    for (const si of saleItems) {
      const key = si.item?.name || `item_${si.itemId}`;
      if (!map[key]) map[key] = { itemName: key, revenue: 0, cost: 0, costPrice: parseFloat(si.item?.costPrice || 0), itemId: si.itemId };
      map[key].revenue += parseFloat(si.total);
      map[key].cost += (latestCosts[si.itemId] ?? map[key].costPrice) * parseFloat(si.quantity);
    }
    const rows = Object.values(map).sort((a, b) => b.revenue - a.revenue).map(({ itemName, revenue, cost }) => {
      const margin = revenue - cost;
      return [itemName, +revenue.toFixed(2), +cost.toFixed(2), +margin.toFixed(2), `${+(revenue > 0 ? (margin / revenue) * 100 : 0).toFixed(1)}%`];
    });
    sendXlsx(res, "هامش-الربح-بالصنف", "الهامش", ["الصنف", "الإيراد (EGP)", "التكلفة (EGP)", "الهامش (EGP)", "نسبة الهامش"], rows);
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/top-movers ───────────────────────────────────────────────
router.get("/top-movers", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId, metric = "revenue", limit = "10" } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const saleItems = await prisma.saleItem.findMany({ where: { sale: where, itemId: { not: null } }, select: { quantity: true, total: true, item: { select: { name: true } } } });
    const map = {};
    for (const si of saleItems) { const k = si.item?.name || "BOM"; if (!map[k]) map[k] = { itemName: k, revenue: 0, quantity: 0 }; map[k].revenue += parseFloat(si.total); map[k].quantity += parseFloat(si.quantity); }
    const items = Object.values(map).sort((a, b) => b[metric] - a[metric]).slice(0, parseInt(limit));
    res.json({ items: items.map((i) => ({ ...i, revenue: +i.revenue.toFixed(2), quantity: +i.quantity.toFixed(2) })) });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate top movers report" });
  }
});

router.get("/top-movers/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId, metric = "revenue", limit = "10" } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = buildSaleWhere(start, end, accessibleBranchIds, branchId);
    const saleItems = await prisma.saleItem.findMany({ where: { sale: where, itemId: { not: null } }, select: { quantity: true, total: true, item: { select: { name: true } } } });
    const map = {};
    for (const si of saleItems) { const k = si.item?.name || "BOM"; if (!map[k]) map[k] = { itemName: k, revenue: 0, quantity: 0 }; map[k].revenue += parseFloat(si.total); map[k].quantity += parseFloat(si.quantity); }
    const rows = Object.values(map).sort((a, b) => b[metric] - a[metric]).slice(0, parseInt(limit)).map(({ itemName, revenue, quantity }) => [itemName, +revenue.toFixed(2), +quantity.toFixed(2)]);
    sendXlsx(res, "الأكثر-مبيعاً", "الأصناف", ["الصنف", "الإيراد (EGP)", "الكمية"], rows);
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/dead-stock ───────────────────────────────────────────────
router.get("/dead-stock", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { days = "90", branchId } = req.query;
    const daysNum = parseInt(days);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    let warehouseIds = null;
    if (branchId && branchId !== "all") {
      const branch = await prisma.branch.findUnique({ where: { id: parseInt(branchId) }, select: { warehouseId: true } });
      warehouseIds = branch?.warehouseId ? [branch.warehouseId] : [-1];
    } else if (accessibleBranchIds) {
      const branches = await prisma.branch.findMany({ where: { id: { in: accessibleBranchIds } }, select: { warehouseId: true } });
      warehouseIds = branches.map((b) => b.warehouseId).filter(Boolean);
    }
    const inventoryRows = await prisma.inventory.findMany({
      where: { quantity: { gt: 0 }, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) },
      include: { item: { select: { id: true, name: true, unit: true, costPrice: true } }, warehouse: { select: { name: true } } },
    });
    const results = [];
    for (const inv of inventoryRows) {
      const lastSale = await prisma.saleItem.findFirst({ where: { itemId: inv.itemId }, orderBy: { id: "desc" }, include: { sale: { select: { createdAt: true } } } });
      const daysSince = lastSale?.sale?.createdAt ? Math.floor((Date.now() - new Date(lastSale.sale.createdAt).getTime()) / 86400000) : Infinity;
      if (daysSince >= daysNum) {
        results.push({ itemName: inv.item.name, unit: inv.item.unit, quantity: parseFloat(inv.quantity), warehouseName: inv.warehouse.name, daysSinceLastSale: daysSince === Infinity ? null : daysSince, stockValue: +(parseFloat(inv.quantity) * parseFloat(inv.item.costPrice)).toFixed(2) });
      }
    }
    res.json(results);
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate dead stock report" });
  }
});

router.get("/dead-stock/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { days = "90", branchId } = req.query;
    const daysNum = parseInt(days);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    let warehouseIds = null;
    if (branchId && branchId !== "all") { const b = await prisma.branch.findUnique({ where: { id: parseInt(branchId) }, select: { warehouseId: true } }); warehouseIds = b?.warehouseId ? [b.warehouseId] : [-1]; }
    else if (accessibleBranchIds) { const bs = await prisma.branch.findMany({ where: { id: { in: accessibleBranchIds } }, select: { warehouseId: true } }); warehouseIds = bs.map((b) => b.warehouseId).filter(Boolean); }
    const inventoryRows = await prisma.inventory.findMany({ where: { quantity: { gt: 0 }, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) }, include: { item: { select: { id: true, name: true, unit: true, costPrice: true } }, warehouse: { select: { name: true } } } });
    const rows = [];
    for (const inv of inventoryRows) {
      const lastSale = await prisma.saleItem.findFirst({ where: { itemId: inv.itemId }, orderBy: { id: "desc" }, include: { sale: { select: { createdAt: true } } } });
      const daysSince = lastSale?.sale?.createdAt ? Math.floor((Date.now() - new Date(lastSale.sale.createdAt).getTime()) / 86400000) : null;
      if (daysSince === null || daysSince >= daysNum) rows.push([inv.item.name, parseFloat(inv.quantity), inv.item.unit, inv.warehouse.name, daysSince ?? "لم تُباع من قبل", +(parseFloat(inv.quantity) * parseFloat(inv.item.costPrice)).toFixed(2)]);
    }
    sendXlsx(res, "المخزون-الراكد", "المخزون الراكد", ["الصنف", "الكمية", "الوحدة", "المستودع", "أيام بلا بيع", "قيمة المخزون (EGP)"], rows);
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/fabric/remaining-meters ──────────────────────────────────
router.get("/fabric/remaining-meters", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { branchId } = req.query;
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    let warehouseIds = null;
    if (branchId && branchId !== "all") { const b = await prisma.branch.findUnique({ where: { id: parseInt(branchId) }, select: { warehouseId: true } }); warehouseIds = b?.warehouseId ? [b.warehouseId] : [-1]; }
    else if (accessibleBranchIds) { const bs = await prisma.branch.findMany({ where: { id: { in: accessibleBranchIds } }, select: { warehouseId: true } }); warehouseIds = bs.map((b) => b.warehouseId).filter(Boolean); }
    const rolls = await prisma.fabricRoll.findMany({
      where: { status: { in: ["AVAILABLE", "PARTIALLY_CUT"] }, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) },
      select: { remainingLength: true, item: { select: { name: true } } },
    });
    const map = {};
    for (const r of rolls) { const k = r.item?.name || "غير معروف"; if (!map[k]) map[k] = { itemName: k, totalRemaining: 0, rollCount: 0 }; map[k].totalRemaining += parseFloat(r.remainingLength); map[k].rollCount++; }
    res.json({ rows: Object.values(map).map((r) => ({ ...r, totalRemaining: +r.totalRemaining.toFixed(2) })) });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate fabric report" });
  }
});

router.get("/fabric/remaining-meters/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { branchId } = req.query;
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    let warehouseIds = null;
    if (branchId && branchId !== "all") { const b = await prisma.branch.findUnique({ where: { id: parseInt(branchId) }, select: { warehouseId: true } }); warehouseIds = b?.warehouseId ? [b.warehouseId] : [-1]; }
    else if (accessibleBranchIds) { const bs = await prisma.branch.findMany({ where: { id: { in: accessibleBranchIds } }, select: { warehouseId: true } }); warehouseIds = bs.map((b) => b.warehouseId).filter(Boolean); }
    const rolls = await prisma.fabricRoll.findMany({ where: { status: { in: ["AVAILABLE", "PARTIALLY_CUT"] }, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) }, select: { remainingLength: true, item: { select: { name: true } } } });
    const map = {};
    for (const r of rolls) { const k = r.item?.name || "غير معروف"; if (!map[k]) map[k] = { itemName: k, totalRemaining: 0, rollCount: 0 }; map[k].totalRemaining += parseFloat(r.remainingLength); map[k].rollCount++; }
    sendXlsx(res, "متبقي-الأقمشة", "الأقمشة", ["اسم القماش", "الإجمالي المتبقي (م)", "عدد اللفات"], Object.values(map).map((r) => [r.itemName, +r.totalRemaining.toFixed(2), r.rollCount]));
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/fabric/rolls-by-age ─────────────────────────────────────
router.get("/fabric/rolls-by-age", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { branchId } = req.query;
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    let warehouseIds = null;
    if (branchId && branchId !== "all") { const b = await prisma.branch.findUnique({ where: { id: parseInt(branchId) }, select: { warehouseId: true } }); warehouseIds = b?.warehouseId ? [b.warehouseId] : [-1]; }
    else if (accessibleBranchIds) { const bs = await prisma.branch.findMany({ where: { id: { in: accessibleBranchIds } }, select: { warehouseId: true } }); warehouseIds = bs.map((b) => b.warehouseId).filter(Boolean); }
    const rolls = await prisma.fabricRoll.findMany({ where: { status: { in: ["AVAILABLE", "PARTIALLY_CUT"] }, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) }, select: { remainingLength: true, createdAt: true } });
    const buckets = { "<30 يوم": { count: 0, totalMeters: 0 }, "30–90 يوم": { count: 0, totalMeters: 0 }, ">90 يوم": { count: 0, totalMeters: 0 } };
    const now = Date.now();
    for (const r of rolls) {
      const days = Math.floor((now - new Date(r.createdAt).getTime()) / 86400000);
      const m = parseFloat(r.remainingLength);
      if (days < 30) { buckets["<30 يوم"].count++; buckets["<30 يوم"].totalMeters += m; }
      else if (days <= 90) { buckets["30–90 يوم"].count++; buckets["30–90 يوم"].totalMeters += m; }
      else { buckets[">90 يوم"].count++; buckets[">90 يوم"].totalMeters += m; }
    }
    res.json({ buckets: Object.entries(buckets).map(([label, { count, totalMeters }]) => ({ label, count, totalMeters: +totalMeters.toFixed(2) })) });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate fabric age report" });
  }
});

router.get("/fabric/rolls-by-age/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { branchId } = req.query;
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    let warehouseIds = null;
    if (branchId && branchId !== "all") { const b = await prisma.branch.findUnique({ where: { id: parseInt(branchId) }, select: { warehouseId: true } }); warehouseIds = b?.warehouseId ? [b.warehouseId] : [-1]; }
    else if (accessibleBranchIds) { const bs = await prisma.branch.findMany({ where: { id: { in: accessibleBranchIds } }, select: { warehouseId: true } }); warehouseIds = bs.map((b) => b.warehouseId).filter(Boolean); }
    const rolls = await prisma.fabricRoll.findMany({ where: { status: { in: ["AVAILABLE", "PARTIALLY_CUT"] }, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) }, select: { remainingLength: true, createdAt: true } });
    const buckets = { "<30 يوم": { count: 0, totalMeters: 0 }, "30–90 يوم": { count: 0, totalMeters: 0 }, ">90 يوم": { count: 0, totalMeters: 0 } };
    const now = Date.now();
    for (const r of rolls) { const days = Math.floor((now - new Date(r.createdAt).getTime()) / 86400000); const m = parseFloat(r.remainingLength); if (days < 30) { buckets["<30 يوم"].count++; buckets["<30 يوم"].totalMeters += m; } else if (days <= 90) { buckets["30–90 يوم"].count++; buckets["30–90 يوم"].totalMeters += m; } else { buckets[">90 يوم"].count++; buckets[">90 يوم"].totalMeters += m; } }
    sendXlsx(res, "لفات-الأقمشة-حسب-العمر", "العمر", ["الفئة العمرية", "عدد اللفات", "إجمالي المتر (م)"], Object.entries(buckets).map(([l, { count, totalMeters }]) => [l, count, +totalMeters.toFixed(2)]));
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/shift-reconciliation ─────────────────────────────────────
router.get("/shift-reconciliation", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = { startTime: { gte: start, lte: end }, status: "CLOSED" };
    if (branchId && branchId !== "all") {
      const id = parseInt(branchId);
      if (accessibleBranchIds && !accessibleBranchIds.includes(id)) return res.status(403).json({ error: "Branch not accessible" });
      where.branchId = id;
    } else if (accessibleBranchIds) { where.branchId = { in: accessibleBranchIds }; }
    const shifts = await prisma.shift.findMany({ where, include: { branch: { select: { name: true } }, user: { select: { username: true } } }, orderBy: { startTime: "desc" } });
    res.json({ shifts: shifts.map((s) => ({ shiftId: s.id, branchName: s.branch?.name || "", cashierName: s.user?.username || "", type: s.type, date: s.startTime.toISOString().split("T")[0], startCash: parseFloat(s.startCash), systemExpectedCash: s.systemExpectedCash ? parseFloat(s.systemExpectedCash) : null, actualCash: s.actualCash ? parseFloat(s.actualCash) : null, shortage: s.shortage ? parseFloat(s.shortage) : null })) });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to generate shift report" });
  }
});

router.get("/shift-reconciliation/export.xlsx", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { from, to, branchId } = req.query;
    const { start, end } = parseDateRange(from, to);
    const accessibleBranchIds = await getAccessibleBranchIds(req.user.id, req);
    const where = { startTime: { gte: start, lte: end }, status: "CLOSED" };
    if (branchId && branchId !== "all") { where.branchId = parseInt(branchId); } else if (accessibleBranchIds) { where.branchId = { in: accessibleBranchIds }; }
    const shifts = await prisma.shift.findMany({ where, include: { branch: { select: { name: true } }, user: { select: { username: true } } }, orderBy: { startTime: "desc" } });
    const rows = shifts.map((s) => [s.id, s.branch?.name || "", s.user?.username || "", s.type === "MORNING" ? "صباحي" : "مسائي", s.startTime.toISOString().split("T")[0], parseFloat(s.startCash), s.systemExpectedCash ? parseFloat(s.systemExpectedCash) : "", s.actualCash ? parseFloat(s.actualCash) : "", s.shortage ? parseFloat(s.shortage) : ""]);
    sendXlsx(res, "تسوية-الورديات", "الورديات", ["رقم الوردية", "الفرع", "الكاشير", "النوع", "التاريخ", "رصيد البداية", "المتوقع", "الفعلي", "العجز (EGP)"], rows);
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// ── GET /api/reports/dashboard/owner ─────────────────────────────────────────
let ownerDashboardCache = { data: null, expiry: 0 };

router.get("/dashboard/owner", requirePermission("OWNER_DASHBOARD"), async (req, res) => {
  try {
    if (Date.now() < ownerDashboardCache.expiry && ownerDashboardCache.data) {
      return res.json(ownerDashboardCache.data);
    }
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [todaySales, mtdSales, trend30dSales, topItems, treasuries, allInventory, pendingShiftCount, allBranches] = await Promise.all([
      prisma.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: todayStart } }, select: { total: true, branchId: true, branch: { select: { name: true } } } }),
      prisma.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: mtdStart } }, select: { total: true, branchId: true } }),
      prisma.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } }, select: { total: true, branchId: true, createdAt: true } }),
      prisma.saleItem.findMany({ where: { sale: { status: "COMPLETED", createdAt: { gte: mtdStart } }, itemId: { not: null } }, select: { total: true, quantity: true, item: { select: { name: true } } } }),
      prisma.treasury.findMany({ select: { id: true, name: true, balance: true } }),
      prisma.inventory.findMany({ include: { item: { select: { reorderPoint: true } } } }),
      prisma.shift.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.branch.findMany({ select: { id: true, name: true } }),
    ]);

    const reorderAlertCount = allInventory.filter((inv) => inv.item.reorderPoint > 0 && parseFloat(inv.quantity) <= inv.item.reorderPoint).length;

    const todayByBranch = {};
    for (const s of todaySales) { if (!todayByBranch[s.branchId]) todayByBranch[s.branchId] = { branchId: s.branchId, branchName: s.branch?.name || "", total: 0, invoiceCount: 0 }; todayByBranch[s.branchId].total += parseFloat(s.total); todayByBranch[s.branchId].invoiceCount++; }

    const mtdByBranch = {};
    for (const s of mtdSales) { if (!mtdByBranch[s.branchId]) mtdByBranch[s.branchId] = { branchId: s.branchId, total: 0 }; mtdByBranch[s.branchId].total += parseFloat(s.total); }

    const trendMap = {};
    for (let i = 0; i < 30; i++) { const d = new Date(thirtyDaysAgo); d.setDate(d.getDate() + i); const key = d.toISOString().split("T")[0]; trendMap[key] = {}; for (const b of allBranches) trendMap[key][b.id] = 0; }
    for (const s of trend30dSales) { const key = new Date(s.createdAt).toISOString().split("T")[0]; if (trendMap[key]) trendMap[key][s.branchId] = (trendMap[key][s.branchId] || 0) + parseFloat(s.total); }
    const trendLabels = Object.keys(trendMap).sort();
    const perBranchTrend = allBranches.map((b) => ({ branchId: b.id, branchName: b.name, data: trendLabels.map((l) => +(trendMap[l][b.id] || 0).toFixed(2)) }));

    const itemMap = {};
    for (const si of topItems) { const k = si.item?.name || "BOM"; if (!itemMap[k]) itemMap[k] = { itemName: k, revenue: 0, quantity: 0 }; itemMap[k].revenue += parseFloat(si.total); itemMap[k].quantity += parseFloat(si.quantity); }
    const top5Items = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((i) => ({ ...i, revenue: +i.revenue.toFixed(2) }));

    const data = {
      today: { total: +(todaySales.reduce((s, x) => s + parseFloat(x.total), 0)).toFixed(2), perBranch: Object.values(todayByBranch).map((b) => ({ ...b, total: +b.total.toFixed(2) })) },
      mtd: { total: +(mtdSales.reduce((s, x) => s + parseFloat(x.total), 0)).toFixed(2), perBranch: Object.values(mtdByBranch).map((b) => ({ ...b, total: +b.total.toFixed(2) })) },
      trend30d: { labels: trendLabels, perBranch: perBranchTrend },
      top5Items,
      treasuries: treasuries.map((t) => ({ id: t.id, name: t.name, balance: +parseFloat(t.balance).toFixed(2) })),
      reorderAlertCount,
      pendingShiftReviews: pendingShiftCount,
    };

    ownerDashboardCache = { data, expiry: Date.now() + 60_000 };
    res.json(data);
  } catch (err) {
    console.error("Owner dashboard error:", err);
    res.status(500).json({ error: "Failed to load owner dashboard", details: err.message });
  }
});

module.exports = router;
