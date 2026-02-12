const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getUserBranchFilter } = require("../middleware/auth");

// Create a new delivery zone
exports.createDeliveryZone = async (req, res) => {
  try {
    const { name, fee, driverShare } = req.body;

    if (!name || fee === undefined || !req.body.branchId) {
      return res
        .status(400)
        .json({ error: "Name, fee, and branch are required" });
    }

    const parsedFee = parseFloat(fee);
    const parsedDriverShare = driverShare !== undefined ? parseFloat(driverShare) : 0;

    // Validate that driver share cannot exceed delivery fee
    if (parsedDriverShare > parsedFee) {
      return res
        .status(400)
        .json({ error: "Driver share cannot exceed delivery fee" });
    }

    const branchId = parseInt(req.body.branchId);

    const deliveryZone = await prisma.deliveryZone.create({
      data: {
        name,
        fee: parsedFee,
        driverShare: parsedDriverShare,
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

// Get all delivery zones
exports.getAllDeliveryZones = async (req, res) => {
  try {
    const { isActive, branchId } = req.query;
    const where = {};

    // Apply branch access control
    const branchFilter = await getUserBranchFilter(req.user.id);

    if (branchId) {
      // If specific branch is requested, use it
      where.branchId = parseInt(branchId);
    } else if (branchFilter) {
      // Otherwise, apply user's branch filter
      if (branchFilter.id.in) {
        // Multi-branch user
        where.branchId = { in: branchFilter.id.in };
      } else {
        // Single-branch user
        where.branchId = branchFilter.id;
      }
    }

    // Filter by active status if provided
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    } else {
      // Default: only show active zones
      where.isActive = true;
    }

    const deliveryZones = await prisma.deliveryZone.findMany({
      where,
      include: {
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
    const { name, fee, driverShare, isActive, branchId } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (fee !== undefined) updateData.fee = parseFloat(fee);
    if (driverShare !== undefined) updateData.driverShare = parseFloat(driverShare);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (branchId !== undefined) updateData.branchId = parseInt(branchId);

    // Validate that driver share cannot exceed delivery fee
    const finalFee = updateData.fee !== undefined ? updateData.fee : undefined;
    const finalDriverShare = updateData.driverShare !== undefined ? updateData.driverShare : undefined;

    // If both are being updated, validate directly
    if (finalFee !== undefined && finalDriverShare !== undefined) {
      if (finalDriverShare > finalFee) {
        return res.status(400).json({ error: "Driver share cannot exceed delivery fee" });
      }
    } else if (finalDriverShare !== undefined || finalFee !== undefined) {
      // If only one is being updated, fetch current values to validate
      const currentZone = await prisma.deliveryZone.findUnique({
        where: { id: parseInt(id) },
      });

      if (!currentZone) {
        return res.status(404).json({ error: "Delivery zone not found" });
      }

      const checkFee = finalFee !== undefined ? finalFee : parseFloat(currentZone.fee);
      const checkDriverShare = finalDriverShare !== undefined ? finalDriverShare : parseFloat(currentZone.driverShare || 0);

      if (checkDriverShare > checkFee) {
        return res.status(400).json({ error: "Driver share cannot exceed delivery fee" });
      }
    }

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
