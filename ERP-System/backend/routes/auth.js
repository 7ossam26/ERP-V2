const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

// Ensure JWT_SECRET is set (security requirement)
if (!process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is required but not set!"
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = "24h";

// Rate limiter for login endpoint (prevents brute force attacks)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 login attempts per 15 minutes
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Track failed login attempts per username (in-memory)
// Note: This resets when server restarts. For production, consider using Redis.
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 10;

// LOGIN
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("🔐 Login attempt:");
    console.log(`   Username received: "${username}"`);
    console.log(`   Username length: ${username?.length}`);

    if (!username || !password) {
      console.log("❌ Missing username or password");
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Find user
    console.log(`   Searching for user: "${username}"`);
    const user = await prisma.user.findUnique({
      where: { username },
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
      console.log(`❌ User not found: "${username}"`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log(`✅ User found: ${user.username} (ID: ${user.id})`);

    if (!user.isActive) {
      console.log(`❌ User is inactive: ${user.username}`);
      return res
        .status(403)
        .json({ error: "Account is inactive. Please contact administrator." });
    }

    console.log(`   User is active, checking password...`);

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log(`❌ Invalid password for user: ${user.username}`);

      // Track failed login attempts
      const attempts = (failedLoginAttempts.get(username) || 0) + 1;
      failedLoginAttempts.set(username, attempts);

      console.log(
        `   Failed login attempts for ${username}: ${attempts}/${MAX_FAILED_ATTEMPTS}`
      );

      // Deactivate account after MAX_FAILED_ATTEMPTS
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: false },
        });

        failedLoginAttempts.delete(username); // Reset counter
        console.log(
          `🔒 Account deactivated due to ${MAX_FAILED_ATTEMPTS} failed login attempts: ${username}`
        );

        return res.status(403).json({
          error:
            "Account has been locked due to multiple failed login attempts. Please contact administrator.",
        });
      }

      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Reset failed attempts on successful login
    if (failedLoginAttempts.has(username)) {
      failedLoginAttempts.delete(username);
      console.log(`   Cleared failed login attempts for ${username}`);
    }

    console.log(`✅ Password valid for user: ${user.username}`);

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role.name,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Transform permissions
    const permissions = {};
    if (user.role && user.role.permissions) {
      user.role.permissions.forEach((perm) => {
        permissions[perm.module] = {
          view: perm.canView,
          create: perm.canCreate,
          edit: perm.canEdit,
          delete: perm.canDelete,
        };
      });
    }

    // Log login (Create Audit Log if possible, otherwise just log to console for now)
    // We will implement full audit logging in Phase 2
    console.log(`🔐 Login successful: ${user.username} (${user.role.name})`);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role.name,
        roleId: user.roleId,
        branch: user.branch,
        permissions: permissions,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// LOGOUT (Client-side mostly, but we can do server-side cleanup if needed)
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// GET CURRENT USER (Protected)
const { authenticateToken } = require("../middleware/auth");
router.get("/me", authenticateToken, async (req, res) => {
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

    // Transform permissions to a simpler format for frontend
    const permissions = {};
    if (user.role && user.role.permissions) {
      user.role.permissions.forEach((perm) => {
        permissions[perm.module] = {
          view: perm.canView,
          create: perm.canCreate,
          edit: perm.canEdit,
          delete: perm.canDelete,
        };
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
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

module.exports = router;
