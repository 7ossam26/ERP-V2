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

        // Validate branch access - check role and accessible branches
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                role: true,
                accessibleBranches: {
                    select: { id: true },
                },
            },
        });

        // Check if user has access to this branch
        const canAccessBranch =
            user.branchId === branchId ||
            (user.accessibleBranches &&
                user.accessibleBranches.some((b) => b.id === branchId)) ||
            user.role.name === "Superadmin" ||
            user.role.name === "General Manager";

        if (!canAccessBranch) {
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

/**
 * Get all managers/admins across all branches
 * Used by non-branch contexts (e.g. purchase returns)
 */
router.get("/all-managers", async (req, res, next) => {
    try {
        const managers = await prisma.user.findMany({
            where: {
                isActive: true,
                role: {
                    name: {
                        in: ["Superadmin", "General Manager", "Manager", "Branch Manager"]
                    }
                }
            },
            select: {
                id: true,
                name: true,
                username: true,
                role: {
                    select: { name: true }
                }
            },
            orderBy: { name: "asc" }
        });
        res.json(managers);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
