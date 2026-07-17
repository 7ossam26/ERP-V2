const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { executeProductionInTx } = require("../lib/productionService");
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
                bomOutputs: { select: { id: true } },
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
                // BOM (manufactured) items use the "opening production" flow so
                // opening stock is valued from the recipe instead of a flat cost.
                isBom: item.isBom && item.bomOutputs.length > 0,
                bomId: item.bomOutputs[0]?.id ?? null,
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
        const { itemId, warehouseId, quantity, unitCost, date, notes } = req.body;

        if (!itemId || !warehouseId) {
            return res.status(400).json({ error: "itemId and warehouseId are required" });
        }

        if (!quantity || Number(quantity) <= 0) {
            return res.status(400).json({ error: "Quantity must be greater than 0" });
        }

        const cost = unitCost === undefined || unitCost === null || unitCost === ""
            ? null
            : Number(unitCost);
        if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
            return res.status(400).json({ error: "Unit cost must be zero or greater" });
        }

        const [item, warehouse] = await Promise.all([
            prisma.item.findUnique({
                where: { id: parseInt(itemId) },
                include: { bomOutputs: { select: { id: true } } },
            }),
            prisma.warehouse.findUnique({ where: { id: parseInt(warehouseId) } }),
        ]);

        if (!item) return res.status(404).json({ error: "Item not found" });
        if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });

        // Manufactured (BOM) items must go through the opening-production flow so
        // their opening stock is valued from the recipe, not a flat cost.
        if (item.isBom && item.bomOutputs.length > 0) {
            return res.status(400).json({
                error: "هذا الصنف مصنّع (BOM). استخدم الإنتاج الافتتاحي لإضافة رصيده.",
                code: "USE_BOM_OPENING",
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create the history entry
            const entry = await tx.initialInventory.create({
                data: {
                    itemId: parseInt(itemId),
                    warehouseId: parseInt(warehouseId),
                    quantity: Number(quantity),
                    unitCost: cost,
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

            // Overwrite the item's cost (latest-wins, mirroring purchases) so
            // valuation and COGS use this opening purchase price.
            if (cost !== null && cost > 0) {
                await tx.item.update({
                    where: { id: parseInt(itemId) },
                    data: { costPrice: cost },
                });
            }

            return entry;
        });

        res.status(201).json({ message: "Initial quantity added successfully", entry: result });
    } catch (error) {
        console.error("Failed to add initial inventory:", error);
        res.status(500).json({ error: "Failed to add initial inventory", message: error.message });
    }
});

// GET the exploded recipe for a manufactured (BOM) item, so the UI can show the
// raw materials and let the user enter a purchase cost per component.
router.get("/bom/:itemId", async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId);
        const bom = await prisma.bOM.findFirst({
            where: { outputItemId: itemId },
            include: { items: { include: { item: true } }, outputItem: true },
        });
        if (!bom) return res.status(404).json({ error: "No BOM linked to this item" });

        res.json({
            bomId: bom.id,
            outputItemId: bom.outputItemId,
            outputName: bom.outputItem?.name || bom.name,
            outputQuantity: Number(bom.outputQuantity),
            unit: bom.unit,
            components: bom.items.map((bi) => ({
                itemId: bi.itemId,
                name: bi.item.name,
                unit: bi.item.unit,
                // Quantity required to make one full `outputQuantity` batch.
                quantityPerBatch: Number(bi.quantity),
                costPrice: Number(bi.item.costPrice || 0),
            })),
        });
    } catch (error) {
        console.error("Failed to load BOM explosion:", error);
        res.status(500).json({ error: "Failed to load BOM", message: error.message });
    }
});

// POST opening inventory for a manufactured (BOM) item = "opening production":
// seed the raw materials at their purchase cost, then immediately produce the
// finished good (consuming them). Net effect: raw materials ~0, finished good in
// stock valued at the recipe cost. Sellable on every channel.
router.post("/bom", async (req, res) => {
    try {
        const { outputItemId, warehouseId, quantity, date, notes, components } = req.body;

        if (!outputItemId || !warehouseId) {
            return res.status(400).json({ error: "outputItemId and warehouseId are required" });
        }
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ error: "Quantity must be greater than 0" });
        }

        const [bom, warehouse] = await Promise.all([
            prisma.bOM.findFirst({
                where: { outputItemId: parseInt(outputItemId) },
                include: { items: { include: { item: true } }, outputItem: true },
            }),
            prisma.warehouse.findUnique({ where: { id: parseInt(warehouseId) } }),
        ]);
        if (!bom) return res.status(404).json({ error: "No BOM linked to this item" });
        if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });

        // Client-supplied per-component unit costs; fall back to current costPrice.
        const costByItem = {};
        (components || []).forEach((c) => {
            const n = Number(c.unitCost);
            if (Number.isFinite(n) && n >= 0) costByItem[parseInt(c.itemId)] = n;
        });

        const whId = parseInt(warehouseId);
        const entryDate = date ? new Date(date) : new Date();
        const multiplier = qty / parseFloat(bom.outputQuantity);
        const outName = bom.outputItem?.name || bom.name;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Seed each raw material as opening stock at its purchase cost.
            for (const bi of bom.items) {
                const needQty = parseFloat(
                    (parseFloat(bi.quantity) * multiplier).toFixed(6)
                );
                const unitCost = costByItem[bi.itemId] !== undefined
                    ? costByItem[bi.itemId]
                    : Number(bi.item.costPrice || 0);

                await tx.initialInventory.create({
                    data: {
                        itemId: bi.itemId,
                        warehouseId: whId,
                        quantity: needQty,
                        unitCost,
                        date: entryDate,
                        notes: notes
                            ? `${notes} — مكوّن لإنتاج افتتاحي (${outName})`
                            : `مكوّن لإنتاج افتتاحي (${outName})`,
                        userId: req.user.id,
                    },
                });

                await tx.inventory.upsert({
                    where: { itemId_warehouseId: { itemId: bi.itemId, warehouseId: whId } },
                    update: { quantity: { increment: needQty } },
                    create: { itemId: bi.itemId, warehouseId: whId, quantity: needQty },
                });

                // Overwrite the component's cost (latest-wins, like purchases).
                if (unitCost > 0) {
                    await tx.item.update({
                        where: { id: bi.itemId },
                        data: { costPrice: unitCost },
                    });
                }
            }

            // 2. Produce the finished good, consuming exactly what we just seeded
            //    (identical multiplier => raw materials net to ~0). The helper also
            //    stamps the finished item's costPrice from the recipe cost.
            const { order } = await executeProductionInTx(tx, {
                bom,
                sourceWarehouseId: whId,
                destWarehouseId: whId,
                targetOutputQty: qty,
                actualOutputQty: qty,
                createdById: req.user.id,
                notes: notes ? `إنتاج افتتاحي: ${notes}` : `إنتاج افتتاحي لرصيد ${outName}`,
                componentUnitCosts: costByItem,
                validateStock: false, // exactly seeded above
                updateOutputCost: true,
            });

            return order;
        });

        res.status(201).json({ message: "Opening production recorded", order: result });
    } catch (error) {
        console.error("Failed to add BOM opening inventory:", error);
        res.status(500).json({ error: "Failed to add BOM opening inventory", message: error.message });
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
