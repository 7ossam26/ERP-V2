const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// Get all expenses
router.get("/", async (req, res) => {
    try {
        const expenses = await prisma.expense.findMany({
            orderBy: {
                date: "desc",
            },
            include: {
                treasury: {
                    select: { name: true },
                },
            },
        });
        res.json(expenses);
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
});

// Get single expense
router.get("/:id", async (req, res) => {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: parseInt(req.params.id) },
        });
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }
        res.json(expense);
    } catch (error) {
        console.error("Error fetching expense:", error);
        res.status(500).json({ error: "Failed to fetch expense" });
    }
});

// Create new expense (Manual only)
router.post("/", async (req, res) => {
    const { description, amount, date, treasuryId, paymentMethod } = req.body;

    try {
        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create expense record
            const expense = await tx.expense.create({
                data: {
                    description,
                    amount,
                    date: new Date(date),
                    treasuryId: parseInt(treasuryId),
                    paymentMethod,
                    type: "MANUAL",
                },
            });

            // 2. Deduct from treasury
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: {
                        decrement: amount,
                    },
                },
            });

            return expense;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error("Error creating expense:", error);
        res.status(500).json({ error: "Failed to create expense" });
    }
});

// Update expense (Manual only)
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { description, amount, date, treasuryId, paymentMethod } = req.body;

    try {
        const existingExpense = await prisma.expense.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existingExpense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        if (existingExpense.type === "PURCHASE") {
            return res.status(400).json({ error: "Cannot edit purchase-related expenses" });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Revert old amount from old treasury
            await tx.treasury.update({
                where: { id: existingExpense.treasuryId },
                data: {
                    balance: {
                        increment: existingExpense.amount,
                    },
                },
            });

            // 2. Update expense
            const updatedExpense = await tx.expense.update({
                where: { id: parseInt(id) },
                data: {
                    description,
                    amount,
                    date: new Date(date),
                    treasuryId: parseInt(treasuryId),
                    paymentMethod,
                },
            });

            // 3. Deduct new amount from new treasury
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: {
                        decrement: amount,
                    },
                },
            });

            return updatedExpense;
        });

        res.json(result);
    } catch (error) {
        console.error("Error updating expense:", error);
        res.status(500).json({ error: "Failed to update expense" });
    }
});

// Delete expense (Manual only)
router.delete("/:id", async (req, res) => {
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
        console.error("Error deleting expense:", error);
        res.status(500).json({ error: "Failed to delete expense" });
    }
});

module.exports = router;
