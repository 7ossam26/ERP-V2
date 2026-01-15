const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireSensitiveAccess } = require("../middleware/auth");

// Protect all routes with EXPENSES permission
router.use(authenticateToken, requirePermission("EXPENSES"));

// GET all expenses
router.get("/", async (req, res, next) => {
    try {
        const expenses = await prisma.expense.findMany({
            orderBy: { date: "desc" },
            include: {
                treasury: true
            }
        });
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
                throw new Error("Treasury not found");
            }

            if (Number(treasury.balance) < Number(amount)) {
                throw new Error("Insufficient treasury balance");
            }

            // 2. Deduct from treasury
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: { decrement: Number(amount) }
                }
            });

            // 3. Create Expense
            await tx.expense.create({
                data: {
                    description,
                    amount: Number(amount),
                    date: new Date(date || new Date()),
                    type: "MANUAL",
                    treasuryId: parseInt(treasuryId),
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
                throw new Error("Target treasury not found");
            }

            if (Number(currentTreasury.balance) < Number(amount)) {
                throw new Error("Insufficient treasury balance for the new amount");
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
