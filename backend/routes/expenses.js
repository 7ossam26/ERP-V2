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
                // User has branch access but no branches found (shouldn't happen technically due to auth middleware but good for safety)
                // or branches have no treasuries
                // Make sure we return nothing if we can't find relevant treasuries
                whereClause.treasuryId = -1;
            }
        }

        console.log(`🔍 Fetching expenses with whereClause: ${JSON.stringify(whereClause)} (User ID: ${req.user.id}, Branch Filter: ${JSON.stringify(branchFilter)})`);

        const expenses = await prisma.expense.findMany({
            where: whereClause,
            orderBy: { date: "desc" },
            include: {
                treasury: true
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
    const { description, amount, date, treasuryId, paymentMethod } = req.body;

    try {
        if (!amount || !treasuryId || !description) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        await prisma.$transaction(async (tx) => {
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

            // 4. Deduct from treasury
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: { decrement: Number(amount) }
                }
            });

            // 5. Create Expense (with shift link if found)
            await tx.expense.create({
                data: {
                    description,
                    amount: Number(amount),
                    date: new Date(date || new Date()),
                    type: "MANUAL",
                    treasuryId: parseInt(treasuryId),
                    shiftId: shiftId, // Link to shift if found
                    paymentMethod: paymentMethod || "CASH"
                }
            });
        });

        res.status(201).json({ message: "Expense created successfully" });
    } catch (error) {
        next(error);
    }
});

// PUT update expense
router.put("/:id", async (req, res, next) => {
    const { id } = req.params;
    const { description, amount, date, treasuryId, paymentMethod } = req.body;

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
            await tx.expense.update({
                where: { id: parseInt(id) },
                data: {
                    description,
                    amount: Number(amount),
                    date: new Date(date),
                    treasuryId: parseInt(treasuryId),
                    paymentMethod: paymentMethod || "CASH"
                }
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
