const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");
const {
  parseDateStart,
  parseDateEnd,
  cairoDayKey,
  cairoHourKey,
} = require("../utils/dateRange");
const {
  computeSalesBasisBridge,
  INVOICED_BULK_STATUSES,
} = require("../lib/salesBasisBridge");

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

/**
 * Which branches may this request read?
 *
 * `getUserBranchFilter` is called WITHOUT `req` on purpose: that suppresses the
 * `x-active-branch-id` header path, so a report covers every branch the user is
 * allowed to see rather than only the one the BranchSwitcher happens to be on.
 *
 * Shared by /general and /sales-basis so the reconciliation is computed over
 * exactly the branches the report it explains was computed over. Returns
 * `{ denied: true }` when the caller asks for a branch outside their access.
 */
const resolveBranchScope = async (userId, branchId) => {
  const authorizedBranchFilter = await getUserBranchFilter(userId);

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
      return { denied: true };
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

  return { denied: false, branchFilter, isAllBranches, filterBranchIds };
};

router.get("/general", requirePermission("REPORTS"), async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    // --- 1. Filter Setup ---
    // Cairo wall-clock day boundaries. Previously this used `new Date(str)` +
    // setHours(), which resolves in the SERVER's timezone and so put this report
    // on different month boundaries than /api/branches/balances.
    const start = parseDateStart(startDate);
    const end = parseDateEnd(endDate);

    // Which branches may this user read? Extracted so /sales-basis resolves the
    // exact same scope — a reconciliation computed over a different branch set
    // than the report it explains would tie out to the wrong number.
    const scope = await resolveBranchScope(req.user.id, branchId);
    if (scope.denied) {
      return res.status(403).json({ error: "Access denied to this branch" });
    }
    const { branchFilter, isAllBranches, filterBranchIds } = scope;

    // --- 2. Fetch Data ---

    // A. Sales Data
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...branchFilter,
        status: "COMPLETED",
        // routes/shifts.js has always excluded voided sales and its comment
        // claims to mirror this query. It didn't — this is the missing half.
        isVoided: false,
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

    // A2. Wholesale (Bulk) Data
    //
    // Wholesale lives in its own table (bulk_orders) and is scoped to a
    // WAREHOUSE, not a branch. Branch.warehouseId is @unique, so the mapping is
    // one-to-one. A branch with no warehouse linked can never surface wholesale;
    // that is reported explicitly below rather than rendering as a real zero.
    let scopedWarehouseIds = null; // null = every warehouse (global "all branches")
    let branchesMissingWarehouse = [];
    if (!isAllBranches) {
      const scopedBranches = await prisma.branch.findMany({
        where: { id: { in: filterBranchIds } },
        select: { id: true, name: true, warehouseId: true },
      });
      scopedWarehouseIds = scopedBranches
        .map((b) => b.warehouseId)
        .filter((id) => id != null);
      branchesMissingWarehouse = scopedBranches
        .filter((b) => b.warehouseId == null)
        .map((b) => b.name);
    }

    const bulkOrderWhere = {
      createdAt: { gte: start, lte: end },
      // An allow-list, not `notIn: ["DRAFT","CANCELLED"]`. DRAFT moved no stock
      // and no money and CANCELLED was never owed — but the exclusion list also
      // let QUOTED through, booking a quotation nobody owes yet as revenue the
      // moment it was raised, and would count any status added to the enum
      // later. Shared with lib/salesBasisBridge.js so the report and the
      // reconciliation can never disagree on what "invoiced" means.
      status: { in: INVOICED_BULK_STATUSES },
    };
    if (scopedWarehouseIds) {
      bulkOrderWhere.warehouseId = { in: scopedWarehouseIds };
    }

    // `warehouse.branch` resolves the owning branch (Branch.warehouseId is
    // @unique) so wholesale can join the per-branch table alongside retail.
    const bulkOrderInclude = {
      items: { include: { item: { select: { name: true } } } },
      warehouse: { select: { branch: { select: { name: true } } } },
    };

    const bulkOrders = await prisma.bulkOrder.findMany({
      where: bulkOrderWhere,
      include: bulkOrderInclude,
    });

    // Wholesale returns reverse revenue the way a retail REFUND- row does, but
    // they are booked in the window the RETURN happened, not by pulling the
    // original order out of the month it was invoiced in — otherwise an August
    // return silently rewrites January's closed total.
    //
    // A bulk return is always whole-order (bulkRefund.controller.js calls
    // applyBulkOrderStockMovement with "CREDIT" for every line), so the reversal
    // is the order's full total and full COGS. BulkRefund.amount is only the
    // CASH handed back, which is smaller whenever the customer hadn't paid in
    // full — that is a cash-flow figure and does not belong in a revenue reversal.
    const bulkRefundWhere = { createdAt: { gte: start, lte: end } };
    if (scopedWarehouseIds) {
      bulkRefundWhere.order = { warehouseId: { in: scopedWarehouseIds } };
    }
    const bulkRefundRows = await prisma.bulkRefund.findMany({
      where: bulkRefundWhere,
      include: { order: { include: bulkOrderInclude } },
    });
    // One reversal per order even if several refund rows exist against it. The
    // refund's own createdAt is carried so the chart books the reversal on the
    // day the goods came back.
    const returnedOrders = [
      ...new Map(
        bulkRefundRows.map((r) => [
          r.orderId,
          { ...r.order, returnedOn: r.createdAt },
        ]),
      ).values(),
    ].filter((o) => o && o.id);

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
    // Reuses the warehouse scope resolved for wholesale above — same branch →
    // warehouse mapping, one query instead of two.
    let inventoryWhere = {};
    if (!isAllBranches) {
      inventoryWhere =
        scopedWarehouseIds.length > 0
          ? { warehouseId: { in: scopedWarehouseIds } }
          : { warehouseId: -1 };
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
    //
    // This report is the ACCRUAL view: what was invoiced in the window, retail
    // and wholesale together. It deliberately differs from /api/branches/balances,
    // which is the CASH view (what actually reached the till) — that page gates
    // cash sales on delivery and counts wholesale by payment date. Do not "fix"
    // one to match the other; they answer different questions.

    // Retail — sales.total is the tax-inclusive grand total. Refund rows are
    // negative COMPLETED sales, so they net the figure down on their own.
    const retailSales = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.total),
      0,
    );

    // Wholesale — BulkOrder.total is the equivalent tax-inclusive grand total,
    // so the two are directly addable. Returns reverse the full order.
    const wholesaleGross = bulkOrders.reduce(
      (sum, o) => sum + parseFloat(o.total),
      0,
    );
    const wholesaleReturns = returnedOrders.reduce(
      (sum, o) => sum + parseFloat(o.total),
      0,
    );
    const wholesaleSales = wholesaleGross - wholesaleReturns;

    const totalSales = retailSales + wholesaleSales;

    // Operating expenses EXCLUDE inventory purchases (type "PURCHASE"): a
    // purchase's cost is recognized as cost of goods sold when the stock is
    // sold, not when it's bought — counting both would double-count it.
    const operatingExpenses = expenses
      .filter((exp) => exp.type !== "PURCHASE")
      .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    // Cost of goods sold from each line's cost snapshot. Retail uses
    // SaleItem.costPrice (refund lines carry negative quantity, so they unwind
    // COGS automatically); wholesale uses BulkOrderItem.costPrice, whose
    // reversal is explicit because a returned order keeps its positive lines.
    const lineCOGS = (items) =>
      items.reduce(
        (s, it) => s + Number(it.costPrice || 0) * Number(it.quantity),
        0,
      );

    const retailCOGS = sales.reduce((sum, sale) => sum + lineCOGS(sale.items), 0);
    const wholesaleCOGS =
      bulkOrders.reduce((sum, o) => sum + lineCOGS(o.items), 0) -
      returnedOrders.reduce((sum, o) => sum + lineCOGS(o.items), 0);

    const totalCOGS = retailCOGS + wholesaleCOGS;

    // Net Profit = Sales − COGS − operating expenses.
    const grossProfit = totalSales - totalCOGS;
    const netProfit = grossProfit - operatingExpenses;
    // Refund rows are extra sales rows carrying a negative total. They must net
    // the money down but must NOT each count as another invoice — a sale plus
    // its refund is not "2 فاتورة" against a zero total.
    // A wholesale order returned later is still an invoice that was issued in
    // this window, so returns don't decrement the count either — only the money.
    //
    // The two halves are reported separately as well as blended. A wholesale
    // order is not the same kind of thing as a POS receipt, and مبيعات الفروع
    // counts only the retail half — so a bare blended number made the two
    // screens look like they disagreed about invoices when they were simply
    // counting different things. `invoiceCount` keeps its old blended meaning
    // for existing consumers; the split is additive.
    const isRefundRow = (sale) => String(sale.saleNumber || "").startsWith("REFUND-");
    const retailInvoiceCount = sales.filter((s) => !isRefundRow(s)).length;
    const invoiceCount = retailInvoiceCount + bulkOrders.length;

    // Inventory Alerts (Items below reorder point)
    const stockAlerts = stockAlertsList.length;

    // > Sales Chart (Over Time)
    // Single day => group by hour, longer range => group by day.
    //
    // Buckets and sales must be keyed the SAME way. They used to disagree: the
    // day buckets were seeded from the range in one zone while each sale was
    // keyed with `toISOString()` (UTC), so a sale just after Cairo midnight
    // landed on a key that was never seeded and the `!== undefined` guard below
    // silently dropped it — the chart could total less than the summary card.
    // Both sides now go through the Cairo key helpers.
    const isSingleDay = cairoDayKey(start) === cairoDayKey(end);
    const salesOverTime = {};

    // Initialize zero-filled data
    if (isSingleDay) {
      for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, "0") + ":00";
        salesOverTime[hour] = 0;
      }
    } else {
      // Fill Cairo days between start and end. `start` is a Cairo midnight, and
      // Cairo has no DST, so stepping a fixed 24h stays on midnight.
      const DAY_MS = 24 * 60 * 60 * 1000;
      for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
        salesOverTime[cairoDayKey(new Date(t))] = 0;
      }
    }

    // Every series below folds in wholesale as well as retail, so the chart and
    // the table still add up to the "إجمالي المبيعات" card above them.
    const addToBucket = (when, amount) => {
      const key = isSingleDay ? cairoHourKey(when) : cairoDayKey(when);
      if (salesOverTime[key] !== undefined) salesOverTime[key] += amount;
    };

    sales.forEach((sale) => addToBucket(sale.createdAt, parseFloat(sale.total)));
    bulkOrders.forEach((o) => addToBucket(o.createdAt, parseFloat(o.total)));
    // A return is booked on the day it happened, matching the summary card.
    returnedOrders.forEach((o) => addToBucket(o.returnedOn, -parseFloat(o.total)));

    // > Sales By Category (Doughnut)
    const salesByCategory = {};
    const addToItem = (itemName, amount) => {
      const name = itemName || "غير محدد";
      if (!salesByCategory[name]) salesByCategory[name] = 0;
      salesByCategory[name] += amount;
    };

    sales.forEach((sale) => {
      sale.items.forEach((saleItem) => {
        addToItem(saleItem.item?.name, parseFloat(saleItem.total));
      });
    });
    bulkOrders.forEach((o) => {
      o.items.forEach((line) => addToItem(line.item?.name, parseFloat(line.lineTotal)));
    });
    returnedOrders.forEach((o) => {
      o.items.forEach((line) => addToItem(line.item?.name, -parseFloat(line.lineTotal)));
    });

    // > Sales By Branch (Table)
    const branchStats = {};
    const bumpBranch = (branchName, amount, invoiceDelta) => {
      const name = branchName || "Unknown";
      if (!branchStats[name]) {
        branchStats[name] = { name, totalSales: 0, invoiceCount: 0 };
      }
      branchStats[name].totalSales += amount;
      branchStats[name].invoiceCount += invoiceDelta;
    };

    sales.forEach((sale) =>
      // Refunds net the money down but are not extra invoices — same rule as
      // the invoiceCount card, so averageInvoice below stays believable.
      bumpBranch(sale.branch?.name, parseFloat(sale.total), isRefundRow(sale) ? 0 : 1),
    );
    bulkOrders.forEach((o) =>
      bumpBranch(o.warehouse?.branch?.name, parseFloat(o.total), 1),
    );
    returnedOrders.forEach((o) =>
      bumpBranch(o.warehouse?.branch?.name, -parseFloat(o.total), 0),
    );

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
        // totalSales stays the combined headline figure so existing consumers
        // keep working; the split is additive.
        totalSales,
        retailSales,
        wholesaleSales,
        wholesaleOrderCount: bulkOrders.length,
        cogs: totalCOGS,
        grossProfit,
        operatingExpenses,
        netProfit,
        // Blended (retail + wholesale) — unchanged for existing consumers.
        invoiceCount,
        // The retail half on its own. This is the figure that is directly
        // comparable with `salesCount` on مبيعات الفروع.
        retailInvoiceCount,
        stockAlerts,
        // Wholesale is keyed off Branch.warehouseId. A branch without one can
        // never report wholesale, so say that instead of showing a bare 0 that
        // reads as "no wholesale sales this month".
        branchesMissingWarehouse,
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
 * GET /api/reports/sales-basis
 *
 * Why التقرير العام and مبيعات الفروع report different totals for the same
 * filter, term by term. Read-only; changes nothing either page displays.
 *
 * The two pages measure different things on purpose — invoiced vs collected —
 * but the gap is neither small nor stable (measured on production it swung from
 * −75,120 to +40,470 inside one day), so without this a user cannot tell a
 * legitimate wholesale timing difference from a bug.
 *
 * Accepts `from`/`to` as aliases for `startDate`/`endDate` so مبيعات الفروع can
 * forward its own filter state unchanged.
 *
 * Permission is REPORTS *or* SALES: مبيعات الفروع is reachable without REPORTS,
 * and the panel must not 403 for the branch managers who live on that page.
 * Branch scoping still runs through getUserBranchFilter, so this exposes no
 * branch the caller could not already read.
 */
router.get(
  "/sales-basis",
  requireAnyPermission(["REPORTS", "SALES"]),
  async (req, res) => {
    try {
      const startDate = req.query.startDate || req.query.from;
      const endDate = req.query.endDate || req.query.to;
      const start = parseDateStart(startDate);
      const end = parseDateEnd(endDate);

      const scope = await resolveBranchScope(req.user.id, req.query.branchId);
      if (scope.denied) {
        return res.status(403).json({ error: "Access denied to this branch" });
      }

      const bridge = await computeSalesBasisBridge({
        start,
        end,
        // null = every branch, matching /general's "all branches" scope.
        branchIds: scope.isAllBranches ? null : scope.filterBranchIds,
      });

      res.json({
        window: {
          startDate,
          endDate,
          startUtc: start.toISOString(),
          endUtc: end.toISOString(),
        },
        scope: {
          isAllBranches: scope.isAllBranches,
          branchIds: scope.isAllBranches ? null : scope.filterBranchIds,
        },
        ...bridge,
      });
    } catch (error) {
      console.error("❌ Error building sales basis bridge:", error);
      res.status(500).json({
        error: "Failed to build sales basis reconciliation",
        details: error.message,
      });
    }
  },
);

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
