const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const { authenticateToken, isSuperadmin } = require("../middleware/auth");

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
router.post("/users", async (req, res) => {
  try {
    const { name, username, password, roleId, branchId } = req.body;

    if (!branchId) {
      return res.status(400).json({ error: "Branch is required" });
    }

    // Check if username exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Get role to determine default hasSensitiveAccess
    const role = await prisma.role.findUnique({
      where: { id: parseInt(roleId) },
    });

    // Determine hasSensitiveAccess value
    let hasSensitiveAccess = req.body.hasSensitiveAccess !== undefined
      ? req.body.hasSensitiveAccess
      : ['Superadmin', 'Admin', 'Manager'].includes(role?.name);

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        roleId: parseInt(roleId),
        branchId: parseInt(branchId),
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        hasSensitiveAccess: hasSensitiveAccess,
      },
      include: {
        role: true,
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
    const { name, username, roleId, branchId, password } = req.body;

    const data = {
      name,
      username,
      roleId: parseInt(roleId),
      branchId: branchId ? parseInt(branchId) : undefined,
      isActive: req.body.isActive !== undefined ? req.body.isActive : undefined,
      hasSensitiveAccess: req.body.hasSensitiveAccess !== undefined ? req.body.hasSensitiveAccess : undefined,
    };

    // Remove undefined keys
    Object.keys(data).forEach(
      (key) => data[key] === undefined && delete data[key]
    );

    if (password) {
      data.password = await bcrypt.hash(password, 10);
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
    const { id } = req.params;
    // permissions is an array of { module, canAccess }
    const { permissions } = req.body;

    const roleId = parseInt(id);

    const transaction = permissions.map((perm) => {
      return prisma.permission.upsert({
        where: {
          roleId_module: {
            roleId: roleId,
            module: perm.module,
          },
        },
        update: {
          canAccess: perm.canAccess,
        },
        create: {
          roleId: roleId,
          module: perm.module,
          canAccess: perm.canAccess,
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

module.exports = router;
