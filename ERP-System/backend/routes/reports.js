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
// Protect all routes with REPORTS permission
router.use(authenticateToken, requirePermission("REPORTS"));

router.get("/general", async (req, res) => {
    try {
        const { startDate, endDate, branchId } = req.query;

        console.log("📊 Generating General Report...", {
            startDate,
            endDate,
            branchId,
        });

        // --- 1. Filter Setup ---
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const branchFilter = branchId ? { branchId: parseInt(branchId) } : {};

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
                        item: {
                            // category is Many-to-Many via ItemCategory.
                            // We just want item name for now, but if we really want category name:
                            // include: { categories: { include: { category: true } } }
                            // But let's keep it simple and just get the item details.
                        },
                    },
                },
                branch: true,
            },
        });

        // B. Expenses Data
        const expenseWhere = {
            date: { gte: start, lte: end },
        };

        if (branchId) {
            // Filter expenses where the treasury belongs to the branch
            expenseWhere.treasury = {
                branch: {
                    id: parseInt(branchId)
                }
            };
        }

        const expenses = await prisma.expense.findMany({
            where: expenseWhere,
        });

        // C. Inventory (Snapshot - Current State)
        // We can't easily "go back in time" for inventory without a ledger, so we return CURRENT warning levels.
        const inventoryItems = await prisma.inventory.findMany({
            where: {
                ...(branchId ? { warehouse: { branch: { id: parseInt(branchId) } } } : {}),
            },
            include: {
                item: true,
            },
        });

        // --- 3. Calculations ---

        // > Summary Cards
        const totalSales = sales.reduce(
            (sum, sale) => sum + parseFloat(sale.total),
            0
        );
        const totalExpenses = expenses.reduce(
            (sum, exp) => sum + parseFloat(exp.amount),
            0
        );
        // Rough Net Profit = Sales - Expenses (ignores COGS for now as it's complex)
        const netProfit = totalSales - totalExpenses;
        const invoiceCount = sales.length;

        // Inventory Alerts (Items below reorder point)
        const stockAlerts = inventoryItems.filter(
            (inv) => inv.quantity <= (inv.item.reorderPoint || 0)
        ).length;

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
                const hour = String(i).padStart(2, '0') + ":00";
                salesOverTime[hour] = 0;
            }
        } else {
            // Fill days between start and end
            const current = new Date(start);
            while (current <= end) {
                const day = current.toISOString().split('T')[0];
                salesOverTime[day] = 0;
                current.setDate(current.getDate() + 1);
            }
        }

        sales.forEach(sale => {
            const date = new Date(sale.createdAt);
            // Adjust for local time offset if needed, but for now assuming server time is consistent
            // If running locally, Date objects are local.

            let key;
            if (isSingleDay) {
                const hour = String(date.getHours()).padStart(2, '0') + ":00";
                key = hour;
            } else {
                key = date.toISOString().split('T')[0];
            }

            if (salesOverTime[key] !== undefined) {
                salesOverTime[key] += parseFloat(sale.total);
            }
        });

        // > Sales By Category (Doughnut)
        const salesByCategory = {};
        sales.forEach(sale => {
            sale.items.forEach(saleItem => {
                // Some items might not have a category linked properly in older data, handle gracefully
                // Actually item -> item_categories -> category. 
                // The schema says `items` has `categories` (ItemCategory[]).
                // This is Many-to-Many. simpler approach: assume 1st category or 'Uncategorized'.
                // In the include above, I included `item: { include: { category: true } }` 
                // BUT wait, schema says: `categories ItemCategory[]`.
                // So I need to fetch categories properly.
                // Let's rely on the flat list for now.
                // We need to fix the include to be correct for M-N if specific category needed.
                // For simplicity, we'll try to get category name if possible or just Item Name for "Top Items".
                // The UI shows "Sales Distribution by Item" in one chart, actually. "Ben Brazilian", "Ben Ethiopian".
                // So let's Group by ITEM Name.
                const itemName = saleItem.item.name;
                if (!salesByCategory[itemName]) salesByCategory[itemName] = 0;
                salesByCategory[itemName] += parseFloat(saleItem.total);
            });
        });

        // > Sales By Branch (Table)
        const branchStats = {};
        sales.forEach(sale => {
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
        const salesByBranch = Object.values(branchStats).map(stat => ({
            ...stat,
            averageInvoice: stat.invoiceCount ? (stat.totalSales / stat.invoiceCount) : 0,
            percentage: totalSales ? ((stat.totalSales / totalSales) * 100) : 0
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
                    data: Object.values(salesOverTime)
                },
                salesByItem: {
                    labels: Object.keys(salesByCategory),
                    data: Object.values(salesByCategory)
                }
            },
            tables: {
                salesByBranch,
                // We can add stock alerts detail if needed
                stockAlertsList: inventoryItems
                    .filter(inv => inv.quantity <= (inv.item.reorderPoint || 0))
                    .map(inv => ({
                        itemName: inv.item.name,
                        quantity: inv.quantity,
                        reorderPoint: inv.item.reorderPoint
                    }))
                    .slice(0, 5) // Top 5
            }
        });

    } catch (error) {
        console.error("❌ Error generating report:", error);
        res.status(500).json({ error: "Failed to generate report", details: error.message });
    }
});

module.exports = router;
