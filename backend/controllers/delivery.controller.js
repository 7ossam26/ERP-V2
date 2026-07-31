const prisma = require("../config/database");
const bcrypt = require("bcryptjs");
const { getUserBranchFilter } = require("../middleware/auth");
const { writeAudit } = require("../utils/auditLogger");

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

    // Apply branch access control
    const branchFilter = await getUserBranchFilter(req.user.id, req);

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
      select: { id: true, name: true, phone: true, vehicleType: true },
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
        saleNumber: true,
        total: true,
        deliveryFee: true,
        deliveryManId: true,
        paymentMethod: true,
        deliveryAddress: true,
        createdAt: true,
        client: { select: { id: true, name: true, phoneNumber: true } },
        deliveryZone: { select: { id: true, name: true } },
        items: { select: { id: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
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

      const totalAmount = manSales.reduce((sum, s) => sum + Number(s.total || 0), 0);

      return {
        id: man.id,
        name: man.name,
        phone: man.phone,
        vehicleType: man.vehicleType,
        totalCash: totalCash,
        totalAmount,
        orderCount: manSales.length,
        orders: manSales.map((sale) => ({
          id: sale.id,
          saleNumber: sale.saleNumber,
          total: sale.total,
          deliveryFee: sale.deliveryFee,
          paymentMethod: sale.paymentMethod,
          createdAt: sale.createdAt,
          deliveryAddress: sale.deliveryAddress,
          clientName: sale.client?.name || null,
          clientPhone: sale.client?.phoneNumber || null,
          zoneName: sale.deliveryZone?.name || null,
          itemsCount: Array.isArray(sale.items) ? sale.items.length : 0,
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

/**
 * GET /api/delivery-men/with-debt
 * Drivers that owe money — wallet balance OR pending cash on dispatched
 * deliveries. The two sources can diverge: legacy data and call-center
 * dispatches that didn't increment the wallet still show up here, so the
 * settlement page never misses a rider with cash in hand.
 *
 * Returns: [{ id, name, phone, vehicleType, branchId, walletBalance,
 *             pendingCash, effectiveDebt, pendingOrders }]
 *   effectiveDebt = max(walletBalance, pendingCash)
 *   pendingOrders = count of OUT_FOR_DELIVERY CASH sales for this driver
 */
exports.getDeliveryMenWithDebt = async (req, res) => {
  try {
    const { branchId } = req.query;
    const branchFilter = branchId ? { branchId: parseInt(branchId) } : {};

    const drivers = await prisma.deliveryMan.findMany({
      where: { isActive: true, ...branchFilter },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ walletBalance: "desc" }, { name: "asc" }],
    });

    const driverIds = drivers.map((d) => d.id);
    if (driverIds.length === 0) {
      return res.json([]);
    }

    // Pending CASH out-for-delivery, regardless of shift — the settlement
    // page and POS-debts modal are both shift-agnostic.
    const pendingSales = await prisma.sale.findMany({
      where: {
        deliveryManId: { in: driverIds },
        deliveryStatus: "OUT_FOR_DELIVERY",
        status: "COMPLETED",
        paymentMethod: "CASH",
      },
      select: {
        id: true,
        saleNumber: true,
        total: true,
        deliveryFee: true,
        deliveryDriverShare: true,
        paymentMethod: true,
        deliveryAddress: true,
        deliveryManId: true,
        createdAt: true,
        client: { select: { id: true, name: true, phoneNumber: true } },
        deliveryZone: { select: { id: true, name: true } },
        items: { select: { id: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Online dues owed to each rider = Σ DUES_ACCRUED − Σ DUES_PAYOUT. This is
    // tracked independently from pendingCash so the settlement page can show the
    // two figures split (cash to collect vs. share owed back on InstaPay orders)
    // instead of a single netted walletBalance that hides the composition.
    const duesTx = await prisma.deliveryManTransaction.groupBy({
      by: ["deliveryManId", "type"],
      where: {
        deliveryManId: { in: driverIds },
        type: { in: ["DUES_ACCRUED", "DUES_PAYOUT"] },
      },
      _sum: { amount: true },
    });
    const duesByDriver = new Map();
    for (const row of duesTx) {
      const cur = duesByDriver.get(row.deliveryManId) || 0;
      const v = Number(row._sum.amount || 0);
      duesByDriver.set(
        row.deliveryManId,
        cur + (row.type === "DUES_ACCRUED" ? v : -v),
      );
    }

    const ordersByDriver = new Map();
    for (const s of pendingSales) {
      if (!ordersByDriver.has(s.deliveryManId)) ordersByDriver.set(s.deliveryManId, []);
      ordersByDriver.get(s.deliveryManId).push({
        id: s.id,
        saleNumber: s.saleNumber,
        total: Number(s.total || 0),
        deliveryFee: Number(s.deliveryFee || 0),
        deliveryDriverShare: Number(s.deliveryDriverShare || 0),
        paymentMethod: s.paymentMethod,
        deliveryAddress: s.deliveryAddress,
        createdAt: s.createdAt,
        clientName: s.client?.name || null,
        clientPhone: s.client?.phoneNumber || null,
        zoneName: s.deliveryZone?.name || null,
        itemsCount: Array.isArray(s.items) ? s.items.length : 0,
      });
    }

    const enriched = drivers
      .map((d) => {
        const wallet = Number(d.walletBalance || 0);
        const orders = ordersByDriver.get(d.id) || [];
        // Pending cash = what the rider should hand over after keeping their
        // share. This must mirror routes/sales.js + routes/orders.js
        // (walletBalance gets `total − share` per dispatch). Summing the gross
        // total here is what caused the POS modal to read 10 ج.م higher than
        // the settlement page on the same orders.
        const pendingCash = orders.reduce(
          (sum, o) => sum + (Number(o.total || 0) - Number(o.deliveryDriverShare || 0)),
          0,
        );
        const pendingOrders = orders.length;
        const effectiveDebt = Math.max(wallet, pendingCash);
        const dues = Math.max(0, duesByDriver.get(d.id) || 0);
        return {
          id: d.id,
          name: d.name,
          phone: d.phone,
          vehicleType: d.vehicleType,
          branchId: d.branchId,
          branch: d.branch,
          walletBalance: wallet,
          pendingCash,
          pendingOrders,
          effectiveDebt,
          // Online share owed back to the rider (InstaPay-converted orders).
          dues,
          // Aliases so callers expecting the legacy getStats shape work too:
          totalCash: effectiveDebt,
          totalAmount: pendingCash,
          orderCount: pendingOrders,
          orders,
        };
      })
      .filter((d) => d.effectiveDebt > 0 || d.dues > 0.001)
      .sort((a, b) => b.effectiveDebt - a.effectiveDebt);

    res.json(enriched);
  } catch (error) {
    console.error("❌ getDeliveryMenWithDebt failed:", error);
    res.status(500).json({
      error: "Failed to fetch indebted delivery men",
      details: error.message,
    });
  }
};

// Verify manager credentials for settlement
exports.verifyManagerCredentials = async (req, res) => {
  try {
    const { managerUsername, managerPassword } = req.body;

    if (!managerUsername || !managerPassword) {
      return res.status(400).json({
        error: "Manager username and password are required",
        message: "يرجى إدخال اسم المستخدم وكلمة المرور للمدير",
      });
    }

    // Find manager
    const manager = await prisma.user.findUnique({
      where: { username: managerUsername },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        accessibleBranches: {
          select: { id: true },
        },
      },
    });

    if (!manager) {
      return res.status(401).json({
        error: "Invalid manager credentials",
        message: "اسم المستخدم أو كلمة المرور للمدير غير صحيحة",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      managerPassword,
      manager.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid manager credentials",
        message: "اسم المستخدم أو كلمة المرور للمدير غير صحيحة",
      });
    }

    // Verify manager has appropriate role OR permissions
    const hasRole =
      manager.role.name === "Superadmin" ||
      manager.role.name === "Manager" ||
      manager.role.name === "Branch Manager" ||
      manager.role.name === "Admin" ||
      manager.role.name === "General Manager";

    // Check permissions if role check fails
    let hasPermission = false;
    if (!hasRole && manager.role.permissions) {
      hasPermission = manager.role.permissions.some(
        (p) =>
          (p.module === "DELIVERY_SETTLEMENT" || p.module === "POS") &&
          p.canAccess === true,
      );
    }

    if (!hasRole && !hasPermission) {
      return res.status(403).json({
        error: "Access denied. Only managers can approve settlements.",
        message: "عذراً، هذه العملية متاحة للمديرين فقط",
      });
    }

    // Return manager info (don't send password)
    res.json({
      valid: true,
      manager: {
        id: manager.id,
        name: manager.name,
        role: manager.role.name,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying manager credentials:", error);
    res.status(500).json({ error: "Failed to verify credentials" });
  }
};

// Settle delivery man debt

// Settle delivery man debt
exports.settleDeliveryMan = async (req, res) => {
  try {
    const {
      deliveryManId,
      deliveryMen,
      amount,
      notes,
      userId,
      saleIds,
    } = req.body;

    // Settlement is allowed for all authenticated users with POS or DELIVERY_SETTLEMENT permission
    // (enforced by route middleware). No additional manager auth required.
    const settledById = userId ? parseInt(userId) : (req.user?.id || null);

    // Determine if this is a bulk settlement or single
    const isBulk = Array.isArray(deliveryMen) && deliveryMen.length > 0;

    if (isBulk) {
      // ===== BULK SETTLEMENT =====

      const result = await prisma.$transaction(async (tx) => {
        const settlements = [];
        const treasuryUpdates = new Map(); // Track treasury updates per branch
        let totalOrdersUpdated = 0;
        const now = new Date();

        for (const driver of deliveryMen) {
          if (!driver.id) continue;

          // Fetch driver with branch info to get treasury + name (for audit)
          const driverData = await tx.deliveryMan.findUnique({
            where: { id: parseInt(driver.id) },
            include: { branch: { select: { treasuryId: true } } },
          });

          if (!driverData || !driverData.branch?.treasuryId) {
            console.warn(
              `⚠️ Driver ${driver.id} has no branch treasury, skipping`,
            );
            continue;
          }

          const treasuryId = driverData.branch.treasuryId;

          // Same guard as the single path: derive the settleable amount from
          // still-pending sales. If nothing pending, skip silently — bulk
          // tolerates partial idempotent replays across many drivers.
          const idFilter =
            Array.isArray(driver.saleIds) && driver.saleIds.length > 0
              ? { id: { in: driver.saleIds.map((id) => parseInt(id)) } }
              : {};
          const pendingSales = await tx.sale.findMany({
            where: {
              deliveryManId: parseInt(driver.id),
              deliveryStatus: "OUT_FOR_DELIVERY",
              ...idFilter,
            },
            select: {
              id: true,
              total: true,
              deliveryDriverShare: true,
              paymentMethod: true,
              paidAt: true,
            },
          });

          if (pendingSales.length === 0) continue;

          const driverAmount = pendingSales.reduce(
            (sum, s) => sum + (Number(s.total || 0) - Number(s.deliveryDriverShare || 0)),
            0,
          );
          const settledSaleIds = pendingSales.map((s) => s.id);

          // 1. Decrement Driver Wallet Balance
          const updatedDriver = await tx.deliveryMan.update({
            where: { id: parseInt(driver.id) },
            data: { walletBalance: { decrement: driverAmount } },
          });

          // 2. Log Delivery Transaction (Payment)
          const settlementTx = await tx.deliveryManTransaction.create({
            data: {
              deliveryManId: parseInt(driver.id),
              amount: driverAmount,
              type: "PAYMENT",
              description: notes || "Bulk Settlement",
              createdById: settledById,
            },
          });

          // 3. Mark sales DELIVERED + stamp paidAt for any not-yet-paid sales
          await tx.sale.updateMany({
            where: { id: { in: settledSaleIds } },
            data: { deliveryStatus: "DELIVERED" },
          });
          const unpaidSettled = pendingSales.filter(
            (s) =>
              !s.paidAt &&
              (s.paymentMethod === "CASH" ||
                s.paymentMethod === "VISA" ||
                s.paymentMethod === "INSTAPAY"),
          );
          if (unpaidSettled.length > 0) {
            await tx.sale.updateMany({
              where: { id: { in: unpaidSettled.map((s) => s.id) } },
              data: { paidAt: now },
            });
          }

          // 4. Keep the Order workflow row in sync (mirrors sales.js mark-delivered).
          const updateResult = await tx.order.updateMany({
            where: { saleId: { in: settledSaleIds } },
            data: { status: "DELIVERED", deliveredAt: now },
          });

          // 5. Audit trail — one Deposit row per driver settlement so the
          //    treasury history and shift report "نقدي داخل" show it.
          // source=DRIVER_SETTLEMENT keeps this row OUT of the shift drawer
          // formula: the same cash already reaches expected cash through the
          // sale's codDelivered term, so counting the Deposit too would double it.
          await tx.deposit.create({
            data: {
              amount: driverAmount,
              description: `تسوية دليفري — ${driverData.name}`,
              date: now,
              treasuryId,
              createdById: settledById,
              source: "DRIVER_SETTLEMENT",
            },
          });

          // Track treasury amounts
          if (!treasuryUpdates.has(treasuryId)) {
            treasuryUpdates.set(treasuryId, 0);
          }
          treasuryUpdates.set(
            treasuryId,
            treasuryUpdates.get(treasuryId) + driverAmount,
          );

          settlements.push({
            deliveryMan: updatedDriver,
            transaction: settlementTx,
            updatedOrdersCount: updateResult.count,
            treasuryId,
          });

          totalOrdersUpdated += updateResult.count;
        }

        // 6. Increment Treasury Balances (per branch)
        for (const [treasuryId, amount] of treasuryUpdates.entries()) {
          await tx.treasury.update({
            where: { id: treasuryId },
            data: { balance: { increment: amount } },
          });
        }

        return {
          settlements,
          totalAmount: Array.from(treasuryUpdates.values()).reduce(
            (a, b) => a + b,
            0,
          ),
          totalOrdersUpdated,
          driversSettled: settlements.length,
        };
      });

      return res.json(result);
    }

    // ===== SINGLE SETTLEMENT =====
    if (!deliveryManId) {
      return res.status(400).json({ error: "Delivery Man ID is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Fetch driver with branch treasury
      const driver = await tx.deliveryMan.findUnique({
        where: { id: parseInt(deliveryManId) },
        include: { branch: { select: { treasuryId: true } } },
      });

      if (!driver || !driver.branch?.treasuryId) {
        throw new Error(
          "Driver not found or branch has no associated treasury",
        );
      }

      const treasuryId = driver.branch.treasuryId;

      // Trust the database, not the client. Resolve the actual settleable
      // amount from the still-pending OUT_FOR_DELIVERY rows the user picked.
      // Without this guard, replaying the same request (or a stale tab
      // re-clicking "تأكيد التسوية") would double-debit treasury and push
      // the rider's wallet negative, even though no orders flip — because
      // the update is filtered on OUT_FOR_DELIVERY but the wallet/treasury
      // mutations were not.
      const idFilter =
        Array.isArray(saleIds) && saleIds.length > 0
          ? { id: { in: saleIds.map((id) => parseInt(id)) } }
          : {};
      const pendingSales = await tx.sale.findMany({
        where: {
          deliveryManId: parseInt(deliveryManId),
          deliveryStatus: "OUT_FOR_DELIVERY",
          ...idFilter,
        },
        select: {
          id: true,
          total: true,
          deliveryDriverShare: true,
          paymentMethod: true,
          paidAt: true,
        },
      });

      if (pendingSales.length === 0) {
        const err = new Error(
          "لا توجد طلبات معلقة قابلة للتسوية — قد تكون مسوّاة بالفعل",
        );
        err.code = "NOTHING_TO_SETTLE";
        throw err;
      }

      const trustedAmount = pendingSales.reduce(
        (sum, s) => sum + (Number(s.total || 0) - Number(s.deliveryDriverShare || 0)),
        0,
      );
      const settledSaleIds = pendingSales.map((s) => s.id);

      // 1. Decrement Wallet Balance — by the trusted amount, not the client's
      const updatedDeliveryMan = await tx.deliveryMan.update({
        where: { id: parseInt(deliveryManId) },
        data: { walletBalance: { decrement: trustedAmount } },
      });

      // 2. Increment Treasury Balance (driver's branch treasury)
      await tx.treasury.update({
        where: { id: treasuryId },
        data: { balance: { increment: trustedAmount } },
      });

      // 3. Log Delivery Transaction (Payment)
      const settlementTx = await tx.deliveryManTransaction.create({
        data: {
          deliveryManId: parseInt(deliveryManId),
          amount: trustedAmount,
          type: "PAYMENT",
          description: notes || "Manual Settlement",
          createdById: settledById,
        },
      });

      // 4. Mark sales DELIVERED + stamp paidAt for any not-yet-paid sales
      await tx.sale.updateMany({
        where: { id: { in: settledSaleIds } },
        data: { deliveryStatus: "DELIVERED" },
      });
      const unpaidSettled = pendingSales.filter(
        (s) =>
          !s.paidAt &&
          (s.paymentMethod === "CASH" ||
            s.paymentMethod === "VISA" ||
            s.paymentMethod === "INSTAPAY"),
      );
      if (unpaidSettled.length > 0) {
        await tx.sale.updateMany({
          where: { id: { in: unpaidSettled.map((s) => s.id) } },
          data: { paidAt: now },
        });
      }

      // 5. Keep the Order workflow row in sync (mirrors sales.js mark-delivered).
      const updateResult = await tx.order.updateMany({
        where: { saleId: { in: settledSaleIds } },
        data: { status: "DELIVERED", deliveredAt: now },
      });

      // 6. Audit trail — one Deposit row per settlement so the treasury
      //    history and the shift report "نقدي داخل" row reflect it.
      // See the bulk-settlement path: DRIVER_SETTLEMENT excludes this from the
      // drawer formula, where the cash is already counted via codDelivered.
      await tx.deposit.create({
        data: {
          amount: trustedAmount,
          description: `تسوية دليفري — ${driver.name}`,
          date: now,
          treasuryId,
          createdById: settledById,
          source: "DRIVER_SETTLEMENT",
        },
      });

      return {
        deliveryMan: updatedDeliveryMan,
        transaction: settlementTx,
        updatedOrdersCount: updateResult.count,
        amount: trustedAmount,
        treasuryId,
        settledSaleIds,
      };
    });

    res.json(result);
  } catch (error) {
    if (error?.code === "NOTHING_TO_SETTLE") {
      return res.status(409).json({
        error: error.message,
        code: "NOTHING_TO_SETTLE",
      });
    }
    console.error("❌ Error settling delivery man:", error);
    res.status(500).json({ error: "Failed to settle delivery man" });
  }
};

// Convert a CASH delivery sale to INSTAPAY — the customer paid online on
// delivery, so the rider collected no cash. Records the full order total into
// the global InstaPay treasury, reverses the rider's cash debt, and accrues the
// rider's share as online dues. Mirrors settleDeliveryMan's transaction discipline.
exports.convertDeliverySaleToInstapay = async (req, res) => {
  try {
    const saleId = parseInt(req.params.saleId);
    const actorId = req.user?.id || (req.body?.userId ? parseInt(req.body.userId) : null);
    if (!saleId) return res.status(400).json({ error: "Sale ID is required" });

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: {
          id: true,
          saleNumber: true,
          total: true,
          deliveryDriverShare: true,
          deliveryManId: true,
          deliveryStatus: true,
          paymentMethod: true,
          branchId: true,
        },
      });

      if (!sale) {
        const err = new Error("الطلب غير موجود");
        err.code = "NOT_CONVERTIBLE";
        throw err;
      }
      // Guard: only a still-pending CASH delivery order can be converted. This
      // also blocks a stale tab from double-applying (idempotency).
      if (
        !sale.deliveryManId ||
        sale.deliveryStatus !== "OUT_FOR_DELIVERY" ||
        sale.paymentMethod !== "CASH"
      ) {
        const err = new Error(
          "لا يمكن تحويل هذا الطلب — يجب أن يكون طلب دليفري نقدي معلق (خارج للتوصيل)",
        );
        err.code = "NOT_CONVERTIBLE";
        throw err;
      }

      const total = Number(sale.total || 0);
      const share = Number(sale.deliveryDriverShare || 0);
      const netDebt = total - share;

      // Resolve the global InstaPay treasury (same routing as routes/sales.js).
      const config = await tx.systemConfiguration.findFirst({
        select: { instapayTreasuryId: true },
      });
      const instapayTreasuryId = config?.instapayTreasuryId;
      if (!instapayTreasuryId) {
        const err = new Error(
          "إعدادات النظام غير مكتملة: لا يوجد خزينة انستاباي مرتبطة لاستلام المدفوعات. يرجى مراجعة المسؤول.",
        );
        err.code = "INSTAPAY_NOT_CONFIGURED";
        throw err;
      }

      // 1. Full order total into the InstaPay treasury.
      await tx.treasury.update({
        where: { id: instapayTreasuryId },
        data: { balance: { increment: total } },
      });

      // 2. Net the wallet by the full total: reverses the dispatch cash debt
      //    (netDebt) AND credits the rider their share as dues (−share).
      await tx.deliveryMan.update({
        where: { id: sale.deliveryManId },
        data: { walletBalance: { decrement: total } },
      });

      // 3. Ledger rows — each amount equals its wallet delta, and the dues
      //    ledger (DUES_ACCRUED − DUES_PAYOUT) stays cleanly queryable.
      if (netDebt !== 0) {
        await tx.deliveryManTransaction.create({
          data: {
            deliveryManId: sale.deliveryManId,
            amount: netDebt,
            type: "DEBT_REVERSAL",
            description: `تحويل طلب #${sale.saleNumber} لأنستاباي — عكس عهدة نقدية`,
            createdById: actorId,
          },
        });
      }
      if (share > 0) {
        await tx.deliveryManTransaction.create({
          data: {
            deliveryManId: sale.deliveryManId,
            amount: share,
            type: "DUES_ACCRUED",
            description: `تحويل طلب #${sale.saleNumber} لأنستاباي — حصة مستحقة للطيار`,
            createdById: actorId,
          },
        });
      }

      // 4. Flip the sale + order workflow to delivered/paid via InstaPay.
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          paymentMethod: "INSTAPAY",
          deliveryStatus: "DELIVERED",
          paidAt: now,
        },
      });
      await tx.order.updateMany({
        where: { saleId: sale.id },
        data: { status: "DELIVERED", deliveredAt: now },
      });

      // 5. Deposit row so the InstaPay treasury history / reports show it.
      await tx.deposit.create({
        data: {
          amount: total,
          description: `تحويل دفع لأنستاباي — طلب #${sale.saleNumber}`,
          date: now,
          treasuryId: instapayTreasuryId,
          createdById: actorId,
          source: "DRIVER_SETTLEMENT",
        },
      });

      return { saleNumber: sale.saleNumber, total, share, branchId: sale.branchId };
    });

    // Post-commit immutable audit trail for the payment-method change.
    await writeAudit({
      action: "UPDATE",
      targetEntity: "sale",
      targetId: saleId,
      userId: actorId,
      branchId: result.branchId ?? null,
      oldValues: { paymentMethod: "CASH", deliveryStatus: "OUT_FOR_DELIVERY" },
      newValues: {
        paymentMethod: "INSTAPAY",
        deliveryStatus: "DELIVERED",
        reason: "delivery_instapay_conversion",
        total: result.total,
        riderShareAccrued: result.share,
      },
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (error) {
    if (error?.code === "NOT_CONVERTIBLE") {
      return res.status(409).json({ error: error.message, code: "NOT_CONVERTIBLE" });
    }
    if (error?.code === "INSTAPAY_NOT_CONFIGURED") {
      return res
        .status(422)
        .json({ error: error.message, code: "INSTAPAY_NOT_CONFIGURED" });
    }
    console.error("❌ Error converting delivery sale to InstaPay:", error);
    res.status(500).json({ error: "Failed to convert sale to InstaPay" });
  }
};

// Pay a rider their accrued online dues (share on InstaPay-converted orders)
// out of the branch cash treasury. Settles a credit that the normal settle path
// can't — that path requires pending OUT_FOR_DELIVERY sales.
exports.payDeliveryManDues = async (req, res) => {
  try {
    const deliveryManId = parseInt(req.params.id);
    const actorId = req.user?.id || (req.body?.userId ? parseInt(req.body.userId) : null);
    const requested = req.body?.amount != null ? Number(req.body.amount) : null;
    if (!deliveryManId) {
      return res.status(400).json({ error: "Delivery Man ID is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      const driver = await tx.deliveryMan.findUnique({
        where: { id: deliveryManId },
        include: { branch: { select: { treasuryId: true } } },
      });
      if (!driver || !driver.branch?.treasuryId) {
        throw new Error("Driver not found or branch has no associated treasury");
      }
      const treasuryId = driver.branch.treasuryId;

      // Trust the ledger: dues = Σ DUES_ACCRUED − Σ DUES_PAYOUT.
      const grouped = await tx.deliveryManTransaction.groupBy({
        by: ["type"],
        where: { deliveryManId, type: { in: ["DUES_ACCRUED", "DUES_PAYOUT"] } },
        _sum: { amount: true },
      });
      let accrued = 0;
      let paid = 0;
      for (const g of grouped) {
        const v = Number(g._sum.amount || 0);
        if (g.type === "DUES_ACCRUED") accrued = v;
        else if (g.type === "DUES_PAYOUT") paid = v;
      }
      const dues = accrued - paid;

      if (dues <= 0.001) {
        const err = new Error("لا يوجد مستحق للطيار");
        err.code = "NO_DUES";
        throw err;
      }

      const amount =
        requested != null && requested > 0 ? Math.min(requested, dues) : dues;

      // 1. Pay from the branch cash treasury.
      await tx.treasury.update({
        where: { id: treasuryId },
        data: { balance: { decrement: amount } },
      });

      // 2. Return the credit to the wallet ledger.
      await tx.deliveryMan.update({
        where: { id: deliveryManId },
        data: { walletBalance: { increment: amount } },
      });

      // 3. Ledger + treasury audit rows.
      await tx.deliveryManTransaction.create({
        data: {
          deliveryManId,
          amount,
          type: "DUES_PAYOUT",
          description: req.body?.notes || "صرف مستحق طيار (حصص أونلاين)",
          createdById: actorId,
        },
      });
      await tx.withdrawal.create({
        data: {
          amount,
          description: `صرف مستحق طيار — ${driver.name}`,
          date: now,
          treasuryId,
          createdById: actorId,
          // DRIVER_DUES: already subtracted from expected cash via the
          // DUES_PAYOUT ledger in calculateSystemExpectedCash — must not be
          // subtracted a second time as a manual withdrawal.
          source: "DRIVER_DUES",
        },
      });

      return {
        deliveryManId,
        amountPaid: amount,
        remainingDues: dues - amount,
        treasuryId,
      };
    });

    res.json(result);
  } catch (error) {
    if (error?.code === "NO_DUES") {
      return res.status(409).json({ error: error.message, code: "NO_DUES" });
    }
    console.error("❌ Error paying delivery man dues:", error);
    res.status(500).json({ error: "Failed to pay delivery man dues" });
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
        paymentMethod: true,
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
      const netDebt = total - share;

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
      const netDebt = total - share;

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
