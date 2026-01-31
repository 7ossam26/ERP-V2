const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, getUserBranchFilter } = require("../middleware/auth");

// Require authentication for all user operations
router.use(authenticateToken);

/**
 * Get managers for a specific branch
 * Used by POS to show manager selection for shift approval
 */
router.get("/branch-managers/:branchId", async (req, res, next) => {
    try {
        const branchId = parseInt(req.params.branchId);

        // Validate branch access
        const allowedBranchId = await getUserBranchFilter(req.user.id);
        if (allowedBranchId && allowedBranchId !== branchId) {
            return res.status(403).json({ error: "Access denied" });
        }

        // Find users in the branch with Manager-level roles
        const managers = await prisma.user.findMany({
            where: {
                branchId: branchId,
                isActive: true,
                role: {
                    name: {
                        in: ["Superadmin", "Manager", "Branch Manager"]
                    }
                }
            },
            select: {
                id: true,
                name: true,
                username: true,
                role: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                name: "asc"
            }
        });

        res.json(managers);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
