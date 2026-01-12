const express = require("express");
const router = express.Router();
const prisma = require("../config/database"); // Use connection from config
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_change_me";
const TOKEN_EXPIRY = "24h";

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("🔐 Login attempt:");
    console.log(`   Username received: "${username}"`);
    console.log(`   Password received: "${password}"`);
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
      return res.status(401).json({ error: "Invalid credentials" });
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

    // Transform permissions to simplified structure
    const permissions = {};
    if (user.role && user.role.permissions) {
      user.role.permissions.forEach((perm) => {
        permissions[perm.module] = perm.canAccess;
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
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

module.exports = router;
