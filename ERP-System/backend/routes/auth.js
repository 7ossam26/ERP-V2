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

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                role: {
                    include: {
                        permissions: true
                    }
                }
            },
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: "Account is inactive. Please contact administrator." });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

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
            permissions: permissions,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user details" });
    }
});

module.exports = router;
