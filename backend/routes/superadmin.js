const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const { authenticateToken, isSuperadmin } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");
const { isValidModule } = require("../config/modules");
const { isGlobalRole, isAdminRole, defaultsToSensitiveAccess } = require("../config/roles");

// Middleware to ensure all routes here are protected and for superadmin only
router.use(authenticateToken, isSuperadmin);

// ============================================
// User Management
// ============================================

// GET all users
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        isActive: true,
        hasSensitiveAccess: true,
        roleId: true,
        branchId: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        accessibleBranches: {
          select: {
            id: true,
            name: true
          }
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch users", details: error.message });
  }
});

// POST create user
const createUserValidation = [
  body("name").trim().escape(),
  body("username").trim().escape(),
  body("password")
    .isLength({ min: 4 })
    .withMessage("Password must be at least 4 characters"),
];

router.post("/users", createUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }


    const { name, username, password, roleId, branchId, accessibleBranchIds } = req.body;

    // Get role to determine permissions and validation
    const role = await prisma.role.findUnique({
      where: { id: parseInt(roleId) },
    });

    if (!role) {
      return res.status(400).json({ error: "Invalid role selected" });
    }

    const roleIsGlobal = isGlobalRole(role.name);

    if (!roleIsGlobal && !branchId) {
      return res.status(400).json({ error: "Branch is required for this role" });
    }

    // Check if username exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine hasSensitiveAccess value
    let hasSensitiveAccess =
      req.body.hasSensitiveAccess !== undefined
        ? req.body.hasSensitiveAccess
        : defaultsToSensitiveAccess(role.name);

    // Prepare accessible branches connect
    const accessibleBranchesConnect =
      Array.isArray(accessibleBranchIds) && accessibleBranchIds.length > 0
        ? accessibleBranchIds.map(id => ({ id: parseInt(id) }))
        : [];

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        roleId: parseInt(roleId),
        branchId: branchId ? parseInt(branchId) : null,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        hasSensitiveAccess: hasSensitiveAccess,
        accessibleBranches: {
          connect: accessibleBranchesConnect
        }
      },
      include: {
        role: true,
        accessibleBranches: true
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create user", details: error.message });
  }
});

// PUT update user
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, roleId, branchId, password, accessibleBranchIds } = req.body;

    // Get role information if it's being updated or checking current role
    let roleToCheckId = roleId;
    if (!roleToCheckId) {
      const user = await prisma.user.findUnique({ where: { id: parseInt(id) }, select: { roleId: true } });
      if (user) roleToCheckId = user.roleId;
    }

    const role = await prisma.role.findUnique({
      where: { id: parseInt(roleToCheckId) }
    });

    const roleIsGlobal = isGlobalRole(role?.name);

    // Validate Branch requirement
    if (!branchId && !roleIsGlobal && roleId) { // Only enforce if role is explicitly being set/checked
      // If branchId is not provided, we need to check if it's an update where branch is optional or not.
      // But for simplicity, if role is changing to a non-global one, branch is required.
      return res.status(400).json({ error: "Branch is required for this role" });
    }

    const data = {
      name,
      username,
      roleId: roleId ? parseInt(roleId) : undefined,
      // If global role, allow branchId to be null. If not global, strict parse.
      // If branchId is explicitly passed as null/empty string and it's a global role, we should set it to null in DB.
      // If it's undefined (not passed), we leave it alone (handled by delete undefined keys).
      branchId: branchId ? parseInt(branchId) : (roleIsGlobal && branchId !== undefined ? null : undefined),
      isActive: req.body.isActive !== undefined ? req.body.isActive : undefined,
      hasSensitiveAccess:
        req.body.hasSensitiveAccess !== undefined
          ? req.body.hasSensitiveAccess
          : undefined,
    };

    // Remove undefined keys
    Object.keys(data).forEach(
      (key) => data[key] === undefined && delete data[key]
    );

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    // Handle accessible branches update if provided
    if (accessibleBranchIds !== undefined) {
      const branchesToConnect = Array.isArray(accessibleBranchIds)
        ? accessibleBranchIds.map(bid => ({ id: parseInt(bid) }))
        : [];

      data.accessibleBranches = {
        set: branchesToConnect // Replace existing with new list
      };
    }

    // Prevent deactivating self
    if (req.body.isActive === false && parseInt(id) === req.user.id) {
      return res
        .status(400)
        .json({ error: "Cannot deactivate your own account" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      include: { accessibleBranches: true } // Include in response
    });

    res.json(updatedUser);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update user", details: error.message });
  }
});

// PATCH toggle user status
router.patch("/users/:id/toggle-status", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deactivating self
    if (user.id === req.user.id) {
      return res
        .status(400)
        .json({ error: "Cannot deactivate your own account" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: !user.isActive },
    });

    res.json(updatedUser);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update user status", details: error.message });
  }
});

// DELETE user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: "Cannot delete this user because they have associated records (sales, transfers, etc.). Please deactivate the user instead." 
      });
    }
    res
      .status(500)
      .json({ error: "Failed to delete user", details: error.message });
  }
});

// POST reset password
router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to reset password", details: error.message });
  }
});

// ============================================
// Role Management
// ============================================

// GET all roles
router.get("/roles", async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
    res.json(roles);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch roles", details: error.message });
  }
});

// POST create role
router.post("/roles", async (req, res) => {
  try {
    const { name, description } = req.body;
    const role = await prisma.role.create({
      data: { name, description },
    });
    res.status(201).json(role);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create role", details: error.message });
  }
});

// GET single role
router.get("/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({
      where: { id: parseInt(id) },
    });
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json(role);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch role", details: error.message });
  }
});

// DELETE role
router.delete("/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role has any users
    const roleWithUsers = await prisma.role.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!roleWithUsers) {
      return res.status(404).json({ error: "Role not found" });
    }

    if (roleWithUsers._count.users > 0) {
      return res.status(400).json({
        error: `Cannot delete role. ${roleWithUsers._count.users} user(s) are assigned to this role.`,
      });
    }

    await prisma.role.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete role", details: error.message });
  }
});

// ============================================
// Permission Management
// ============================================

// GET permissions for a role
router.get("/roles/:id/permissions", async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = await prisma.permission.findMany({
      where: { roleId: parseInt(id) },
    });
    res.json(permissions);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch permissions", details: error.message });
  }
});

// PUT update permissions for a role
router.put("/roles/:id/permissions", async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      return res.status(400).json({ error: "Invalid role id" });
    }

    // permissions is an array of { module, canAccess }
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ error: "`permissions` must be an array of { module, canAccess }" });
    }

    // Validate every module against the canonical registry BEFORE touching the
    // DB. Previously an unknown module value (e.g. one missing from the DB enum)
    // made the whole $transaction throw a 500 — a single bad value blocked every
    // permission save. Now we reject it up front with a clear, actionable 400.
    const invalidModules = [
      ...new Set(
        permissions
          .map((p) => p && p.module)
          .filter((m) => !isValidModule(m))
      ),
    ];
    if (invalidModules.length > 0) {
      return res.status(400).json({
        error: "Unknown permission module(s)",
        details: `These module codes are not recognized: ${invalidModules.join(", ")}`,
        invalidModules,
      });
    }

    // Ensure the role exists so we return a clean 404 instead of an FK 500.
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    const transaction = permissions.map((perm) => {
      const canAccess = Boolean(perm.canAccess); // coerce — never reject a valid save
      return prisma.permission.upsert({
        where: {
          roleId_module: {
            roleId: roleId,
            module: perm.module,
          },
        },
        update: {
          canAccess,
        },
        create: {
          roleId: roleId,
          module: perm.module,
          canAccess,
        },
      });
    });

    await prisma.$transaction(transaction);
    res.json({ message: "Permissions updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update permissions", details: error.message });
  }
});

// ============================================
// Database Reset
// ============================================

// Helper: verify manager credentials before any reset
async function verifyManager(managerUsername, managerPassword) {
  if (!managerUsername || !managerPassword) {
    const err = new Error("Manager credentials are required");
    err.status = 400;
    throw err;
  }
  const manager = await prisma.user.findUnique({
    where: { username: managerUsername },
    include: { role: { select: { name: true } } },
  });
  if (!manager || !manager.isActive) {
    const err = new Error("Invalid manager credentials");
    err.status = 401;
    throw err;
  }
  const valid = await bcrypt.compare(managerPassword, manager.password);
  if (!valid) {
    const err = new Error("Invalid manager credentials");
    err.status = 401;
    throw err;
  }
  const roleName = manager.role?.name;
  const hasSensitive =
    manager.hasSensitiveAccess ||
    isAdminRole(roleName);
  if (!hasSensitive) {
    const err = new Error("Manager does not have sufficient access for this operation");
    err.status = 403;
    throw err;
  }
}

router.post("/reset/:category", async (req, res) => {
  const { category } = req.params;
  const { managerUsername, managerPassword } = req.body;

  try {
    await verifyManager(managerUsername, managerPassword);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  try {
    switch (category) {
      case "all-transactions":
        await prisma.$transaction([
          // Sales & purchases (Order rows cascade via Sale.id onDelete:Cascade)
          prisma.saleItem.deleteMany({}),
          prisma.sale.deleteMany({}),
          prisma.purchaseReturnItem.deleteMany({}),
          prisma.purchaseReturn.deleteMany({}),
          prisma.purchaseItem.deleteMany({}),
          prisma.purchase.deleteMany({}),
          // Inventory & production (ProductionOrderItem cascades with ProductionOrder)
          prisma.stockTransferItem.deleteMany({}),
          prisma.stockTransfer.deleteMany({}),
          prisma.productionOrder.deleteMany({}),
          // HR & payroll
          prisma.payroll.deleteMany({}),
          prisma.employeeTransaction.deleteMany({}),
          // Treasury & cash
          prisma.expense.deleteMany({}),
          prisma.shift.deleteMany({}),
          prisma.cashTransfer.deleteMany({}),
          prisma.deposit.deleteMany({}),
          prisma.withdrawal.deleteMany({}),
          prisma.deliveryManTransaction.deleteMany({}),
          prisma.supplierPayment.deleteMany({}),
          // Bulk POS (B2B) — refunds & payments before orders (onDelete: Restrict)
          prisma.bulkRefund.deleteMany({}),
          prisma.bulkPayment.deleteMany({}),
          prisma.bulkOrder.deleteMany({}),      // BulkOrderItem + BulkDocument cascade
          // System
          prisma.notification.deleteMany({}),
          prisma.initialInventory.deleteMany({}),
          // Reset balances & sequence counters
          prisma.treasury.updateMany({ data: { balance: 0 } }),
          prisma.supplierAccount.updateMany({ data: { balance: 0 } }),
          prisma.deliveryMan.updateMany({ data: { walletBalance: 0 } }),
          prisma.inventory.updateMany({ data: { quantity: 0 } }),
          prisma.bulkNumberSequence.updateMany({ data: { nextValue: 1 } }),
        ]);
        break;

      case "sales":
        await prisma.$transaction([
          prisma.saleItem.deleteMany({}),
          prisma.sale.deleteMany({}),
        ]);
        break;

      case "purchases":
        await prisma.$transaction([
          prisma.purchaseReturnItem.deleteMany({}),
          prisma.purchaseReturn.deleteMany({}),
          prisma.purchaseItem.deleteMany({}),
          prisma.purchase.deleteMany({}),
        ]);
        break;

      case "treasury":
        await prisma.$transaction([
          prisma.expense.deleteMany({}),
          prisma.cashTransfer.deleteMany({}),
          prisma.deposit.deleteMany({}),
          prisma.withdrawal.deleteMany({}),
          // Reset treasury balances
          prisma.treasury.updateMany({ data: { balance: 0 } }),
        ]);
        break;

      case "cash-transfers":
        await prisma.cashTransfer.deleteMany({});
        break;

      case "deposits":
        await prisma.deposit.deleteMany({});
        break;

      case "inventory-movements":
        await prisma.$transaction([
          prisma.stockTransferItem.deleteMany({}),
          prisma.stockTransfer.deleteMany({}),
        ]);
        break;

      case "production-orders":
        await prisma.productionOrder.deleteMany({});
        break;

      case "inventory-quantities":
        await prisma.inventory.updateMany({ data: { quantity: 0 } });
        break;

      case "hr":
        await prisma.employeeTransaction.deleteMany({});
        break;

      case "payroll":
        await prisma.payroll.deleteMany({});
        break;

      case "advances":
        await prisma.employeeTransaction.deleteMany({ where: { type: "ADVANCE" } });
        break;

      case "additions":
        await prisma.employeeTransaction.deleteMany({
          where: { type: { in: ["OVERTIME", "BONUS"] } },
        });
        break;

      case "shifts":
        // Sale references shift with onDelete: Restrict — null it out first
        await prisma.sale.updateMany({ data: { shiftId: null } });
        await prisma.shift.deleteMany({});
        break;

      case "items":
      case "items-only": {
        // Check for transaction references before deleting master data
        const salesCount = await prisma.sale.count();
        const purchasesCount = await prisma.purchase.count();
        const stockTransfersCount = await prisma.stockTransfer.count();
        if (salesCount > 0 || purchasesCount > 0) {
          return res.status(409).json({
            error: "Cannot delete items while sales or purchases exist. Clear transactions first.",
          });
        }
        if (stockTransfersCount > 0) {
          return res.status(409).json({
            error: "Cannot delete items while stock transfers exist. Clear inventory movements first.",
          });
        }
        await prisma.$transaction([
          prisma.productionOrderItem.deleteMany({}),
          prisma.productionOrder.deleteMany({}),
          prisma.bOMItem.deleteMany({}),
          prisma.bOMCategory.deleteMany({}),
          prisma.bOM.deleteMany({}),
          prisma.itemSupplier.deleteMany({}),
          prisma.itemCategory.deleteMany({}),
          prisma.inventory.deleteMany({}),
          prisma.item.deleteMany({}),
        ]);
        break;
      }

      case "categories-only": {
        const itemsCount = await prisma.item.count();
        if (itemsCount > 0) {
          return res.status(409).json({
            error: "Cannot delete categories while items exist. Clear items first.",
          });
        }
        await prisma.category.deleteMany({});
        break;
      }

      case "clients": {
        const salesCount = await prisma.sale.count();
        if (salesCount > 0) {
          return res.status(409).json({
            error: "Cannot delete clients while sales exist. Clear sales first.",
          });
        }
        await prisma.client.deleteMany({});
        break;
      }

      case "suppliers": {
        const purchasesCount = await prisma.purchase.count();
        if (purchasesCount > 0) {
          return res.status(409).json({
            error: "Cannot delete suppliers while purchases exist. Clear purchases first.",
          });
        }
        await prisma.$transaction([
          prisma.supplierPayment.deleteMany({}),
          prisma.supplierAccount.deleteMany({}),
          prisma.itemSupplier.deleteMany({}),
          prisma.supplier.deleteMany({}),
        ]);
        break;
      }

      case "employees": {
        const salesCount = await prisma.sale.count();
        if (salesCount > 0) {
          return res.status(409).json({
            error: "Cannot delete employees while sales exist. Clear sales first.",
          });
        }
        await prisma.$transaction([
          prisma.payroll.deleteMany({}),
          prisma.employeeTransaction.deleteMany({}),
          prisma.employee.deleteMany({}),
        ]);
        break;
      }

      case "purchase-returns":
        await prisma.$transaction([
          prisma.purchaseReturnItem.deleteMany({}),
          prisma.purchaseReturn.deleteMany({}),
        ]);
        break;

      case "withdrawals":
        await prisma.withdrawal.deleteMany({});
        break;

      case "supplier-payments":
        await prisma.$transaction([
          prisma.supplierPayment.deleteMany({}),
          prisma.supplierAccount.updateMany({ data: { balance: 0 } }),
        ]);
        break;

      case "supplier-balances":
        await prisma.supplierAccount.updateMany({ data: { balance: 0 } });
        break;

      case "delivery-man-transactions":
        await prisma.deliveryManTransaction.deleteMany({});
        break;

      case "delivery-wallets":
        await prisma.deliveryMan.updateMany({ data: { walletBalance: 0 } });
        break;

      case "delivery-men":
        // Sale.deliveryManId → onDelete: SetNull (DB handles nulling automatically)
        // DeliveryManTransaction → onDelete: Cascade (auto-deleted with deliveryMan)
        await prisma.deliveryMan.deleteMany({});
        break;

      case "delivery-zones":
        // Sale.deliveryZoneId → onDelete: SetNull (DB handles nulling automatically)
        await prisma.deliveryZone.deleteMany({});
        break;

      case "boms": {
        const productionOrdersCount = await prisma.productionOrder.count();
        if (productionOrdersCount > 0) {
          return res.status(409).json({
            error: "Cannot delete BOMs while production orders exist. Clear production orders first.",
          });
        }
        const bomSaleItemsCount = await prisma.saleItem.count({ where: { bomId: { not: null } } });
        if (bomSaleItemsCount > 0) {
          return res.status(409).json({
            error: "Cannot delete BOMs while sale items reference them. Clear sales first.",
          });
        }
        await prisma.$transaction([
          prisma.bOMItem.deleteMany({}),
          prisma.bOMCategory.deleteMany({}),
          prisma.bOM.deleteMany({}),
        ]);
        break;
      }

      case "audit-logs":
        // AuditLog.userId → onDelete: SetNull, AuditLog.branchId → onDelete: SetNull — safe
        await prisma.auditLog.deleteMany({});
        break;

      case "bulk-orders":
        await prisma.$transaction([
          prisma.bulkRefund.deleteMany({}),
          prisma.bulkPayment.deleteMany({}),
          prisma.bulkOrder.deleteMany({}),
          prisma.bulkNumberSequence.updateMany({ data: { nextValue: 1 } }),
        ]);
        break;

      case "notifications":
        await prisma.notification.deleteMany({});
        break;

      case "opening-inventory":
        await prisma.$transaction([
          prisma.initialInventory.deleteMany({}),
          prisma.inventory.updateMany({ data: { quantity: 0 } }),
        ]);
        break;

      case "bulk-customers": {
        const bulkOrdersCount = await prisma.bulkOrder.count();
        if (bulkOrdersCount > 0) {
          return res.status(409).json({
            error: "Cannot delete bulk customers while bulk orders exist. Clear bulk orders first.",
          });
        }
        await prisma.$transaction([
          prisma.bulkPayment.deleteMany({}),      // standalone payments (orderId nullable)
          prisma.bulkCustomer.deleteMany({}),     // contacts + contract prices cascade
        ]);
        break;
      }

      default:
        return res.status(400).json({ error: "Unknown reset category" });
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "SYSTEM_RESET",
          targetEntity: "Database",
          details: { category, verifiedBy: managerUsername },
          ipAddress: req.ip || req.socket?.remoteAddress,
        },
      });
    } catch (_) {
      // Non-critical — don't fail the response if audit write fails
    }

    res.json({ message: "Reset completed successfully" });
  } catch (error) {
    console.error(`Reset error [${category}]:`, error);
    res.status(500).json({ error: "Reset failed", details: error.message });
  }
});

module.exports = router;
