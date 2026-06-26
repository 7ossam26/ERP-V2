const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireSensitiveAccess, getUserBranchFilter } = require("../middleware/auth");

// Protect all routes with EXPENSES permission
router.use(authenticateToken, requirePermission("EXPENSES"));

// GET treasuries available for expense creation (scoped to user's branch)
// This avoids requiring the TREASURIES permission that employees may not have
router.get("/treasuries", async (req, res, next) => {
    try {
        const branchFilter = await getUserBranchFilter(req.user.id, req);

        // Build branch query
        const branchWhere = { isActive: true };
        if (branchFilter) {
            if (branchFilter.id && branchFilter.id.in) {
                branchWhere.id = { in: branchFilter.id.in };
            } else if (branchFilter.id) {
                branchWhere.id = branchFilter.id;
            }
        }

        // Find branches with their treasuries
        const branches = await prisma.branch.findMany({
            where: branchWhere,
            include: {
                treasury: {
                    select: { id: true, name: true, balance: true, isActive: true }
                }
            }
        });

        // Extract active treasuries
        const treasuries = branches
            .map(b => b.treasury)
            .filter(t => t && t.isActive);

        // Deduplicate by id (in case multiple branches share a treasury)
        const uniqueTreasuries = [...new Map(treasuries.map(t => [t.id, t])).values()];

        res.json(uniqueTreasuries);
    } catch (error) {
        next(error);
    }
});

// GET expense analysis report (grouped by category and branch)
router.get("/report", async (req, res, next) => {
    try {
        const { startDate, endDate, branchId, categoryId, paymentMethod } = req.query;
        const branchFilter = await getUserBranchFilter(req.user.id, req);
        const whereClause = {};

        // Branch scoping via treasury
        let allowedBranchIds = null;
        if (branchFilter) {
            const branchWhere = { ...branchFilter };
            const branches = await prisma.branch.findMany({
                where: branchWhere,
                select: { id: true, treasuryId: true }
            });
            allowedBranchIds = branches.map(b => b.id);
            const treasuryIds = branches.map(b => b.treasuryId).filter(id => id != null);
            whereClause.treasuryId = treasuryIds.length > 0 ? { in: treasuryIds } : -1;
        }

        // Apply branchId filter (must be within user's accessible branches)
        if (branchId && branchId !== "all") {
            const targetBranch = await prisma.branch.findUnique({
                where: { id: parseInt(branchId) },
                select: { treasuryId: true }
            });
            if (targetBranch) {
                const targetTreasuryId = targetBranch.treasuryId;
                // Intersect with allowed treasuries
                if (whereClause.treasuryId && whereClause.treasuryId.in) {
                    if (!whereClause.treasuryId.in.includes(targetTreasuryId)) {
                        return res.json({ rows: [], total: 0, byCategory: [], byCategoryBranch: [] });
                    }
                }
                whereClause.treasuryId = targetTreasuryId;
            }
        }

        // Date range filter
        if (startDate || endDate) {
            whereClause.date = {};
            if (startDate) whereClause.date.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.date.lte = end;
            }
        }

        // Category filter
        if (categoryId && categoryId !== "all") {
            whereClause.categoryId = categoryId === "uncategorized" ? null : parseInt(categoryId);
        }

        // Payment method filter
        if (paymentMethod && paymentMethod !== "all") {
            whereClause.paymentMethod = paymentMethod;
        }

        const expenses = await prisma.expense.findMany({
            where: whereClause,
            orderBy: { date: "desc" },
            include: {
                treasury: {
                    include: { branch: { select: { id: true, name: true } } }
                },
                category: { select: { id: true, name: true } }
            }
        });

        // Enrich each row with branch info
        const rows = expenses.map(e => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: Number(e.amount),
            paymentMethod: e.paymentMethod,
            type: e.type,
            treasuryId: e.treasuryId,
            treasuryName: e.treasury?.name || "-",
            branchId: e.treasury?.branch?.id || null,
            branchName: e.treasury?.branch?.name || "-",
            categoryId: e.categoryId,
            categoryName: e.category?.name || "غير مصنف",
        }));

        const total = rows.reduce((sum, r) => sum + r.amount, 0);

        // Aggregate by category
        const catMap = {};
        for (const r of rows) {
            const key = r.categoryId ?? "uncategorized";
            if (!catMap[key]) {
                catMap[key] = { categoryId: r.categoryId, name: r.categoryName, total: 0, count: 0 };
            }
            catMap[key].total += r.amount;
            catMap[key].count += 1;
        }
        const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total);

        // Aggregate by category × branch
        const catBranchMap = {};
        for (const r of rows) {
            const key = `${r.categoryId ?? "uncategorized"}_${r.branchId ?? "none"}`;
            if (!catBranchMap[key]) {
                catBranchMap[key] = {
                    categoryId: r.categoryId,
                    name: r.categoryName,
                    branchId: r.branchId,
                    branchName: r.branchName,
                    total: 0,
                    count: 0,
                };
            }
            catBranchMap[key].total += r.amount;
            catBranchMap[key].count += 1;
        }
        const byCategoryBranch = Object.values(catBranchMap).sort((a, b) => b.total - a.total);

        res.json({ rows, total, byCategory, byCategoryBranch });
    } catch (error) {
        next(error);
    }
});

// GET all expenses
router.get("/", async (req, res, next) => {
    try {
        const branchFilter = await getUserBranchFilter(req.user.id, req);
        const whereClause = {};

        if (branchFilter) {
            // Find the treasuries associated with these branches
            const branches = await prisma.branch.findMany({
                where: branchFilter,
                select: { treasuryId: true }
            });

            if (branches.length > 0) {
                const treasuryIds = branches.map(b => b.treasuryId).filter(id => id != null);
                whereClause.treasuryId = { in: treasuryIds };
            } else {
                whereClause.treasuryId = -1;
            }
        }

        console.log(`🔍 Fetching expenses with whereClause: ${JSON.stringify(whereClause)} (User ID: ${req.user.id}, Branch Filter: ${JSON.stringify(branchFilter)})`);

        const expenses = await prisma.expense.findMany({
            where: whereClause,
            orderBy: { date: "desc" },
            include: {
                treasury: true,
                category: { select: { id: true, name: true } }
            }
        });

        console.log(`✅ Found ${expenses.length} expenses for whereClause: ${JSON.stringify(whereClause)}`);
        res.json(expenses);
    } catch (error) {
        next(error);
    }
});

// POST create new manual expense
router.post("/", async (req, res, next) => {
    const { description, amount, date, treasuryId, paymentMethod, categoryId } = req.body;

    try {
        if (!amount || !treasuryId || !description) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!categoryId) {
            return res.status(400).json({ error: "يرجى اختيار تصنيف المصروف" });
        }

        const requestingUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { role: true }
        });
        const isManager =
            requestingUser.role.name === "Superadmin" ||
            requestingUser.role.name === "Admin" ||
            requestingUser.role.name === "Manager" ||
            requestingUser.role.name === "Branch Manager" ||
            requestingUser.role.name === "General Manager";

        const result = await prisma.$transaction(async (tx) => {
            // 1. Check treasury balance
            const treasury = await tx.treasury.findUnique({
                where: { id: parseInt(treasuryId) }
            });

            if (!treasury) {
                const err = new Error("Treasury not found");
                err.status = 404;
                throw err;
            }

            if (Number(treasury.balance) < Number(amount)) {
                const err = new Error("Insufficient treasury balance");
                err.status = 400;
                throw err;
            }

            // 2. Find the treasury's branch
            const branch = treasury.branchId ? await tx.branch.findUnique({
                where: { id: treasury.branchId }
            }) : null;

            // 3. Find active shift for this branch (if exists)
            let shiftId = null;
            if (branch) {
                const activeShift = await tx.shift.findFirst({
                    where: {
                        branchId: branch.id,
                        status: { in: ["OPEN", "PENDING_REVIEW"] }
                    },
                    orderBy: { startTime: "desc" }
                });

                if (activeShift) {
                    shiftId = activeShift.id;
                }
            }

            if (!shiftId && !isManager) {
                const err = new Error("لا يمكن إضافة مصروف بدون وردية مفتوحة على نفس الفرع");
                err.status = 400;
                throw err;
            }

            // 4. Deduct from treasury
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: { decrement: Number(amount) }
                }
            });

            // 5. Create Expense
            const expense = await tx.expense.create({
                data: {
                    description,
                    amount: Number(amount),
                    date: new Date(date || new Date()),
                    type: "MANUAL",
                    treasuryId: parseInt(treasuryId),
                    shiftId,
                    categoryId: parseInt(categoryId),
                    paymentMethod: paymentMethod || "CASH"
                }
            });

            return { expense, shiftId };
        });

        res.status(201).json({
            message: "Expense created successfully",
            expenseId: result.expense.id,
            shiftId: result.shiftId
        });
    } catch (error) {
        next(error);
    }
});

// PUT update expense
router.put("/:id", async (req, res, next) => {
    const { id } = req.params;
    const { description, amount, date, treasuryId, paymentMethod, categoryId } = req.body;

    try {
        const existingExpense = await prisma.expense.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingExpense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        if (existingExpense.type !== "MANUAL") {
            return res.status(400).json({ error: "Cannot edit system-generated expenses" });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Refund old amount to old treasury
            await tx.treasury.update({
                where: { id: existingExpense.treasuryId },
                data: {
                    balance: { increment: existingExpense.amount }
                }
            });

            // 2. Check new treasury balance
            const currentTreasury = await tx.treasury.findUnique({
                where: { id: parseInt(treasuryId) }
            });

            if (!currentTreasury) {
                const err = new Error("Target treasury not found");
                err.status = 404;
                throw err;
            }

            if (Number(currentTreasury.balance) < Number(amount)) {
                const err = new Error("Insufficient treasury balance for the new amount");
                err.status = 400;
                throw err;
            }

            // 3. Deduct new amount
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: { decrement: Number(amount) }
                }
            });

            // 4. Update Expense
            const updateData = {
                description,
                amount: Number(amount),
                date: new Date(date),
                treasuryId: parseInt(treasuryId),
                paymentMethod: paymentMethod || "CASH"
            };
            if (categoryId !== undefined) {
                updateData.categoryId = categoryId ? parseInt(categoryId) : null;
            }

            await tx.expense.update({
                where: { id: parseInt(id) },
                data: updateData
            });
        });

        res.json({ message: "Expense updated successfully" });
    } catch (error) {
        next(error);
    }
});

// Delete expense (Manual only)
// STRICT SECURITY: Only users with sensitive access can delete financial records
router.delete("/:id", requireSensitiveAccess, async (req, res, next) => {
    const { id } = req.params;

    try {
        const existingExpense = await prisma.expense.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existingExpense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        if (existingExpense.type === "PURCHASE") {
            return res.status(400).json({ error: "Cannot delete purchase-related expenses" });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Refund amount to treasury
            await tx.treasury.update({
                where: { id: existingExpense.treasuryId },
                data: {
                    balance: {
                        increment: existingExpense.amount,
                    },
                },
            });

            // 2. Delete expense
            await tx.expense.delete({
                where: { id: parseInt(id) },
            });
        });

        res.json({ message: "Expense deleted successfully" });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
