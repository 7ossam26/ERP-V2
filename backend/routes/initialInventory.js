const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");

// Protect all routes
router.use(authenticateToken, requirePermission("INITIAL_INVENTORY"));

// GET all items with their initial inventory summary
// Optional query param: warehouseId — filters quantity to a specific warehouse
router.get("/", async (req, res) => {
    try {
        const { warehouseId } = req.query;
        const filterWarehouseId = warehouseId && warehouseId !== "all"
            ? parseInt(warehouseId)
            : null;

        const items = await prisma.item.findMany({
            orderBy: { name: "asc" },
            include: {
                inventory: {
                    include: { warehouse: true },
                },
                _count: {
                    select: { initialInventoryEntries: true },
                },
            },
        });

        const result = items.map((item) => {
            let totalQty;
            if (filterWarehouseId) {
                const stock = item.inventory.find(
                    (inv) => inv.warehouseId === filterWarehouseId
                );
                totalQty = stock ? Number(stock.quantity) : 0;
            } else {
                totalQty = item.inventory.reduce(
                    (sum, inv) => sum + Number(inv.quantity),
                    0
                );
            }

            return {
                id: item.id,
                name: item.name,
                unit: item.unit,
                totalQuantity: totalQty,
                entriesCount: item._count.initialInventoryEntries,
            };
        });

        res.json(result);
    } catch (error) {
        console.error("Failed to fetch items for initial inventory:", error);
        res.status(500).json({ error: "Failed to fetch items", message: error.message });
    }
});

// GET initial inventory history for a specific item
router.get("/:itemId", async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId);

        const item = await prisma.item.findUnique({
            where: { id: itemId },
            include: {
                inventory: {
                    include: { warehouse: true },
                },
            },
        });

        if (!item) {
            return res.status(404).json({ error: "Item not found" });
        }

        const entries = await prisma.initialInventory.findMany({
            where: { itemId },
            orderBy: { createdAt: "desc" },
            include: {
                warehouse: { select: { id: true, name: true } },
                user: { select: { id: true, name: true } },
            },
        });

        res.json({ item, entries });
    } catch (error) {
        console.error("Failed to fetch initial inventory entries:", error);
        res.status(500).json({ error: "Failed to fetch entries", message: error.message });
    }
});

// POST add initial quantity entry
router.post("/", async (req, res) => {
    try {
        const { itemId, warehouseId, quantity, date, notes } = req.body;

        if (!itemId || !warehouseId) {
            return res.status(400).json({ error: "itemId and warehouseId are required" });
        }

        if (!quantity || Number(quantity) <= 0) {
            return res.status(400).json({ error: "Quantity must be greater than 0" });
        }

        const [item, warehouse] = await Promise.all([
            prisma.item.findUnique({ where: { id: parseInt(itemId) } }),
            prisma.warehouse.findUnique({ where: { id: parseInt(warehouseId) } }),
        ]);

        if (!item) return res.status(404).json({ error: "Item not found" });
        if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });

        const result = await prisma.$transaction(async (tx) => {
            // Create the history entry
            const entry = await tx.initialInventory.create({
                data: {
                    itemId: parseInt(itemId),
                    warehouseId: parseInt(warehouseId),
                    quantity: Number(quantity),
                    date: date ? new Date(date) : new Date(),
                    notes: notes || null,
                    userId: req.user.id,
                },
                include: {
                    warehouse: { select: { id: true, name: true } },
                    user: { select: { id: true, name: true } },
                },
            });

            // Increment the inventory quantity
            await tx.inventory.upsert({
                where: {
                    itemId_warehouseId: {
                        itemId: parseInt(itemId),
                        warehouseId: parseInt(warehouseId),
                    },
                },
                update: {
                    quantity: { increment: Number(quantity) },
                },
                create: {
                    itemId: parseInt(itemId),
                    warehouseId: parseInt(warehouseId),
                    quantity: Number(quantity),
                },
            });

            return entry;
        });

        res.status(201).json({ message: "Initial quantity added successfully", entry: result });
    } catch (error) {
        console.error("Failed to add initial inventory:", error);
        res.status(500).json({ error: "Failed to add initial inventory", message: error.message });
    }
});

// DELETE an entry — only Superadmin or Admin
router.delete("/:id", async (req, res) => {
    try {
        const userRole = req.user.role;
        if (userRole !== "Superadmin" && userRole !== "Admin") {
            return res.status(403).json({
                error: "Access denied. Only Superadmin or Admin can delete initial inventory entries.",
            });
        }

        const id = parseInt(req.params.id);

        const entry = await prisma.initialInventory.findUnique({ where: { id } });
        if (!entry) {
            return res.status(404).json({ error: "Entry not found" });
        }

        await prisma.$transaction(async (tx) => {
            // Check that inventory won't go negative
            const inv = await tx.inventory.findUnique({
                where: {
                    itemId_warehouseId: {
                        itemId: entry.itemId,
                        warehouseId: entry.warehouseId,
                    },
                },
            });

            if (!inv || Number(inv.quantity) < Number(entry.quantity)) {
                throw new Error("Cannot delete: current stock is less than the initial quantity being reversed");
            }

            // Decrement inventory
            await tx.inventory.update({
                where: {
                    itemId_warehouseId: {
                        itemId: entry.itemId,
                        warehouseId: entry.warehouseId,
                    },
                },
                data: {
                    quantity: { decrement: Number(entry.quantity) },
                },
            });

            // Delete the record
            await tx.initialInventory.delete({ where: { id } });
        });

        res.json({ message: "Entry deleted and inventory reversed successfully" });
    } catch (error) {
        console.error("Failed to delete initial inventory entry:", error);
        res.status(500).json({ error: error.message || "Failed to delete entry" });
    }
});

module.exports = router;
