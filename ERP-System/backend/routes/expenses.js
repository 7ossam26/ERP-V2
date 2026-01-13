const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, isSuperadmin } = require("../middleware/auth");

// Protect all routes with EXPENSES permission
router.use(authenticateToken, requirePermission("EXPENSES"));

// ... (GET and POST routes remain the same) ...

// Delete expense (Manual only)
// STRICT SECURITY: Only Superadmin can delete sensitive financial records
router.delete("/:id", isSuperadmin, async (req, res) => {
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
