const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create a new delivery zone
exports.createDeliveryZone = async (req, res) => {
    try {
        const { name, fee } = req.body;

        if (!name || fee === undefined) {
            return res
                .status(400)
                .json({ error: "Name and fee are required" });
        }

        const deliveryZone = await prisma.deliveryZone.create({
            data: {
                name,
                fee: parseFloat(fee),
                isActive: true,
            },
        });

        res.status(201).json(deliveryZone);
    } catch (error) {
        console.error("Error creating delivery zone:", error);

        if (error.code === "P2002") {
            return res.status(400).json({ error: "Delivery zone name already exists" });
        }

        res.status(500).json({ error: "Failed to create delivery zone" });
    }
};

// Get all delivery zones
exports.getAllDeliveryZones = async (req, res) => {
    try {
        const { isActive } = req.query;
        const where = {};

        // Filter by active status if provided
        if (isActive !== undefined) {
            where.isActive = isActive === "true";
        } else {
            // Default: only show active zones
            where.isActive = true;
        }

        const deliveryZones = await prisma.deliveryZone.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json(deliveryZones);
    } catch (error) {
        console.error("Error fetching delivery zones:", error);
        res.status(500).json({ error: "Failed to fetch delivery zones" });
    }
};

// Get a single delivery zone by ID
exports.getDeliveryZoneById = async (req, res) => {
    try {
        const { id } = req.params;

        const deliveryZone = await prisma.deliveryZone.findUnique({
            where: { id: parseInt(id) },
        });

        if (!deliveryZone) {
            return res.status(404).json({ error: "Delivery zone not found" });
        }

        res.json(deliveryZone);
    } catch (error) {
        console.error("Error fetching delivery zone:", error);
        res.status(500).json({ error: "Failed to fetch delivery zone" });
    }
};

// Update a delivery zone
exports.updateDeliveryZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, fee, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (fee !== undefined) updateData.fee = parseFloat(fee);
        if (isActive !== undefined) updateData.isActive = isActive;

        const deliveryZone = await prisma.deliveryZone.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json(deliveryZone);
    } catch (error) {
        console.error("Error updating delivery zone:", error);

        if (error.code === "P2002") {
            return res.status(400).json({ error: "Delivery zone name already exists" });
        }

        if (error.code === "P2025") {
            return res.status(404).json({ error: "Delivery zone not found" });
        }

        res.status(500).json({ error: "Failed to update delivery zone" });
    }
};

// Delete a delivery zone (soft delete)
exports.deleteDeliveryZone = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.deliveryZone.update({
            where: { id: parseInt(id) },
            data: { isActive: false },
        });

        res.json({ message: "Delivery zone deleted successfully" });
    } catch (error) {
        console.error("Error deleting delivery zone:", error);

        if (error.code === "P2025") {
            return res.status(404).json({ error: "Delivery zone not found" });
        }

        res.status(500).json({ error: "Failed to delete delivery zone" });
    }
};
