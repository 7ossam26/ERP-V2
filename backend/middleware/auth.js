const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback_secret_key_change_me",
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid or expired token." });
      }
      req.user = user;
      next();
    }
  );
};

const isSuperadmin = (req, res, next) => {
  if (!req.user || req.user.role !== "Superadmin") {
    return res
      .status(403)
      .json({ error: "Access denied. Superadmin privileges required." });
  }
  next();
};

// Check if user has permission to access a specific module
const requirePermission = (module) => {
  return async (req, res, next) => {
    try {
      // Superadmin has all permissions
      if (req.user.role === "Superadmin") {
        return next();
      }

      // Fetch user's role permissions
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has permission for the module
      const hasPermission = user.role.permissions.some(
        (perm) => perm.module === module && perm.canAccess === true
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied. ${module} module permission required.`,
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
};

// Check if user has permission for ANY of the provided modules (OR logic)
const requireAnyPermission = (modules) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === "Superadmin") return next();

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { role: { include: { permissions: true } } },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      const hasPermission = user.role.permissions.some(
        (perm) => modules.includes(perm.module) && perm.canAccess === true
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied. One of the following permissions is required: ${modules.join(
            ", "
          )}`,
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
};

// Check if user has permission to create a specific item type
const requireCreatePermission = (createModule) => {
  return async (req, res, next) => {
    try {
      // Superadmin has all permissions
      if (req.user.role === "Superadmin") {
        return next();
      }

      // Fetch user's role permissions
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has create permission for the module
      const hasPermission = user.role.permissions.some(
        (perm) => perm.module === createModule && perm.canAccess === true
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied. ${createModule} permission required to create this item.`,
        });
      }

      next();
    } catch (error) {
      console.error("Create permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
};

// Check if user has sensitive access (for update/delete operations)
const requireSensitiveAccess = async (req, res, next) => {
  // Superadmin always has sensitive access
  if (req.user.role === "Superadmin") {
    return next();
  }

  try {
    // Check if user has sensitive access flag from DB (source of truth)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { hasSensitiveAccess: true }
    });

    if (!user || !user.hasSensitiveAccess) {
      return res.status(403).json({
        error: "Access denied. This operation requires sensitive access permissions.",
      });
    }

    next();
  } catch (error) {
    console.error("Sensitive access check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get branch filter for queries (returns null if user can see all branches)
const getUserBranchFilter = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: true,
        role: true, // Include role to check name
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Superadmin sees ALL (return null)
    if (user.role && user.role.name === "Superadmin") {
      return null;
    }

    // If user is assigned to "All Branches", return null (no filter)
    if (user.branch.isAllBranches === true) {
      return null;
    }

    // Otherwise, return the branch ID to filter by
    return user.branchId;
  } catch (error) {
    console.error("Branch filter error:", error);
    throw error;
  }
};

module.exports = {
  authenticateToken,
  isSuperadmin,
  requirePermission,
  requireAnyPermission,
  requireCreatePermission,
  requireSensitiveAccess,
  getUserBranchFilter,
};
