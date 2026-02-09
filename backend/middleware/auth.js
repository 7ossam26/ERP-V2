const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({
      error: "Access denied. No token provided.",
      resolution: "Please log in to access this resource."
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback_secret_key_change_me",
    (err, user) => {
      if (err) {
        return res.status(401).json({
          error: "Invalid or expired token.",
          resolution: "Please log out and log back in to refresh your session."
        });
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
      .json({
        error: "Access denied. Superadmin privileges required.",
        resolution: "This action is restricted to superadmin users only. Contact your system administrator."
      });
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
        return res.status(404).json({
          error: "User not found",
          resolution: "Your account may have been removed. Please contact your administrator."
        });
      }

      // Check if user has permission for the module
      const hasPermission = user.role.permissions.some(
        (perm) => perm.module === module && perm.canAccess === true
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied. ${module} module permission required.`,
          resolution: `Please contact your administrator to request access to the ${module} module.`
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
      if (req.user.role === "Superadmin" || req.user.role === "Admin") return next();

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
          resolution: `Contact your administrator to request access to one of these modules: ${modules.join(", ")}.`
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
          resolution: `Contact your administrator to request ${createModule} permission.`
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
  // Superadmin and Admin always have sensitive access
  if (req.user.role === "Superadmin" || req.user.role === "Admin") {
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
        resolution: "Update and delete operations are restricted. Contact your administrator to enable sensitive access for your account."
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
        role: true, // Include role to check name
        accessibleBranches: {
          select: { id: true }
        }
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Superadmin OR Admin sees ALL (return null)
    if (user.role && (user.role.name === "Superadmin" || user.role.name === "Admin")) {
      return null;
    }

    // Collect all allowed branch IDs
    const allowedBranchIds = [];
    if (user.branchId) allowedBranchIds.push(user.branchId);
    if (user.accessibleBranches && user.accessibleBranches.length > 0) {
      user.accessibleBranches.forEach(b => allowedBranchIds.push(b.id));
    }

    // Remove duplicates
    const uniqueIds = [...new Set(allowedBranchIds)];

    // If user has no access to any branch
    if (uniqueIds.length === 0) {
      return { id: 0 }; // Impossible ID, effectively returns empty list
    }

    // If only one branch, return simple filter
    if (uniqueIds.length === 1) {
      return { id: uniqueIds[0] };
    }

    // Return IN filter for multiple branches
    return { id: { in: uniqueIds } };
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
