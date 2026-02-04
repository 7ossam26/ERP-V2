const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create a new delivery zone
exports.createDeliveryZone = async (req, res) => {
  try {
    const { name, fee } = req.body;

    if (!name || fee === undefined || !req.body.branchId) {
      return res
        .status(400)
        .json({ error: "Name, fee, and branch are required" });
    }

    const branchId = parseInt(req.body.branchId);

    const deliveryZone = await prisma.deliveryZone.create({
      data: {
        name,
        fee: parseFloat(fee),
        branchId,
        isActive: true,
      },
    });

    res.status(201).json(deliveryZone);
  } catch (error) {
    console.error("Error creating delivery zone:", error);

    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Delivery zone name already exists" });
    }

    res.status(500).json({ error: "Failed to create delivery zone" });
  }
};

const { getUserBranchFilter } = require("../middleware/auth");

// Get all delivery zones
exports.getAllDeliveryZones = async (req, res) => {
  try {
    const { isActive, branchId } = req.query;

    // 1. Get User's Branch Filter
    const branchFilter = await getUserBranchFilter(req.user.id);

    // 2. Build Where Clause
    const where = {
      ...(branchFilter && { branchId: branchFilter.id }),
    };


    // Filter by branch if provided, provided it's allowed
    if (branchId) {
      const requestedAndAllowed = !branchFilter || branchFilter.id === parseInt(branchId);
      if (requestedAndAllowed) {
        where.branchId = parseInt(branchId);
      }
    }

    // Filter by active status if provided
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    } else {
      where.isActive = true;
    }

    // 3. Optimized Fetch
    const deliveryZones = await prisma.deliveryZone.findMany({
      where,
      select: { // Optimized Selection
        id: true,
        name: true,
        fee: true,
        branchId: true,
        isActive: true,
        branch: {
          select: { id: true, name: true },
        },
      },
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
    const { name, fee, isActive, branchId } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (fee !== undefined) updateData.fee = parseFloat(fee);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (branchId !== undefined) updateData.branchId = parseInt(branchId);

    const deliveryZone = await prisma.deliveryZone.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json(deliveryZone);
  } catch (error) {
    console.error("Error updating delivery zone:", error);

    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Delivery zone name already exists" });
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
