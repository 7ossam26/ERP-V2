const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { writeAudit } = require("../utils/auditLogger");
const rateLimit = require("express-rate-limit");

const { body, validationResult } = require("express-validator");

// Ensure JWT_SECRET is set (security requirement)
if (!process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is required but not set!",
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = "7d"; // Extended to 7 days
// Refresh tokens removed

// Rate limiter for login endpoint (prevents brute force attacks)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 login attempts per 15 minutes
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Track failed login attempts per username (in-memory)
// Note: This resets when server restarts. For production, consider using Redis.
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 10;

// Validation rules
const loginValidation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be 3-50 characters")
    .escape(),
  body("password")
    .isLength({ min: 1 }) // Allowing short passwords for legacy/dev accounts, ideally min: 8
    .withMessage("Password is required"),
];

// LOGIN
router.post("/login", loginLimiter, loginValidation, async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        branch: true,
        accessibleBranches: {
          select: { id: true, name: true, warehouseId: true },
        },
      },
    });

    if (!user) {
      writeAudit({ action: "LOGIN_FAILED", targetEntity: "auth", targetId: null, userId: null, branchId: null, newValues: { username }, oldValues: null, ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null }).catch(() => {});
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ error: "Account is inactive. Please contact administrator." });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log(`❌ Invalid password for user: ${user.username}`);

      // Track failed login attempts
      const attempts = (failedLoginAttempts.get(username) || 0) + 1;
      failedLoginAttempts.set(username, attempts);

      // Deactivate account after MAX_FAILED_ATTEMPTS
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: false },
        });

        failedLoginAttempts.delete(username); // Reset counter
        console.log(
          `🔒 Account deactivated due to ${MAX_FAILED_ATTEMPTS} failed login attempts: ${username}`,
        );

        writeAudit({ action: "ACCOUNT_LOCKED", targetEntity: "auth", targetId: String(user.id), userId: user.id, branchId: user.branchId ?? null, newValues: { reason: "max_failed_attempts", username }, oldValues: null, ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null }).catch(() => {});
        return res.status(403).json({
          error:
            "Account has been locked due to multiple failed login attempts. Please contact administrator.",
        });
      }

      writeAudit({ action: "LOGIN_FAILED", targetEntity: "auth", targetId: String(user.id), userId: user.id, branchId: user.branchId ?? null, newValues: { username, attemptCount: attempts }, oldValues: null, ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null }).catch(() => {});
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Reset failed attempts on successful login
    if (failedLoginAttempts.has(username)) {
      failedLoginAttempts.delete(username);
    }

    // Generate access token (long-lived now)
    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role.name,
        hasSensitiveAccess: user.hasSensitiveAccess,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
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
        accessibleBranches: user.accessibleBranches || [],
        permissions: permissions,
        hasSensitiveAccess: user.hasSensitiveAccess,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    next(error);
  }
});

// REFRESH TOKEN ROUTE REMOVED (permanently disabled session extensions via refresh token)

// LOGOUT
router.post("/logout", async (req, res) => {
  try {
    // If we have a user context (from auth middleware), use it
    // Clear out session details on logout, no refresh tokens to delete
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    // Even if error, we consider logout successful from client perspective
    res.json({ message: "Logged out" });
  }
});

// GET CURRENT USER (Protected)
const { authenticateToken } = require("../middleware/auth");
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
        accessibleBranches: {
          select: { id: true, name: true, warehouseId: true },
        },
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
      accessibleBranches: user.accessibleBranches || [],
      permissions: permissions,
      hasSensitiveAccess: user.hasSensitiveAccess,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
