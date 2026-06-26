const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireSensitiveAccess } = require("../middleware/auth");

router.use(authenticateToken, requirePermission("EXPENSES"));

// GET all expense categories
router.get("/", async (req, res, next) => {
    try {
        const where = {};
        if (req.query.active === "1") {
            where.isActive = true;
        }
        const categories = await prisma.expenseCategory.findMany({
            where,
            orderBy: { name: "asc" },
        });
        res.json(categories);
    } catch (error) {
        next(error);
    }
});

// POST create expense category
router.post("/", async (req, res, next) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "اسم التصنيف مطلوب" });
    }
    try {
        const category = await prisma.expenseCategory.create({
            data: { name: name.trim() },
        });
        res.status(201).json(category);
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(400).json({ error: "التصنيف موجود بالفعل" });
        }
        next(error);
    }
});

// PUT update expense category
router.put("/:id", async (req, res, next) => {
    const { name, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (isActive !== undefined) data.isActive = isActive;

    try {
        const category = await prisma.expenseCategory.update({
            where: { id: parseInt(req.params.id) },
            data,
        });
        res.json(category);
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ error: "التصنيف غير موجود" });
        }
        if (error.code === "P2002") {
            return res.status(400).json({ error: "التصنيف موجود بالفعل" });
        }
        next(error);
    }
});

// DELETE expense category (sensitive access only)
router.delete("/:id", requireSensitiveAccess, async (req, res, next) => {
    try {
        await prisma.expenseCategory.delete({
            where: { id: parseInt(req.params.id) },
        });
        res.status(204).send();
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ error: "التصنيف غير موجود" });
        }
        next(error);
    }
});

module.exports = router;
