const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");

// Protect all routes with SUPPLIER_ACCOUNTS permission
router.use(authenticateToken, requirePermission("SUPPLIER_ACCOUNTS"));

// GET all supplier accounts with balances
router.get("/", async (req, res) => {
    try {
        // Get all suppliers who have made purchases
        const suppliersWithPurchases = await prisma.supplier.findMany({
            where: {
                purchases: {
                    some: {}, // Has at least one purchase
                },
            },
            include: {
                account: {
                    include: {
                        payments: {
                            orderBy: { paymentDate: "desc" },
                            take: 5, // Last 5 payments per supplier
                        },
                    },
                },
            },
        });

        // Transform to match the expected format
        const accounts = suppliersWithPurchases.map((supplier) => {
            if (supplier.account) {
                // Supplier has an account record
                return {
                    id: supplier.account.id,
                    supplierId: supplier.id,
                    balance: supplier.account.balance,
                    createdAt: supplier.account.createdAt,
                    updatedAt: supplier.account.updatedAt,
                    supplier: {
                        id: supplier.id,
                        name: supplier.name,
                        phoneNumber: supplier.phoneNumber,
                        createdAt: supplier.createdAt,
                        updatedAt: supplier.updatedAt,
                    },
                    payments: supplier.account.payments,
                };
            } else {
                // Supplier has no account record (all purchases were paid in full)
                return {
                    id: null,
                    supplierId: supplier.id,
                    balance: 0,
                    createdAt: supplier.createdAt,
                    updatedAt: supplier.updatedAt,
                    supplier: {
                        id: supplier.id,
                        name: supplier.name,
                        phoneNumber: supplier.phoneNumber,
                        createdAt: supplier.createdAt,
                        updatedAt: supplier.updatedAt,
                    },
                    payments: [],
                };
            }
        });

        // Sort by balance (highest debt first)
        accounts.sort((a, b) => Number(b.balance) - Number(a.balance));

        res.json(accounts);
    } catch (error) {
        console.error("Failed to fetch supplier accounts:", error);
        res
            .status(500)
            .json({ error: "Failed to fetch supplier accounts", message: error.message });
    }
});

// GET specific supplier account by supplier ID
router.get("/:supplierId", async (req, res) => {
    try {
        const supplierId = parseInt(req.params.supplierId);

        let account = await prisma.supplierAccount.findUnique({
            where: { supplierId },
            include: {
                supplier: true,
                payments: {
                    orderBy: { paymentDate: "desc" },
                    include: {
                        purchase: true,
                    },
                },
            },
        });

        // If account doesn't exist but supplier does, return a virtual account with 0 balance
        if (!account) {
            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
            });

            if (!supplier) {
                return res.status(404).json({ error: "Supplier not found" });
            }

            account = {
                id: null,
                supplierId,
                balance: 0,
                supplier,
                payments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }

        res.json(account);
    } catch (error) {
        console.error("Failed to fetch supplier account:", error);
        res
            .status(500)
            .json({ error: "Failed to fetch supplier account", message: error.message });
    }
});

// GET payment history for a supplier
router.get("/:supplierId/payments", async (req, res) => {
    try {
        const supplierId = parseInt(req.params.supplierId);

        // Verify supplier exists
        const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId },
        });

        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found" });
        }

        // Get account (might not exist)
        const account = await prisma.supplierAccount.findUnique({
            where: { supplierId },
        });

        if (!account) {
            return res.json([]); // No payments if no account
        }

        const payments = await prisma.supplierPayment.findMany({
            where: { supplierAccountId: account.id },
            orderBy: { paymentDate: "desc" },
            include: {
                purchase: true,
                treasury: true,
            },
        });

        res.json(payments);
    } catch (error) {
        console.error("Failed to fetch payment history:", error);
        res
            .status(500)
            .json({ error: "Failed to fetch payment history", message: error.message });
    }
});

// GET unpaid/partially paid purchases for a supplier
router.get("/:supplierId/purchases", async (req, res) => {
    try {
        const supplierId = parseInt(req.params.supplierId);

        const purchases = await prisma.purchase.findMany({
            where: {
                supplierId,
            },
            orderBy: { createdAt: "desc" },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
                treasury: true,
                warehouse: true,
            },
        });

        res.json(purchases);
    } catch (error) {
        console.error("Failed to fetch unpaid purchases:", error);
        res
            .status(500)
            .json({ error: "Failed to fetch unpaid purchases", message: error.message });
    }
});

// POST make a payment towards supplier debt
router.post("/:supplierId/payments", async (req, res) => {
    try {
        const supplierId = parseInt(req.params.supplierId);
        const { amount, treasuryId, purchaseId, notes } = req.body;

        // Validations
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Valid payment amount is required" });
        }
        if (!treasuryId) {
            return res.status(400).json({ error: "Treasury is required" });
        }

        const result = await prisma.$transaction(async (prisma) => {
            // 1. Verify supplier account exists
            let account = await prisma.supplierAccount.findUnique({
                where: { supplierId },
            });

            if (!account) {
                const err = new Error("Supplier account not found or has no debt");
                err.status = 404;
                throw err;
            }

            // 2. Check if payment amount exceeds balance
            if (Number(amount) > Number(account.balance)) {
                const err = new Error("Payment amount exceeds outstanding balance");
                err.status = 400;
                throw err;
            }

            // 3. Check treasury balance
            const treasury = await prisma.treasury.findUnique({
                where: { id: parseInt(treasuryId) },
            });

            if (!treasury) {
                throw new Error("Treasury not found");
            }

            // Note: For supplier payments, we DEDUCT from treasury (paying the supplier)
            // This is opposite of purchase creation where we receive goods/services
            if (Number(treasury.balance) < Number(amount)) {
                throw new Error("رصيد الخزينة غير كافي (Insufficient treasury balance)");
            }

            // 4. Deduct from treasury
            await prisma.treasury.update({
                where: { id: parseInt(treasuryId) },
                data: {
                    balance: { decrement: Number(amount) },
                },
            });

            // 5. Create payment record
            const payment = await prisma.supplierPayment.create({
                data: {
                    supplierAccountId: account.id,
                    amount: Number(amount),
                    treasuryId: parseInt(treasuryId),
                    purchaseId: purchaseId ? parseInt(purchaseId) : null,
                    notes,
                },
                include: {
                    purchase: true,
                    treasury: true,
                },
            });

            // 6. Update supplier account balance
            await prisma.supplierAccount.update({
                where: { id: account.id },
                data: {
                    balance: { decrement: Number(amount) },
                },
            });

            // 7. Create expense record for this payment
            // Note: We don't link to purchaseId because purchases already have their own expense records
            // and purchaseId has a unique constraint. Supplier payments are separate expense entries.
            await prisma.expense.create({
                data: {
                    description: `Payment to ${account.supplier?.name || "Supplier"}${purchaseId ? ` for Purchase #${purchaseId}` : ""
                        }`,
                    amount: Number(amount),
                    date: new Date(),
                    type: "PURCHASE",
                    treasuryId: parseInt(treasuryId),
                    // purchaseId: null, // Don't link to avoid unique constraint violation
                    paymentMethod: "CASH", // Default to CASH for supplier payments
                },
            });

            // 8. Update purchase payment status
            if (purchaseId) {
                // Specific purchase linked
                const purchase = await prisma.purchase.findUnique({
                    where: { id: parseInt(purchaseId) },
                });

                if (purchase) {
                    const totalPaid = Number(purchase.paidAmount) + Number(amount);
                    const newRemaining = Number(purchase.netTotal) - totalPaid;

                    let newStatus;
                    if (newRemaining <= 0) {
                        newStatus = "PAID";
                    } else if (totalPaid > 0) {
                        newStatus = "PARTIALLY_PAID";
                    } else {
                        newStatus = "UNPAID";
                    }

                    await prisma.purchase.update({
                        where: { id: parseInt(purchaseId) },
                        data: {
                            paidAmount: totalPaid,
                            remaining: Math.max(0, newRemaining),
                            paymentStatus: newStatus,
                        },
                    });
                }
            } else {
                // General payment - distribute to oldest unpaid purchases first
                let remainingPayment = Number(amount);

                // Find all unpaid or partially paid purchases for this supplier
                const unpaidPurchases = await prisma.purchase.findMany({
                    where: {
                        supplierId: supplierId,
                        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] }
                    },
                    orderBy: { createdAt: "asc" } // Oldest first
                });

                for (const purchase of unpaidPurchases) {
                    if (remainingPayment <= 0) break;

                    const purchaseRemaining = Number(purchase.remaining);
                    const paymentForThisPurchase = Math.min(remainingPayment, purchaseRemaining);

                    if (paymentForThisPurchase > 0) {
                        const newPaidAmount = Number(purchase.paidAmount) + paymentForThisPurchase;
                        const newRemaining = Number(purchase.netTotal) - newPaidAmount;

                        let newStatus;
                        // Use small epsilon for float comparison safety or just check if very close to 0
                        if (newRemaining <= 0.01) {
                            newStatus = "PAID";
                        } else {
                            newStatus = "PARTIALLY_PAID";
                        }

                        await prisma.purchase.update({
                            where: { id: purchase.id },
                            data: {
                                paidAmount: newPaidAmount,
                                remaining: Math.max(0, newRemaining),
                                paymentStatus: newStatus
                            }
                        });

                        remainingPayment -= paymentForThisPurchase;
                    }
                }
            }

            return payment;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error("Failed to process payment:", error);
        res
            .status(500)
            .json({ error: "Failed to process payment", message: error.message });
    }
});

module.exports = router;
