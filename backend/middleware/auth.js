const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../config/database");
const { isGlobalRole, isAdminRole, isReturnApprovalRole } = require("../config/roles");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({
      error: "Access denied. No token provided.",
      resolution: "Please log in to access this resource."
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret_key_change_me"
    );

    // Verify user still exists in DB (handles DB reset / deleted users)
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true },
    });

    if (!userExists) {
      return res.status(401).json({
        error: "User no longer exists.",
        resolution: "Please log out and log back in."
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: "Invalid or expired token.",
      resolution: "Please log out and log back in to refresh your session."
    });
  }
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
      // Superadmin and Admin have all permissions
      if (isAdminRole(req.user.role)) {
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
      if (isAdminRole(req.user.role)) return next();

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
      // Superadmin and Admin have all permissions
      if (isAdminRole(req.user.role)) {
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
  if (isAdminRole(req.user.role)) {
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

/**
 * Verifies a second-factor manager approval supplied in a request body.
 *
 * This is a real check, not a presence check: it compares the password hash
 * and then confirms the *approver* is eligible to approve. Callers that only
 * validated `managerUsername`/`managerPassword` were non-empty (the refund and
 * purchase-return endpoints) accepted any string, so the approval step was
 * decorative.
 *
 * Eligibility requires ALL of:
 *   1. A real, active account (bcrypt-verified password).
 *   2. Role NAME in the hard RETURN_APPROVAL_ROLES allowlist (Superadmin,
 *      Admin, General Manager, Manager) — not just "any role someone granted
 *      the permission to". This is deliberately a hardcoded list, not reused
 *      from the permission framework: it is the literal business rule ("only
 *      these four roles may ever approve a return"), independent of whatever
 *      module toggles a Superadmin flips in the permission UI.
 *   3. The role also explicitly holds `requiredModule` (SALES_RETURNS /
 *      PURCHASE_RETURNS) with canAccess=true — no isAdminRole bypass. The seed
 *      grants this explicitly to all four allowlisted roles, so a correctly
 *      seeded Superadmin/Admin already satisfies this; if a Superadmin later
 *      revokes the module from a role via PermissionConfig, that role stops
 *      being able to approve even though its name is still on the allowlist.
 *
 * Throws an Error carrying `.status` (400/401/403). middleware/errorHandler.js
 * honours that status and returns `{ error: <English>, message: <Arabic> }`,
 * matching the convention the POS toasts already read.
 *
 * @param {string} username       manager's username, from the request body
 * @param {string} password       manager's plaintext password, from the request body
 * @param {string} requiredModule permission module the approver must hold
 */
const verifyManagerApproval = async (username, password, requiredModule) => {
  const fail = (status, english, arabic) => {
    const err = new Error(arabic); // surfaced to the user as `message`
    err.status = status;
    err.error = english; // machine-readable identifier
    return err;
  };

  if (!username || !password) {
    throw fail(400, "Manager authentication is required", "بيانات المدير مطلوبة");
  }

  const manager = await prisma.user.findUnique({
    where: { username },
    include: { role: { include: { permissions: true } } },
  });

  // Identical response for unknown user and wrong password — do not let a
  // terminal operator probe the modal to discover which usernames exist.
  const invalidCredentials = () =>
    fail(
      401,
      "Invalid manager credentials",
      "اسم المستخدم أو كلمة مرور المدير غير صحيحة",
    );

  if (!manager || !manager.isActive) throw invalidCredentials();

  const passwordValid = await bcrypt.compare(password, manager.password);
  if (!passwordValid) throw invalidCredentials();

  const roleName = manager.role?.name;
  const roleAllowed = isReturnApprovalRole(roleName);
  const hasRequiredPermission = (manager.role?.permissions || []).some(
    (perm) => perm.module === requiredModule && perm.canAccess === true,
  );

  if (!roleAllowed || !hasRequiredPermission) {
    throw fail(
      403,
      "Approver lacks permission to authorize this operation",
      "ليس لديك صلاحية اعتماد المرتجع",
    );
  }

  return { id: manager.id, username: manager.username, role: roleName };
};

/**
 * Resolves the branch (and therefore the warehouse/treasury) that a WRITE
 * operation must execute against. Use this instead of trusting a client-sent
 * `warehouseId` — an employee should never be able to name the warehouse a
 * sale or wholesale order posts against.
 *
 * Employees are assigned to exactly one branch, so for a non-global role the
 * answer is always their own `branchId`. An `X-Active-Branch-Id` header naming
 * a branch they are not assigned to is a hard 403, not a silent fallback:
 * quietly redirecting a write to a different branch than the operator believes
 * they are in would misattribute stock and cash with no signal. (Contrast
 * `getUserBranchFilter` below, which is read-side and *does* fall back — an
 * over-broad list filter is harmless where a mis-posted write is not.)
 *
 * Global roles (Superadmin/Admin/General Manager/Call Center) legitimately move
 * between branches via BranchSwitcher, so their header is honoured as-is.
 *
 * @returns {{id:number, warehouseId:number, treasuryId:number, name:string}|null}
 *   null only when a global role has selected no specific branch ("All
 *   Branches") — callers that need a concrete warehouse must treat that as an
 *   error, since there is no single right answer.
 */
const resolveOperatingBranch = async (userId, req = null) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, accessibleBranches: { select: { id: true } } },
  });

  if (!user) {
    const err = new Error("User not found");
    err.status = 401;
    throw err;
  }

  const userIsGlobal = user.role && isGlobalRole(user.role.name);

  const headerRaw = req && req.headers && req.headers["x-active-branch-id"];
  const headerBranchId = headerRaw ? parseInt(headerRaw, 10) : NaN;
  const hasHeader = Number.isInteger(headerBranchId) && headerBranchId > 0;

  let targetBranchId;

  if (userIsGlobal) {
    // No header (or "All Branches") — no single branch to resolve.
    if (!hasHeader) return null;
    targetBranchId = headerBranchId;
  } else {
    const allowedIds = new Set();
    if (user.branchId) allowedIds.add(user.branchId);
    (user.accessibleBranches || []).forEach((b) => allowedIds.add(b.id));

    if (allowedIds.size === 0) {
      const err = new Error("You are not assigned to any branch.");
      err.status = 400;
      err.error = "No branch assigned";
      throw err;
    }

    if (hasHeader && !allowedIds.has(headerBranchId)) {
      const err = new Error("لا يمكنك العمل على هذا الفرع");
      err.status = 403;
      err.error = "Access denied. You cannot operate in this branch.";
      throw err;
    }

    // Default to the user's own assigned branch.
    targetBranchId = hasHeader ? headerBranchId : user.branchId || [...allowedIds][0];
  }

  const branch = await prisma.branch.findUnique({
    where: { id: targetBranchId },
    select: { id: true, name: true, warehouseId: true, treasuryId: true, isActive: true },
  });

  if (!branch || !branch.isActive) {
    const err = new Error("الفرع غير موجود");
    err.status = 404;
    err.error = "Branch not found";
    throw err;
  }

  return {
    id: branch.id,
    name: branch.name,
    warehouseId: branch.warehouseId,
    treasuryId: branch.treasuryId,
  };
};

// Get branch filter for queries (returns null if user can see all branches)
// If req is provided, checks X-Active-Branch-Id header to filter to a single branch
const getUserBranchFilter = async (userId, req = null) => {
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
      const err = new Error("User not found");
      err.status = 401;
      throw err;
    }

    const userIsGlobal = user.role && isGlobalRole(user.role.name);

    // Collect all allowed branch IDs (for non-global roles)
    const allowedBranchIds = [];
    if (!userIsGlobal) {
      if (user.branchId) allowedBranchIds.push(user.branchId);
      if (user.accessibleBranches && user.accessibleBranches.length > 0) {
        user.accessibleBranches.forEach(b => allowedBranchIds.push(b.id));
      }
    }
    const uniqueIds = [...new Set(allowedBranchIds)];

    // Check for active branch header
    const activeBranchHeader = req && req.headers && req.headers["x-active-branch-id"];
    if (activeBranchHeader) {
      const activeBranchId = parseInt(activeBranchHeader, 10);
      if (!isNaN(activeBranchId) && activeBranchId > 0) {
        // Global roles can filter to any branch
        if (userIsGlobal) {
          return { id: activeBranchId };
        }
        // Non-global roles: validate the branch is in their allowed list
        if (uniqueIds.includes(activeBranchId)) {
          return { id: activeBranchId };
        }
        // If not allowed, fall through to default behavior
      }
    }

    // No active branch header — use default behavior
    if (userIsGlobal) {
      return null; // See all branches
    }

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
  verifyManagerApproval,
  resolveOperatingBranch,
  getUserBranchFilter,
};
