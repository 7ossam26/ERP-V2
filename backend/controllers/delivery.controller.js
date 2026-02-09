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
        // paymentMethod: "CASH", // REMOVED: Fetch all payment methods so we can see all pending deliveries
        deliveryStatus: "OUT_FOR_DELIVERY", // Only show pending deliveries
        status: "COMPLETED", // Only completed sales
        shiftId: parseInt(shiftId),
      },
      select: {
        id: true,
        total: true, // Decimal
        deliveryFee: true, // Decimal?
        deliveryManId: true,
        paymentMethod: true, // Need this to calculate totalCash correctly
      },
    });

    console.log(`📦 Found ${sales.length} pending sales (all methods)`);

    // 3. Map sales to delivery men
    const stats = deliveryMen.map((man) => {
      const manSales = sales.filter((s) => s.deliveryManId === man.id);

      const totalCash = manSales.reduce((sum, sale) => {
        // Only add to totalCash if payment method is CASH
        // Check for various casing or just standard CASH/Card
        const method = sale.paymentMethod
          ? sale.paymentMethod.toUpperCase()
          : "";
        if (method === "CASH") {
          return sum + Number(sale.total);
        }
        return sum;
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
    res.status(500).json({
      error: "Failed to fetch delivery stats",
      details: error.message,
    });
  }
};

// Settle delivery man debt
exports.settleDeliveryMan = async (req, res) => {
  try {
    const {
      deliveryManId,
      deliveryMen,
      amount,
      notes,
      treasuryId,
      userId,
      saleIds,
    } = req.body;

    // Determine if this is a bulk settlement or single
    const isBulk = Array.isArray(deliveryMen) && deliveryMen.length > 0;

    if (isBulk) {
      // ===== BULK SETTLEMENT =====
      if (!treasuryId) {
        return res
          .status(400)
          .json({ error: "Treasury ID is required for bulk settlement" });
      }

      const result = await prisma.$transaction(async (tx) => {
        const settlements = [];
        let totalAmount = 0;
        let totalOrdersUpdated = 0;

        for (const driver of deliveryMen) {
          if (!driver.id || !driver.amount) continue;

          // 1. Decrement Driver Wallet Balance
          const updatedDriver = await tx.deliveryMan.update({
            where: { id: parseInt(driver.id) },
            data: { walletBalance: { decrement: parseFloat(driver.amount) } },
          });

          // 2. Log Delivery Transaction (Payment)
          const settlementTx = await tx.deliveryManTransaction.create({
            data: {
              deliveryManId: parseInt(driver.id),
              amount: parseFloat(driver.amount),
              type: "PAYMENT",
              description: notes || "Bulk Settlement",
              createdById: userId ? parseInt(userId) : null,
            },
          });

          // 3. Mark orders as DELIVERED
          const whereClause = {
            deliveryManId: parseInt(driver.id),
            deliveryStatus: "OUT_FOR_DELIVERY",
          };

          if (
            driver.saleIds &&
            Array.isArray(driver.saleIds) &&
            driver.saleIds.length > 0
          ) {
            whereClause.id = { in: driver.saleIds.map((id) => parseInt(id)) };
          }

          const updateResult = await tx.sale.updateMany({
            where: whereClause,
            data: { deliveryStatus: "DELIVERED" },
          });

          settlements.push({
            deliveryMan: updatedDriver,
            transaction: settlementTx,
            updatedOrdersCount: updateResult.count,
          });

          totalAmount += parseFloat(driver.amount);
          totalOrdersUpdated += updateResult.count;
        }

        // 4. Increment Treasury Balance (Once for all drivers)
        await tx.treasury.update({
          where: { id: parseInt(treasuryId) },
          data: { balance: { increment: totalAmount } },
        });

        return {
          settlements,
          totalAmount,
          totalOrdersUpdated,
          driversSettled: settlements.length,
        };
      });

      return res.json(result);
    }

    // ===== SINGLE SETTLEMENT (existing logic) =====
    if (!deliveryManId || !amount || !treasuryId) {
      return res.status(400).json({
        error: "Delivery Man ID, Amount, and Treasury ID are required",
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

      // 4. Mark orders as DELIVERED
      const whereClause = {
        deliveryManId: parseInt(deliveryManId),
        deliveryStatus: "OUT_FOR_DELIVERY",
      };

      // If specific sales selected, only update those
      if (saleIds && Array.isArray(saleIds) && saleIds.length > 0) {
        whereClause.id = { in: saleIds.map((id) => parseInt(id)) };
      }

      const updateResult = await tx.sale.updateMany({
        where: whereClause,
        data: {
          deliveryStatus: "DELIVERED",
        },
      });

      return {
        deliveryMan: updatedDeliveryMan,
        transaction: settlementTx,
        updatedOrdersCount: updateResult.count,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("❌ Error settling delivery man:", error);
    res.status(500).json({ error: "Failed to settle delivery man" });
  }
};

// Get delivery man history (Detailed breakdown)
exports.getDeliveryHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!id) return res.status(400).json({ error: "Driver ID is required" });

    // Build Date Filter
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // 1. Fetch Sales (Debts)
    const sales = await prisma.sale.findMany({
      where: {
        deliveryManId: parseInt(id),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        // We want all sales that involved this driver
      },
      select: {
        id: true,
        saleNumber: true,
        total: true, // Decimal
        deliveryFee: true, // Decimal
        deliveryDriverShare: true, // Decimal
        deliveryStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch Transactions (Payments)
    const transactions = await prisma.deliveryManTransaction.findMany({
      where: {
        deliveryManId: parseInt(id),
        type: "PAYMENT", // Only payments
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Group Sales by Date
    const salesByDate = {};
    sales.forEach((sale) => {
      const dateKey = new Date(sale.createdAt).toISOString().split("T")[0];
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          orders: [],
          totalOrderAmount: 0,
          totalDeliveryFee: 0,
          totalDriverShare: 0,
          totalNetDebt: 0,
          status: "Mixed", // Logic to determine if all settled?
        };
      }

      // Calculations
      const total = Number(sale.total) || 0;
      const fee = Number(sale.deliveryFee) || 0;
      const share = Number(sale.deliveryDriverShare) || 0;
      const netDebt = total + fee - share;

      salesByDate[dateKey].orders.push({
        ...sale,
        netDebt,
      });

      salesByDate[dateKey].totalOrderAmount += total;
      salesByDate[dateKey].totalDeliveryFee += fee;
      salesByDate[dateKey].totalDriverShare += share;
      salesByDate[dateKey].totalNetDebt += netDebt;
    });

    // Determine status per day (Simple logic: if any OUT_FOR_DELIVERY, it's Unsettled)
    Object.values(salesByDate).forEach((day) => {
      const hasPending = day.orders.some(
        (o) => o.deliveryStatus === "OUT_FOR_DELIVERY",
      );
      day.status = hasPending ? "Unsettled" : "Settled";
    });

    res.json({
      salesByDate: Object.values(salesByDate).sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      ),
      payments: transactions,
    });
  } catch (error) {
    console.error("❌ Error fetching delivery history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

// Get daily settlement report (all drivers, aggregated by date)
exports.getDailyReport = async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    // Build Date Filter
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Build Branch Filter
    const branchFilter = {};
    if (branchId) branchFilter.branchId = parseInt(branchId);

    // Fetch all sales for delivery men
    const sales = await prisma.sale.findMany({
      where: {
        deliveryManId: { not: null },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      include: {
        deliveryMan: {
          where: branchFilter,
          select: {
            id: true,
            name: true,
            branchId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter out sales where deliveryMan was filtered out by branch
    const filteredSales = sales.filter((s) => s.deliveryMan !== null);

    // Group by date
    const reportByDate = {};
    filteredSales.forEach((sale) => {
      const dateKey = new Date(sale.createdAt).toISOString().split("T")[0];

      if (!reportByDate[dateKey]) {
        reportByDate[dateKey] = {
          date: dateKey,
          drivers: {},
          totalDebt: 0,
          totalOrders: 0,
        };
      }

      // Group by driver within date
      const driverId = sale.deliveryMan.id;
      if (!reportByDate[dateKey].drivers[driverId]) {
        reportByDate[dateKey].drivers[driverId] = {
          id: driverId,
          name: sale.deliveryMan.name,
          orders: [],
          totalDebt: 0,
        };
      }

      // Calculate net debt
      const total = Number(sale.total) || 0;
      const fee = Number(sale.deliveryFee) || 0;
      const share = Number(sale.deliveryDriverShare) || 0;
      const netDebt = total + fee - share;

      reportByDate[dateKey].drivers[driverId].orders.push({
        id: sale.id,
        saleNumber: sale.saleNumber,
        total,
        deliveryFee: fee,
        deliveryDriverShare: share,
        netDebt,
        deliveryStatus: sale.deliveryStatus,
      });

      reportByDate[dateKey].drivers[driverId].totalDebt += netDebt;
      reportByDate[dateKey].totalDebt += netDebt;
      reportByDate[dateKey].totalOrders += 1;
    });

    // Convert to array format
    const report = Object.values(reportByDate)
      .map((day) => ({
        ...day,
        drivers: Object.values(day.drivers),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(report);
  } catch (error) {
    console.error("❌ Error fetching daily report:", error);
    res.status(500).json({ error: "Failed to fetch daily report" });
  }
};
