const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcrypt");
const { authenticateToken, requireAnyPermission, getUserBranchFilter } = require("../middleware/auth");

// Require authentication for all shift operations
router.use(authenticateToken);

/**
 * Helper: Determine shift type based on current time and system config
 */
async function determineShiftType() {
    try {
        const config = await prisma.systemConfiguration.findUnique({
            where: { id: 1 }
        });

        if (!config) {
            // Fallback defaults if config doesn't exist
            console.warn("⚠️ SystemConfiguration not found, using defaults");
            return {
                type: "MORNING",
                config: {
                    morningShiftStart: "09:00",
                    morningShiftEnd: "17:00",
                    eveningShiftStart: "17:00",
                    eveningShiftEnd: "01:00"
                }
            };
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        // Parse time strings to minutes for accurate comparison
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const morningStart = parseTime(config.morningShiftStart);
        const morningEnd = parseTime(config.morningShiftEnd);
        const eveningStart = parseTime(config.eveningShiftStart);
        const eveningEnd = parseTime(config.eveningShiftEnd);

        // Check if current time is in morning shift
        const isInMorningShift = morningEnd > morningStart
            ? (currentTimeInMinutes >= morningStart && currentTimeInMinutes < morningEnd)
            : false; // Morning shift doesn't cross midnight

        // Check if current time is in evening shift (may cross midnight)
        let isInEveningShift;
        if (eveningEnd < eveningStart) {
            // Overnight shift (e.g., 17:00 to 01:00)
            isInEveningShift = (currentTimeInMinutes >= eveningStart || currentTimeInMinutes < eveningEnd);
        } else {
            isInEveningShift = (currentTimeInMinutes >= eveningStart && currentTimeInMinutes < eveningEnd);
        }

        const type = isInMorningShift ? "MORNING" : "EVENING";

        return { type, config };
    } catch (error) {
        console.error("Error in determineShiftType:", error);
        // Return safe defaults on error
        return {
            type: "MORNING",
            config: {
                morningShiftStart: "09:00",
                morningShiftEnd: "17:00",
                eveningShiftStart: "17:00",
                eveningShiftEnd: "01:00"
            }
        };
    }
}

/**
 * Helper: Calculate system expected cash for a shift
 */
async function calculateSystemExpectedCash(shiftId) {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            sales: {
                where: { status: "COMPLETED" }
            },
            expenses: true
        }
    });

    if (!shift) return 0;

    // Start with opening cash
    let expected = parseFloat(shift.startCash) || 0;

    // Add cash sales only (card sales don't go in drawer)
    shift.sales.forEach(sale => {
        if (sale.paymentMethod === "CASH") {
            expected += parseFloat(sale.paidAmount) || 0;
        }
    });

    // Subtract expenses paid from drawer
    shift.expenses.forEach(expense => {
        if (expense.paymentMethod === "CASH") {
            expected -= parseFloat(expense.amount) || 0;
        }
    });

    // Round to 2 decimal places to avoid floating point issues
    return Math.round(expected * 100) / 100;
}

// Start a new shift
router.post("/start", async (req, res, next) => {
    try {
        const { userId, branchId, startCash } = req.body;

        if (!userId || !branchId) {
            return res.status(400).json({ error: "User ID and Branch ID are required" });
        }

        // Validate Branch Access
        const allowedBranchId = await getUserBranchFilter(req.user.id);
        if (allowedBranchId && allowedBranchId !== parseInt(branchId)) {
            return res.status(403).json({ error: "Access denied. You cannot start a shift in this branch." });
        }

        // Determine shift type based on time
        const { type: shiftType, config } = await determineShiftType();

        // Check for RECENT unclosed shifts (last 48 hours to handle overnight shifts)
        const twoDaysAgo = new Date();
        twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

        const recentUnclosedShift = await prisma.shift.findFirst({
            where: {
                branchId: parseInt(branchId),
                status: { in: ["OPEN", "PENDING_REVIEW"] },
                startTime: {
                    gte: twoDaysAgo
                }
            },
            orderBy: { startTime: "desc" }
        });

        // BLOCKING LOGIC: Any unclosed shift blocks new shift start
        if (recentUnclosedShift) {
            return res.status(400).json({
                error: "Cannot start shift. There is an unclosed shift for this branch.",
                previousShiftStatus: recentUnclosedShift.status,
                previousShiftId: recentUnclosedShift.id,
                message: recentUnclosedShift.status === "PENDING_REVIEW"
                    ? "الوردية السابقة تحتاج موافقة المدير"
                    : "الوردية السابقة لم يتم إغلاقها"
            });
        }

        // Check if user already has an active shift
        const existingUserShift = await prisma.shift.findFirst({
            where: {
                userId: parseInt(userId),
                status: "OPEN",
            },
        });

        if (existingUserShift) {
            return res.status(400).json({ error: "User already has an active shift" });
        }

        // ROLLING BALANCE: Use end cash from most recent closed shift
        let calculatedStartCash = startCash !== undefined ? parseFloat(startCash) : 0;

        const lastClosedShift = await prisma.shift.findFirst({
            where: {
                branchId: parseInt(branchId),
                status: "CLOSED"
            },
            orderBy: { endTime: "desc" }
        });

        if (lastClosedShift && lastClosedShift.endCash !== null) {
            calculatedStartCash = parseFloat(lastClosedShift.endCash);
        }

        const newShift = await prisma.shift.create({
            data: {
                userId: parseInt(userId),
                branchId: parseInt(branchId),
                type: shiftType,
                startCash: calculatedStartCash,
                startTime: new Date(),
                status: "OPEN",
            },
        });

        res.status(201).json(newShift);
    } catch (error) {
        next(error);
    }
});

// End an existing shift (Blind Close)
router.post("/end", async (req, res, next) => {
    try {
        const { shiftId, actualCash } = req.body;

        if (!shiftId) {
            return res.status(400).json({ error: "Shift ID is required" });
        }

        if (actualCash === undefined || actualCash === null) {
            return res.status(400).json({ error: "Actual cash amount is required" });
        }

        // Calculate system expected cash
        const systemExpectedCash = await calculateSystemExpectedCash(parseInt(shiftId));
        const actualCashValue = parseFloat(actualCash);

        // Round to 2 decimals to avoid floating point issues
        const shortage = Math.round((actualCashValue - systemExpectedCash) * 100) / 100;

        // Update shift to PENDING_REVIEW (not CLOSED yet - needs manager approval)
        const updatedShift = await prisma.shift.update({
            where: { id: parseInt(shiftId) },
            data: {
                endTime: new Date(),
                endCash: actualCashValue, // This is what will carry to next shift
                systemExpectedCash: systemExpectedCash,
                actualCash: actualCashValue,
                shortage: shortage,
                status: "PENDING_REVIEW",
            },
        });

        res.json(updatedShift);
    } catch (error) {
        next(error);
    }
});

// Approve/Close a shift (Manager only)
router.post("/approve", async (req, res, next) => {
    try {
        const { shiftId, managerUsername, managerPassword } = req.body;

        if (!shiftId || !managerUsername || !managerPassword) {
            return res.status(400).json({
                error: "Shift ID, manager username, and password are required"
            });
        }

        // Find the shift
        const shift = await prisma.shift.findUnique({
            where: { id: parseInt(shiftId) },
            include: { branch: true }
        });

        if (!shift) {
            return res.status(404).json({ error: "Shift not found" });
        }

        // Validate shift status - must be PENDING_REVIEW
        if (shift.status !== "PENDING_REVIEW") {
            return res.status(400).json({
                error: `Cannot approve shift with status: ${shift.status}`,
                message: shift.status === "CLOSED"
                    ? "هذه الوردية تم إغلاقها بالفعل"
                    : "هذه الوردية لا تحتاج موافقة حالياً"
            });
        }

        // Authenticate the manager
        const manager = await prisma.user.findUnique({
            where: { username: managerUsername },
            include: { role: true }
        });

        if (!manager) {
            return res.status(401).json({ error: "Invalid manager credentials" });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(managerPassword, manager.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid manager credentials" });
        }

        // Verify manager is from same branch
        if (manager.branchId !== shift.branchId) {
            return res.status(403).json({
                error: "Access denied. Manager must be from the same branch."
            });
        }

        // Verify manager has appropriate role (TODO: Add permission check if needed)
        // For now, assuming "Manager" role or Superadmin
        const isAuthorized = manager.role.name === "Superadmin" ||
            manager.role.name === "Manager" ||
            manager.role.name === "Branch Manager";

        if (!isAuthorized) {
            return res.status(403).json({
                error: "Access denied. Only managers can approve shifts."
            });
        }

        // Close the shift
        const closedShift = await prisma.shift.update({
            where: { id: parseInt(shiftId) },
            data: {
                status: "CLOSED",
                reviewedById: manager.id,
                reviewedAt: new Date()
            },
            include: {
                user: true,
                reviewedBy: true,
                branch: true
            }
        });

        res.json(closedShift);
    } catch (error) {
        next(error);
    }
});

// Get active shift for a user
router.get("/active/:userId", async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);

        const activeShift = await prisma.shift.findFirst({
            where: {
                userId: userId,
                status: "OPEN",
            },
        });

        if (!activeShift) {
            return res.json(null);
        }

        res.json(activeShift);
    } catch (error) {
        next(error);
    }
});

// Get pending shift for a branch (for manager review)
router.get("/pending/:branchId", async (req, res, next) => {
    try {
        const branchId = parseInt(req.params.branchId);

        // Validate branch access
        const allowedBranchId = await getUserBranchFilter(req.user.id);
        if (allowedBranchId && allowedBranchId !== branchId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const pendingShift = await prisma.shift.findFirst({
            where: {
                branchId: branchId,
                status: "PENDING_REVIEW",
            },
            include: {
                user: true,
                branch: true
            },
            orderBy: { endTime: "desc" }
        });

        res.json(pendingShift);
    } catch (error) {
        next(error);
    }
});

// Get Shift Report - Requires POS or REPORTS permission
router.get("/:id/report", requireAnyPermission(["POS", "REPORTS"]), async (req, res, next) => {
    try {
        const shiftId = parseInt(req.params.id);

        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                user: true,
                branch: true,
                reviewedBy: true,
                expenses: true
            },
        });

        if (!shift) {
            return res.status(404).json({ error: "Shift not found" });
        }

        // Validate Branch Access for Report
        const allowedBranchId = await getUserBranchFilter(req.user.id);
        if (allowedBranchId && allowedBranchId !== shift.branchId) {
            return res.status(403).json({ error: "Access denied. You cannot view reports for this branch." });
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
        const itemsMap = new Map();

        sales.forEach((sale) => {
            totalSales += parseFloat(sale.total);

            const paymentMethod = sale.paymentMethod;
            if (paymentMethod === "CASH") {
                cashSales += parseFloat(sale.total);
            } else {
                cardSales += parseFloat(sale.total);
            }

            // Aggregate Items
            sale.items.forEach((saleItem) => {
                const itemKey = saleItem.item.name;
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

        // Calculate expenses
        let totalExpenses = 0;
        shift.expenses.forEach(expense => {
            totalExpenses += parseFloat(expense.amount);
        });

        const report = {
            shiftId: shift.id,
            shiftType: shift.type,
            employeeName: shift.user.name,
            shiftName: shift.type === "MORNING" ? "وردية صباحية" : "وردية مسائية",
            date: shift.startTime,
            startTime: shift.startTime,
            endTime: shift.endTime,
            status: shift.status,

            // Cash tracking
            startCash: parseFloat(shift.startCash) || 0,
            endCash: parseFloat(shift.endCash) || 0,
            systemExpectedCash: parseFloat(shift.systemExpectedCash) || 0,
            actualCash: parseFloat(shift.actualCash) || 0,
            shortage: parseFloat(shift.shortage) || 0,

            // Sales
            totalSales,
            cashReceived: cashSales,
            cardPayments: cardSales,
            salesDetails: salesDetails,

            // Expenses
            totalExpenses,
            expenses: shift.expenses.map(e => ({
                description: e.description,
                amount: parseFloat(e.amount),
                paymentMethod: e.paymentMethod
            })),

            // Review info
            reviewedBy: shift.reviewedBy ? shift.reviewedBy.name : null,
            reviewedAt: shift.reviewedAt
        };

        res.json(report);

    } catch (error) {
        next(error);
    }
});

module.exports = router;

