const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
    authenticateToken,
    requirePermission,
    requireCreatePermission,
} = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET all deposits
router.get("/", requirePermission("DEPOSITS"), async (req, res) => {
    try {
        const deposits = await prisma.deposit.findMany({
            include: {
                treasury: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(deposits);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch deposits", message: error.message });
    }
});

// POST Create new deposit
router.post("/", requireCreatePermission("CREATES_DEPOSITS"), async (req, res) => {
    try {
        const { amount, treasuryId, description, date } = req.body;
        const depositAmount = Number(amount);

        if (!depositAmount || depositAmount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        if (!treasuryId) {
            return res.status(400).json({ error: "Treasury is required" });
        }

        // Use transaction to update balance and create deposit record
        const result = await prisma.$transaction(async (tx) => {
            // 1. Verify treasury exists
            const treasury = await tx.treasury.findUnique({
                where: { id: parseInt(treasuryId) },
            });

            if (!treasury) {
                throw new Error("Treasury not found");
            }

            // 2. Increase Treasury Balance
            await tx.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: { balance: { increment: depositAmount } },
            });

            // 3. Create Deposit Record
            const deposit = await tx.deposit.create({
                data: {
                    amount: depositAmount,
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

            return deposit;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error("Deposit Error:", error);
        res.status(400).json({ error: error.message || "Failed to create deposit" });
    }
});

module.exports = router;
