/**
 * ERP-V2 Desktop — Auth Routes (Single-User Mode)
 *
 * Login always succeeds (returns superadmin with all permissions).
 * /me returns the superadmin profile from the database.
 * No rate limiting, no password validation, no JWT generation needed.
 *
 * We still generate a JWT for API compatibility (frontend stores it in localStorage).
 */

const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "desktop-fallback-secret";

// LOGIN — always succeeds, returns superadmin with a static JWT
router.post("/login", async (req, res, next) => {
  try {
    // Fetch the superadmin user from database
    const user = await prisma.user.findFirst({
      where: { username: "superadmin" },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        branch: true,
      },
    });

    if (!user) {
      return res.status(500).json({
        error: "Superadmin user not found. Database may not be seeded.",
      });
    }

    // Generate a long-lived JWT for frontend API compatibility
    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role.name,
        hasSensitiveAccess: user.hasSensitiveAccess,
      },
      JWT_SECRET,
      { expiresIn: "365d" }
    );

    // Transform permissions to simplified structure
    const permissions = {};
    if (user.role && user.role.permissions) {
      user.role.permissions.forEach((perm) => {
        permissions[perm.module] = perm.canAccess;
      });
    }

    res.json({
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role.name,
        roleId: user.roleId,
        branch: user.branch,
        permissions: permissions,
        hasSensitiveAccess: user.hasSensitiveAccess,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    next(error);
  }
});

// LOGOUT — no-op in single-user mode
router.post("/logout", async (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// GET CURRENT USER — returns superadmin profile
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        branch: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Transform permissions to simplified structure
    const permissions = {};
    if (user.role && user.role.permissions) {
      user.role.permissions.forEach((perm) => {
        permissions[perm.module] = perm.canAccess;
      });
    }

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role.name,
      roleId: user.roleId,
      branch: user.branch,
      permissions: permissions,
      hasSensitiveAccess: user.hasSensitiveAccess,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
