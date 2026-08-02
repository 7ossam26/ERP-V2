const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireCreatePermission, getUserBranchFilter, requireAnyPermission, requireSensitiveAccess } = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// Africa/Cairo is UTC+2 with no DST. Date filters from the UI ("YYYY-MM-DD")
// are Cairo wall-clock dates; convert to UTC instants by subtracting 2h so the
// query is correct regardless of the server's local timezone.
const CAIRO_OFFSET_MS = 2 * 60 * 60 * 1000;

const cairoTodayISO = () => {
  const nowCairoMs = Date.now() + CAIRO_OFFSET_MS;
  return new Date(nowCairoMs).toISOString().slice(0, 10);
};

const parseDateStart = (s) => {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : cairoTodayISO();
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) - CAIRO_OFFSET_MS);
};
const parseDateEnd = (s) => {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : cairoTodayISO();
  return new Date(Date.parse(`${ymd}T23:59:59.999Z`) - CAIRO_OFFSET_MS);
};

// GET all branches
router.get("/", async (req, res, next) => {
  try {
    // Determine visibility based on user role/branch assignment
    // Fetch user with role to check if they should see all branches
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    // Build query
    const where = { isActive: true };

    // General Manager and Superadmin see ALL branches
    const canSeeAllBranches =
      user.role.name === "Superadmin" ||
      user.role.name === "Admin" ||
      user.role.name === "General Manager";

    // Apply branch filter only for non-global roles
    // NOTE: Don't pass req — ignore active branch header so the list
    // shows ALL accessible branches (used for dropdowns/selectors)
    if (!canSeeAllBranches) {
      const branchFilter = await getUserBranchFilter(req.user.id);
      if (branchFilter) {
        if (branchFilter.id.in) {
          // Multi-branch user
          where.id = { in: branchFilter.id.in };
        } else {
          // Single-branch user
          where.id = branchFilter.id;
        }
      }
    }

    const branches = await prisma.branch.findMany({
      where,
      include: {
        warehouse: true,
        treasury: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(branches);
  } catch (error) {
    next(error);
  }
});

// GET Financial Summary (Total Balance & Daily Change)
router.get("/summary", async (req, res, next) => {
  try {
    // 1. Get all branches with treasuries to calculate current total balance
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: { treasury: true },
    });

    const totalBalance = branches.reduce(
      (sum, branch) => sum + Number(branch.treasury?.balance || 0),
      0
    );

    // 2. Calculate Today's Net Change (Income - Expense) to derive Yesterday's Balance
    const startOfDay = parseDateStart(undefined); // Cairo 00:00 today

    // Income: Sum of 'paidAmount' from Sales created today
    // Note: Assuming Sales affect treasury directly via paidAmount
    const todaySales = await prisma.sale.aggregate({
      _sum: {
        paidAmount: true,
      },
      where: {
        createdAt: {
          gte: startOfDay,
        },
        status: { not: "CANCELLED" },
      },
    });

    const income = Number(todaySales._sum.paidAmount || 0);

    // Expense: Sum of 'paidAmount' from Purchases created today
    const todayPurchases = await prisma.purchase.aggregate({
      _sum: {
        paidAmount: true,
      },
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    });

    const expense = Number(todayPurchases._sum.paidAmount || 0);

    const netChange = income - expense;

    // 3. Calculate Yesterday's Balance and Percentage Change
    // CurrentBalance = YesterdayBalance + NetChange
    // YesterdayBalance = CurrentBalance - NetChange
    const yesterdayBalance = totalBalance - netChange;

    let percentageChange = 0;
    if (yesterdayBalance !== 0) {
      percentageChange = (netChange / yesterdayBalance) * 100;
    } else if (netChange > 0) {
      percentageChange = 100; // 0 to something is 100% growth effectively
    }

    res.json({
      totalBalance,
      percentageChange: percentageChange.toFixed(1), // Returns string "12.5"
      netChange,
      // D4: makes the trend's time scope unambiguous to the UI; the page can
      // label the badge as "اليوم vs الأمس" instead of letting users assume
      // it follows the date filter.
      scope: "today-vs-yesterday",
    });
  } catch (error) {
    next(error);
  }
});

// GET branch balances — CASH/INSTAPAY/VISA sales per branch for the requested date window
router.get("/balances", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    const canSeeAllBranches =
      user.role.name === "Superadmin" ||
      user.role.name === "Admin" ||
      user.role.name === "General Manager";

    const where = { isActive: true };
    if (!canSeeAllBranches) {
      // Don't pass req — show all accessible branches, not just the active one
      const branchFilter = await getUserBranchFilter(req.user.id);
      if (branchFilter) {
        where.id = branchFilter.id.in ? { in: branchFilter.id.in } : branchFilter.id;
      }
    }

    const branches = await prisma.branch.findMany({
      where,
      include: {
        treasury: { select: { balance: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Date range: accept ?from=YYYY-MM-DD&to=YYYY-MM-DD as Cairo local dates.
    // Defaults to Cairo "today" when omitted (see parseDate helpers at top of file).
    const rangeStart = parseDateStart(req.query.from);
    const rangeEnd = parseDateEnd(req.query.to);

    const branchIds = branches.map((b) => b.id);
    // Bulk orders are scoped to a warehouse, not a branch directly. Build a
    // warehouse → branch map so we can attribute bulk paidAmount back to the
    // owning branch.
    const warehouseToBranch = Object.fromEntries(
      branches.filter((b) => b.warehouseId).map((b) => [b.warehouseId, b.id]),
    );
    const branchWarehouseIds = Object.keys(warehouseToBranch).map(Number);

    // Aggregate Visa + Instapay sales per branch for the window.
    // Sum `total` to mirror what sales.js:759,788 actually increments into the
    // treasury. `paidAmount` is unreliable for VISA/INSTAPAY because the card is
    // charged externally and the POS form commonly leaves `paidAmount` blank
    // while still completing the sale — that produced phantom-zero figures.
    const cardSalesByMethod = await prisma.sale.groupBy({
      by: ["branchId", "paymentMethod"],
      where: {
        paymentMethod: { in: ["INSTAPAY", "VISA"] },
        status: "COMPLETED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
        branchId: { in: branchIds },
      },
      _sum: { total: true },
    });
    const instapaySales = cardSalesByMethod.filter((r) => r.paymentMethod === "INSTAPAY");
    const visaSales     = cardSalesByMethod.filter((r) => r.paymentMethod === "VISA");

    // Visa + Instapay treasury running balances — still consumed by
    // BranchBalancesPage. Kept on every row for backward compatibility; new UI
    // shouldn't read these (use the dedicated /treasuries/global-balances).
    const sysConfig = await prisma.systemConfiguration.findFirst({
      select: { visaTreasuryId: true, instapayTreasuryId: true },
    });
    const [visaTreasury, instapayTreasury] = await Promise.all([
      sysConfig?.visaTreasuryId
        ? prisma.treasury.findUnique({
            where: { id: sysConfig.visaTreasuryId },
            select: { balance: true },
          })
        : Promise.resolve(null),
      sysConfig?.instapayTreasuryId
        ? prisma.treasury.findUnique({
            where: { id: sysConfig.instapayTreasuryId },
            select: { balance: true },
          })
        : Promise.resolve(null),
    ]);
    const visaTreasuryBalance     = Number(visaTreasury?.balance || 0);
    const instapayTreasuryBalance = Number(instapayTreasury?.balance || 0);

    // CASH: D7 — only count sales whose money has actually reached the till.
    //   - non-delivery sales: deliveryStatus IS NULL → cash collected at sale time
    //   - DELIVERED delivery sales: cash settled into treasury
    // Exclude PENDING / OUT_FOR_DELIVERY / RETURNED / CANCELED — money is not in the till.
    const cashSales = await prisma.sale.groupBy({
      by: ["branchId"],
      where: {
        paymentMethod: "CASH",
        status: "COMPLETED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
        branchId: { in: branchIds },
        OR: [
          { deliveryStatus: null },
          { deliveryStatus: "DELIVERED" },
        ],
      },
      _sum: { total: true },
    });

    // Retail sales that actually brought money in during the window — card
    // sales plus collected cash sales (same conditions as the sums above).
    // Used for the per-branch invoice count and the previous-window total.
    const collectedSaleWhere = (start, end) => ({
      status: "COMPLETED",
      createdAt: { gte: start, lte: end },
      branchId: { in: branchIds },
      OR: [
        { paymentMethod: { in: ["VISA", "INSTAPAY"] } },
        {
          paymentMethod: "CASH",
          OR: [{ deliveryStatus: null }, { deliveryStatus: "DELIVERED" }],
        },
      ],
    });

    const salesCounts = await prisma.sale.groupBy({
      by: ["branchId"],
      where: collectedSaleWhere(rangeStart, rangeEnd),
      _count: { id: true },
    });
    const salesCountMap = Object.fromEntries(
      salesCounts.map((r) => [r.branchId, r._count.id]),
    );

    // Previous window of equal length, ending right before rangeStart — lets
    // the UI show a trend that follows the selected filter instead of a
    // hardwired today-vs-yesterday comparison.
    const windowMs = rangeEnd.getTime() - rangeStart.getTime();
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevStart = new Date(rangeStart.getTime() - 1 - windowMs);

    const prevRetailSales = await prisma.sale.groupBy({
      by: ["branchId"],
      where: collectedSaleWhere(prevStart, prevEnd),
      _sum: { total: true },
    });
    const prevRetailMap = Object.fromEntries(
      prevRetailSales.map((r) => [r.branchId, Number(r._sum.total || 0)]),
    );

    const prevBulkOrders = branchWarehouseIds.length
      ? await prisma.bulkOrder.groupBy({
          by: ["warehouseId"],
          where: {
            createdAt: { gte: prevStart, lte: prevEnd },
            warehouseId: { in: branchWarehouseIds },
            status: { notIn: ["DRAFT", "CANCELLED"] },
          },
          _sum: { paidAmount: true },
        })
      : [];
    const prevBulkMap = Object.fromEntries(
      prevBulkOrders.map((r) => [
        warehouseToBranch[r.warehouseId],
        Number(r._sum.paidAmount || 0),
      ]),
    );

    // Bulk orders per branch (via warehouseId). Mirrors retail logic — sum
    // paidAmount in window, exclude DRAFT/CANCELLED so only money that
    // actually moved through the order counts.
    const bulkOrders = branchWarehouseIds.length
      ? await prisma.bulkOrder.groupBy({
          by: ["warehouseId"],
          where: {
            createdAt: { gte: rangeStart, lte: rangeEnd },
            warehouseId: { in: branchWarehouseIds },
            status: { notIn: ["DRAFT", "CANCELLED"] },
          },
          _sum: { paidAmount: true },
        })
      : [];
    const bulkMap = Object.fromEntries(
      bulkOrders.map((r) => [warehouseToBranch[r.warehouseId], Number(r._sum.paidAmount || 0)]),
    );

    const instapayMap = Object.fromEntries(
      instapaySales.map((r) => [r.branchId, Number(r._sum.total || 0)]),
    );
    const visaMap = Object.fromEntries(
      visaSales.map((r) => [r.branchId, Number(r._sum.total || 0)]),
    );
    const cashMap = Object.fromEntries(
      cashSales.map((r) => [r.branchId, Number(r._sum.total || 0)]),
    );

    // Expenses per branch — Expense links to Treasury (not Branch directly), so
    // build a treasuryId → branchId map and aggregate via treasuryId.
    const treasuryToBranch = Object.fromEntries(
      branches.filter((b) => b.treasuryId).map((b) => [b.treasuryId, b.id]),
    );
    const branchTreasuryIds = Object.keys(treasuryToBranch).map(Number);

    // Split by type. The two answer different questions and must not be
    // conflated:
    //   totalExpenses     — every expense row, so it matches the cash that
    //                       actually left the branch treasury. PURCHASE rows are
    //                       auto-created by routes/purchases.js and really do
    //                       debit the treasury.
    //   operatingExpenses — MANUAL only, the running-cost KPI. Mirrors the
    //                       exclusion at routes/reports.js, which drops PURCHASE
    //                       rows so spend isn't double-counted against COGS.
    //
    // NOTE: the window filters on `date`, which is user-supplied and editable,
    // not on `createdAt`. That is deliberate for a reporting figure (an expense
    // backdated to when it was incurred belongs in that period) but it means
    // this total is NOT a reliable cash-movement window. The shift drawer math
    // in routes/shifts.js uses createdAt for exactly that reason.
    const expenses = branchTreasuryIds.length
      ? await prisma.expense.groupBy({
          by: ["treasuryId", "type"],
          where: {
            treasuryId: { in: branchTreasuryIds },
            date: { gte: rangeStart, lte: rangeEnd },
          },
          _sum: { amount: true },
        })
      : [];
    const expensesMap = {};
    const operatingExpensesMap = {};
    for (const row of expenses) {
      const branchIdForRow = treasuryToBranch[row.treasuryId];
      const amount = Number(row._sum.amount || 0);
      expensesMap[branchIdForRow] = (expensesMap[branchIdForRow] || 0) + amount;
      if (row.type === "MANUAL") {
        operatingExpensesMap[branchIdForRow] =
          (operatingExpensesMap[branchIdForRow] || 0) + amount;
      }
    }

    // Live shift context per branch, so the page can show the drawer the branch
    // is actually working against rather than only the treasury stock figure.
    // Independent of the date window — like currentCashBalance, this is "now".
    const activeShifts = branchIds.length
      ? await prisma.shift.findMany({
          where: { branchId: { in: branchIds }, status: { in: ["OPEN", "PENDING_REVIEW"] } },
          orderBy: { startTime: "desc" },
          select: { id: true, branchId: true, status: true, startCash: true, startTime: true },
        })
      : [];
    const shiftByBranch = {};
    for (const s of activeShifts) {
      // findMany is ordered newest-first, so the first hit per branch wins.
      if (!shiftByBranch[s.branchId]) shiftByBranch[s.branchId] = s;
    }

    const activeShiftIds = Object.values(shiftByBranch).map((s) => s.id);
    const shiftExpenseRows = activeShiftIds.length
      ? await prisma.expense.groupBy({
          by: ["shiftId"],
          where: { shiftId: { in: activeShiftIds } },
          _sum: { amount: true },
        })
      : [];
    const shiftExpenseByShiftId = Object.fromEntries(
      shiftExpenseRows.map((r) => [r.shiftId, Number(r._sum.amount || 0)]),
    );

    const result = branches.map((branch) => {
      const cashSalesInWindow = cashMap[branch.id] || 0;
      const visa     = visaMap[branch.id] || 0;
      const instapay = instapayMap[branch.id] || 0;
      const bulkSales = bulkMap[branch.id] || 0;
      const totalExpenses = expensesMap[branch.id] || 0;
      const operatingExpenses = operatingExpensesMap[branch.id] || 0;
      // Stock: cash physically/logically in this branch's treasury right now.
      // Independent of the date window — D3.
      //
      // Since the shift-treasury postings landed this figure also carries the
      // opening float and every approved closing variance, so it now tracks the
      // physical drawer rather than sitting permanently short by the float.
      const currentCashBalance = Number(branch.treasury?.balance || 0);
      const activeShift = shiftByBranch[branch.id] || null;
      return {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        // New, semantically clean fields:
        currentCashBalance,    // stock — "right now" cash in branch
        cashSales: cashSalesInWindow, // flow — paid CASH revenue in window
        visa,                  // flow — paid VISA revenue in window
        instapay,              // flow — paid INSTAPAY revenue in window
        bulkSales,             // flow — paid bulk-order revenue in window
        totalExpenses,         // flow — ALL branch expenses in window (= cash out)
        operatingExpenses,     // flow — MANUAL expenses only (running-cost KPI)

        // Live shift context — stock, not windowed. null when the branch has no
        // unclosed shift.
        activeShift: activeShift
          ? {
              id: activeShift.id,
              status: activeShift.status,
              startTime: activeShift.startTime,
              openingCash: Number(activeShift.startCash || 0),
              shiftExpenses: shiftExpenseByShiftId[activeShift.id] || 0,
            }
          : null,
        salesCount: salesCountMap[branch.id] || 0, // invoices collected in window
        // Combined total of the window's flow figures (no stock mixed in).
        total: Math.round((cashSalesInWindow + visa + instapay + bulkSales) * 100) / 100,
        // Same combined total for the equal-length window right before this
        // one — powers the filter-aware trend on the sales page.
        prevTotal:
          Math.round(
            ((prevRetailMap[branch.id] || 0) + (prevBulkMap[branch.id] || 0)) * 100,
          ) / 100,
        treasuryName: branch.treasury?.name || "الخزينة",
        // Visa/Instapay treasury running balances — still consumed by
        // BranchBalancesPage's "الرصيد المتراكم" cards.
        visaTreasuryBalance,
        instapayTreasuryBalance,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET branch by ID - Accessible if it matches user's branch or user has global access
router.get("/:id", async (req, res, next) => {
  try {
    const branchId = parseInt(req.params.id);

    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    if (!branch || !branch.isActive) {
      return res.status(404).json({ error: "Branch not found" });
    }
    res.json(branch);
  } catch (error) {
    next(error);
  }
});

// POST create new branch
router.post("/", requireCreatePermission("CREATES_BRANCHES"), async (req, res, next) => {
  try {
    const { name, address, warehouseId, treasuryId } = req.body;

    // Validate required fields
    if (!name || !address || !warehouseId || !treasuryId) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name, address, warehouseId, and treasuryId are required",
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        warehouseId: parseInt(warehouseId),
        treasuryId: parseInt(treasuryId),
      },
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    res.status(201).json(branch);
  } catch (error) {
    next(error);
  }
});

// PUT update branch - Requires SENSITIVE ACCESS
router.put("/:id", requireAnyPermission(["BRANCHES", "CREATES_BRANCHES"]), requireSensitiveAccess, async (req, res, next) => {
  try {
    const { name, address, warehouseId, treasuryId } = req.body;
    const branchId = parseInt(req.params.id);

    // Check if the treasury is already linked to a different branch
    if (treasuryId !== undefined) {
      const conflict = await prisma.branch.findFirst({
        where: {
          treasuryId: parseInt(treasuryId),
          id: { not: branchId },
        },
      });
      if (conflict) {
        return res.status(400).json({
          error: "Treasury already in use",
          message: `هذه الخزينة مرتبطة بالفرع "${conflict.name}" بالفعل. يرجى إلغاء ارتباطها أولاً.`,
        });
      }
    }

    // Check if the warehouse is already linked to a different branch
    if (warehouseId !== undefined) {
      const conflict = await prisma.branch.findFirst({
        where: {
          warehouseId: parseInt(warehouseId),
          id: { not: branchId },
        },
      });
      if (conflict) {
        return res.status(400).json({
          error: "Warehouse already in use",
          message: `هذا المستودع مرتبط بالفرع "${conflict.name}" بالفعل. يرجى إلغاء ارتباطه أولاً.`,
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (warehouseId !== undefined)
      updateData.warehouseId = parseInt(warehouseId);
    if (treasuryId !== undefined) updateData.treasuryId = parseInt(treasuryId);

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: updateData,
      include: {
        warehouse: true,
        treasury: true,
      },
    });
    res.json(branch);
  } catch (error) {
    next(error);
  }
});

// DELETE branch - Requires SENSITIVE ACCESS
router.delete("/:id", requirePermission("BRANCHES"), requireSensitiveAccess, async (req, res, next) => {
  try {
    await prisma.branch.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
