const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
    authenticateToken,
    requirePermission,
    requireAnyPermission,
} = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET all withdrawals
router.get("/", requirePermission("WITHDRAWALS"), async (req, res, next) => {
    try {
        const withdrawals = await prisma.withdrawal.findMany({
            include: {
                treasury: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(withdrawals);
    } catch (error) {
        next(error);
    }
});

// POST Create new withdrawal
router.post("/", requireAnyPermission(["WITHDRAWALS", "CREATES_WITHDRAWALS"]), async (req, res, next) => {
    try {
        const { amount, treasuryId, description, date } = req.body;
        const withdrawalAmount = Number(amount);

        if (!withdrawalAmount || withdrawalAmount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        if (!treasuryId) {
            return res.status(400).json({ error: "Treasury is required" });
        }

        // Use transaction to update balance and create withdrawal record
        const result = await prisma.$transaction(async (tx) => {
            // 1. Verify treasury exists and has sufficient balance
            const treasury = await tx.treasury.findUnique({
                where: { id: parseInt(treasuryId) },
            });

            if (!treasury) {
                throw new Error("Treasury not found");
            }

            if (Number(treasury.balance) < withdrawalAmount) {
                throw new Error("Insufficient treasury balance");
            }

            // 2. Decrease Treasury Balance
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: { balance: { decrement: withdrawalAmount } },
            });

            // 3. Create Withdrawal Record
            const withdrawal = await tx.withdrawal.create({
                data: {
                    amount: withdrawalAmount,
                    description,
                    date: new Date(date),
                    treasuryId: parseInt(treasuryId),
                    createdById: req.user.id
                },
                include: {
                    treasury: true,
                    createdBy: { select: { id: true, name: true } }
                }
            });

            return withdrawal;
        });

        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
