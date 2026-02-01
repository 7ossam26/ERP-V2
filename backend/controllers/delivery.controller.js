const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create a new delivery man
exports.createDeliveryMan = async (req, res) => {
  try {
    const { name, phone, nationalId, vehicleType, branchId } = req.body;

    if (!name || !phone || !branchId) {
      return res
        .status(400)
        .json({ error: "Name, phone, and branchId are required" });
    }

    const deliveryMan = await prisma.deliveryMan.create({
      data: {
        name,
        phone,
        nationalId,
        vehicleType,
        branchId: parseInt(branchId),
        isActive: true,
      },
    });

    res.status(201).json(deliveryMan);
  } catch (error) {
    console.error("Error creating delivery man:", error);
    res.status(500).json({ error: "Failed to create delivery man" });
  }
};

// Get all delivery men
exports.getAllDeliveryMen = async (req, res) => {
  try {
    const { branchId } = req.query;
    const where = { isActive: true };

    if (branchId) {
      where.branchId = parseInt(branchId);
    }

    const deliveryMen = await prisma.deliveryMan.findMany({
      where,
      include: {
        branch: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(deliveryMen);
  } catch (error) {
    console.error("Error fetching delivery men:", error);
    res.status(500).json({ error: "Failed to fetch delivery men" });
  }
};

// Update a delivery man
exports.updateDeliveryMan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, nationalId, vehicleType, branchId, isActive } =
      req.body;

    const deliveryMan = await prisma.deliveryMan.update({
      where: { id: parseInt(id) },
      data: {
        name,
        phone,
        nationalId,
        vehicleType,
        branchId: branchId ? parseInt(branchId) : undefined,
        isActive,
      },
    });

    res.json(deliveryMan);
  } catch (error) {
    console.error("Error updating delivery man:", error);
    res.status(500).json({ error: "Failed to update delivery man" });
  }
};

// Delete a delivery man (soft delete)
exports.deleteDeliveryMan = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.deliveryMan.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    res.json({ message: "Delivery man deleted successfully" });
  } catch (error) {
    console.error("Error deleting delivery man:", error);
    res.status(500).json({ error: "Failed to delete delivery man" });
  }
};
