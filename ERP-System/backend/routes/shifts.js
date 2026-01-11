const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// Start a new shift
router.post("/start", async (req, res) => {
    try {
        const { userId, branchId, startCash } = req.body;

        if (!userId || !branchId) {
            return res.status(400).json({ error: "User ID and Branch ID are required" });
        }

        // Check if user already has an active shift
        const existingShift = await prisma.shift.findFirst({
            where: {
                userId: parseInt(userId),
                status: "OPEN",
            },
        });

        if (existingShift) {
            return res.status(400).json({ error: "User already has an active shift" });
        }

        const newShift = await prisma.shift.create({
            data: {
                userId: parseInt(userId),
                branchId: parseInt(branchId),
                startCash: startCash ? parseFloat(startCash) : 0,
                startTime: new Date(),
                status: "OPEN",
            },
        });

        res.status(201).json(newShift);
    } catch (error) {
        console.error("Error starting shift:", error);
        res.status(500).json({ error: "Failed to start shift" });
    }
});

// End an existing shift
router.post("/end", async (req, res) => {
    try {
        const { shiftId, endCash } = req.body;

        if (!shiftId) {
            return res.status(400).json({ error: "Shift ID is required" });
        }

        const updatedShift = await prisma.shift.update({
            where: { id: parseInt(shiftId) },
            data: {
                endTime: new Date(),
                endCash: endCash ? parseFloat(endCash) : 0,
                status: "CLOSED",
            },
        });

        res.json(updatedShift);
    } catch (error) {
        console.error("Error ending shift:", error);
        res.status(500).json({ error: "Failed to end shift" });
    }
});

// Get active shift for a user
router.get("/active/:userId", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const activeShift = await prisma.shift.findFirst({
            where: {
                userId: userId,
                status: "OPEN",
            },
        });

        if (!activeShift) {
            return res.status(404).json({ message: "No active shift found" });
        }

        res.json(activeShift);
    } catch (error) {
        console.error("Error fetching active shift:", error);
        res.status(500).json({ error: "Failed to fetch active shift" });
    }
});

// Get Shift Report
router.get("/:id/report", async (req, res) => {
    try {
        const shiftId = parseInt(req.params.id);

        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                user: true,
                branch: true,
            },
        });

        if (!shift) {
            return res.status(404).json({ error: "Shift not found" });
        }

        // Aggregate Sales Data
        const sales = await prisma.sale.findMany({
            where: {
                shiftId: shiftId,
                status: "COMPLETED",
            },
            include: {
                items: {
                    include: {
                        item: {
                            include: {
                                categories: {
                                    include: {
                                        category: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Calculate Totals
        let totalSales = 0;
        let cashSales = 0;
        let cardSales = 0;
        const itemsMap = new Map(); // Use map to aggregate items by name/category

        sales.forEach((sale) => {
            totalSales += parseFloat(sale.total);

            const paymentMethod = sale.paymentMethod;
            if (paymentMethod === "CASH") {
                cashSales += parseFloat(sale.total); // Assuming paidAmount covers total for simplicity here otherwise use sale.paidAmount? logic complex
            } else {
                cardSales += parseFloat(sale.total);
            }

            // Aggregate Items
            sale.items.forEach((saleItem) => {
                const itemKey = saleItem.item.name;
                // Determine category (pick first one for simplicity or 'General')
                const categoryName = saleItem.item.categories.length > 0
                    ? saleItem.item.categories[0].category.name
                    : "أخرى";

                if (!itemsMap.has(itemKey)) {
                    itemsMap.set(itemKey, {
                        type: categoryName,
                        name: saleItem.item.name,
                        count: 0,
                        total: 0
                    });
                }

                const existing = itemsMap.get(itemKey);
                existing.count += parseFloat(saleItem.quantity);
                existing.total += parseFloat(saleItem.total);
            });
        });

        const salesDetails = Array.from(itemsMap.values());

        const report = {
            shiftId: shift.id,
            employeeName: shift.user.name,
            shiftName: "Shift #" + shift.id, // Or calculate morning/evening based on startTime
            date: shift.startTime,
            totalSales,
            cashReceived: cashSales,
            cardPayments: cardSales,
            salesDetails: salesDetails
        };

        res.json(report);

    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ error: "Failed to generate report" });
    }
});

module.exports = router;
