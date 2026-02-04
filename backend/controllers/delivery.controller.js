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

const { getUserBranchFilter } = require("../middleware/auth");

// Get all delivery men
exports.getAllDeliveryMen = async (req, res) => {
  try {
    const { branchId } = req.query;

    // 1. Get User's Branch Filter (Enforce Scoping)
    const branchFilter = await getUserBranchFilter(req.user.id);

    // 2. Build Where Clause
    const where = {
      isActive: true,
      ...(branchFilter && { branchId: branchFilter.id }), // Enforce user's branch if not admin
    };

    // Allow filtering by specific branch if user has access to all (Admin/Superadmin)
    // or if the requested branch matches their assigned branch
    if (branchId) {
      const requestedAndAllowed = !branchFilter || branchFilter.id === parseInt(branchId);
      if (requestedAndAllowed) {
        where.branchId = parseInt(branchId);
      } else {
        // If user requests a branch they don't have access to, return empty or adhere to their filter
        // In this logic, 'where' already has the forced branchId, so we just ignore the query param
      }
    }

    // 3. Optimized Fetch
    const deliveryMen = await prisma.deliveryMan.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        branchId: true,
        walletBalance: true,
        isActive: true,
        nationalId: true,
        branch: {
          select: { name: true }
        }
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
exports.getDeliveryStats = async (req, res) => {
  try {
    const { branchId, shiftId } = req.query;

    console.log("📊 Fetching delivery stats with:", { branchId, shiftId });

    if (!branchId || !shiftId) {
      return res
        .status(400)
        .json({ error: "Branch ID and Shift ID are required" });
    }

    // 1. Fetch all active delivery men for the branch
    const deliveryMen = await prisma.deliveryMan.findMany({
      where: {
        branchId: parseInt(branchId),
        isActive: true,
      },
    });

    console.log(`✅ Found ${deliveryMen.length} delivery men`);

    // 2. Fetch all relevant sales for these delivery men
    // preventing empty IN clause if no delivery men
    if (deliveryMen.length === 0) {
      return res.json([]);
    }

    const deliveryManIds = deliveryMen.map((dm) => dm.id);

    const sales = await prisma.sale.findMany({
      where: {
        deliveryManId: {
          in: deliveryManIds,
        },
        paymentMethod: "CASH",
        deliveryStatus: "OUT_FOR_DELIVERY", // Only show pending deliveries
        status: "COMPLETED", // Only completed sales
        shiftId: parseInt(shiftId),
      },
      select: {
        id: true,
        total: true, // Decimal
        deliveryFee: true, // Decimal?
        deliveryManId: true,
      },
    });

    console.log(`📦 Found ${sales.length} pending cash sales`);

    // 3. Map sales to delivery men
    const stats = deliveryMen.map((man) => {
      const manSales = sales.filter((s) => s.deliveryManId === man.id);

      const totalCash = manSales.reduce((sum, sale) => {
        return sum + Number(sale.total);
      }, 0);

      return {
        id: man.id,
        name: man.name,
        totalCash: totalCash,
        orderCount: manSales.length,
        orders: manSales.map((sale) => ({
          id: sale.id,
          total: sale.total,
          deliveryFee: sale.deliveryFee,
        })),
      };
    });

    console.log("✅ Stats calculated successfully, sending response");
    res.json(stats);
  } catch (error) {
    console.error("❌ Error fetching delivery stats:", error);
    console.error("Error stack:", error.stack);
    res
      .status(500)
      .json({
        error: "Failed to fetch delivery stats",
        details: error.message,
      });
  }
};

// Settle delivery man debt
exports.settleDeliveryMan = async (req, res) => {
  try {
    const { deliveryManId, amount, notes, treasuryId, userId } = req.body;

    if (!deliveryManId || !amount || !treasuryId) {
      return res.status(400).json({
        error: "Delivery Man ID, Amount, and Treasury ID are required"
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement Wallet Balance
      const updatedDeliveryMan = await tx.deliveryMan.update({
        where: { id: parseInt(deliveryManId) },
        data: { walletBalance: { decrement: parseFloat(amount) } },
      });

      // 2. Increment Treasury Balance
      await tx.treasury.update({
        where: { id: parseInt(treasuryId) },
        data: { balance: { increment: parseFloat(amount) } },
      });

      // 3. Log Delivery Transaction (Payment)
      const settlementTx = await tx.deliveryManTransaction.create({
        data: {
          deliveryManId: parseInt(deliveryManId),
          amount: parseFloat(amount),
          type: "PAYMENT",
          description: notes || "Manual Settlement",
          createdById: userId ? parseInt(userId) : null,
        },
      });

      // 4. Mark all 'OUT_FOR_DELIVERY' orders for this driver as 'DELIVERED'
      // This is crucial to unblock Shift Approval
      await tx.sale.updateMany({
        where: {
          deliveryManId: parseInt(deliveryManId),
          deliveryStatus: "OUT_FOR_DELIVERY",
        },
        data: {
          deliveryStatus: "DELIVERED",
        },
      });

      return {
        deliveryMan: updatedDeliveryMan,
        transaction: settlementTx,
      };
    });

    res.json(result);

  } catch (error) {
    console.error("❌ Error settling delivery man:", error);
    res.status(500).json({ error: "Failed to settle delivery man" });
  }
};
