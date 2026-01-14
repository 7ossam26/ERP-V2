const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const { body, validationResult } = require("express-validator");

// Ensure JWT_SECRET is set (security requirement)
if (!process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is required but not set!"
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = "30m";
const REFRESH_TOKEN_EXPIRY = "7d";

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
router.post("/login", loginLimiter, loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    console.log("🔐 Login attempt:");
    console.log(`   Username received: "${username}"`);

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

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role.name,
        hasSensitiveAccess: user.hasSensitiveAccess,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token (long-lived)
    const refreshToken = jwt.sign(
      { id: user.id, type: "refresh" },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Transform permissions to simplified structure
    const permissions = {};
    if (user.role && user.role.permissions) {
      user.role.permissions.forEach((perm) => {
        permissions[perm.module] = perm.canAccess;
      });
    }

    console.log(`🔐 Login successful: ${user.username} (${user.role.name})`);

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// REFRESH TOKEN
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    // Check if refresh token exists in database and is not expired
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            role: { include: { permissions: true } },
            branch: true,
          },
        },
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        id: storedToken.user.id,
        username: storedToken.user.username,
        role: storedToken.user.role.name,
        hasSensitiveAccess: storedToken.user.hasSensitiveAccess,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.json({ token: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// LOGOUT
router.post("/logout", async (req, res) => {
  try {
    // If we have a user context (from auth middleware), use it
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      // Decode without verification if expired, just to get user ID
      const decoded = jwt.decode(token);
      if (decoded && decoded.id) {
        // Delete all refresh tokens for this user
        await prisma.refreshToken.deleteMany({
          where: { userId: decoded.id },
        });
      }
    }
    // Also try to delete by refresh token if provided in body
    if (req.body.refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: req.body.refreshToken },
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    // Even if error, we consider logout successful from client perspective
    res.json({ message: "Logged out" });
  }
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
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

module.exports = router;
