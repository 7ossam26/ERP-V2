const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");

// Helper function to generate unique sale number
const generateSaleNumber = async () => {
  try {
    console.log("🔢 Generating sale number...");

    // Debug prisma instance
    if (!prisma) {
      console.error("❌ Prisma instance is UNDEFINED");
      throw new Error("Prisma instance is undefined");
    }
    if (!prisma.sale) {
      console.error(
        "❌ prisma.sale is UNDEFINED. Available models:",
        Object.keys(prisma).filter((k) => !k.startsWith("_")),
      );
      throw new Error("prisma.sale model is missing");
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Get the count of sales for this month
    const startOfMonth = new Date(year, now.getMonth(), 1);
    const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

    const count = await prisma.sale.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const sequence = String(count + 1).padStart(5, "0");
    return `SALE-${year}${month}-${sequence}`;
  } catch (error) {
    console.error("Error generating sale number:", error);
    // Fallback to timestamp-based number if count fails
    return `SALE-${Date.now()}`;
  }
};

// GET all sales - Requires SALES permission
router.get(
  "/",
  authenticateToken,
  requireAnyPermission(["SALES", "REPORTS"]),
  async (req, res, next) => {
    try {
      const branchFilter = await getUserBranchFilter(req.user.id);
      const whereClause = branchFilter ? { branchId: branchFilter.id } : {};

      const sales = await prisma.sale.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          client: true,
          employee: true,
          branch: true,
          treasury: true,
          items: {
            include: {
              item: true,
            },
          },
        },
      });
      res.json(sales);
    } catch (error) {
      next(error);
    }
  },
);

// GET sale by ID - Requires SALES or POS permission
router.get(
  "/:id",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    // If id is "search", skip to the search route defined below
    if (req.params.id === "search") return next("route");
    try {
      const sale = await prisma.sale.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          client: true,
          employee: true,
          branch: true,
          treasury: true,
          items: {
            include: {
              item: true,
            },
          },
        },
      });
      if (!sale) {
        return res.status(404).json({
          error: "Sale not found",
          resolution:
            "The sale may have been deleted. Please refresh the page and try again.",
        });
      }
      res.json(sale);
    } catch (error) {
      next(error);
    }
  },
);

// GET search sales - Requires SALES or POS permission
router.get(
  "/search",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      const { query } = req.query;

      if (!query || query.trim().length === 0) {
        return res.json([]);
      }

      const searchTerm = query.trim();
      const branchFilter = await getUserBranchFilter(req.user.id);

      const whereClause = {
        OR: [
          { saleNumber: { contains: searchTerm } },
          { client: { name: { contains: searchTerm } } },
          { client: { phoneNumber: { contains: searchTerm } } },
        ],
      };

      // Add branch filter if applicable
      if (branchFilter) {
        whereClause.branchId = branchFilter.id;
      }

      const sales = await prisma.sale.findMany({
        where: whereClause,
        take: 20, // Limit results
        orderBy: { createdAt: "desc" },
        include: {
          client: true,
          employee: true,
          branch: true,
          treasury: true,
          items: {
            include: {
              item: true,
            },
          },
        },
      });

      res.json(sales);
    } catch (error) {
      next(error);
    }
  }
);

// GET sale by sale number - Requires SALES or POS permission
router.get(
  "/number/:saleNumber",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      const sale = await prisma.sale.findUnique({
        where: { saleNumber: req.params.saleNumber },
        include: {
          client: true,
          employee: true,
          branch: true,
          treasury: true,
          items: {
            include: {
              item: true,
            },
          },
        },
      });

      if (!sale) {
        return res.status(404).json({
          error: "Sale not found",
          resolution:
            "The sale number may be incorrect. Please check and try again.",
        });
      }

      res.json(sale);
    } catch (error) {
      next(error);
    }
  },
);

// POST create new sale - Requires SALES OR POS permission
router.post(
  "/",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      // console.log("💰 ============ SALES API CALLED ============");
      // console.log("💰 Request body:", JSON.stringify(req.body, null, 2));

      const {
        clientId,
        employeeId,
        userId, // New field
        deliveryManId, // Delivery fields
        deliveryZoneId,
        deliveryFee,
        deliveryAddress,
        deliveryStatus,
        paymentMethod,
        subtotal,
        taxRate,
        taxAmount,
        total,
        paidAmount,
        changeAmount,
        status,
        notes,
        items,
      } = req.body;

      console.log("💰 Step 1: Validating required fields...");

      // Validation
      if (!clientId) {
        console.error("❌ Validation failed: Client is required");
        return res.status(400).json({
          error: "Client is required",
          resolution:
            "Please select a client from the dropdown before submitting the sale.",
        });
      }
      console.log(`✅ Client ID: ${clientId}`);

      if (!items || items.length === 0) {
        console.error("❌ Validation failed: At least one item is required");
        return res.status(400).json({
          error: "At least one item is required",
          resolution:
            "Add at least one product to the cart before completing the sale.",
        });
      }
      console.log(`✅ Items count: ${items.length}`);

      let branchId, treasuryId, warehouseId;
      let finalEmployeeId = employeeId ? parseInt(employeeId) : null;
      let finalUserId = userId ? parseInt(userId) : null;

      console.log("💰 Step 2: Determining Sales Context (User vs Employee)...");

      if (finalUserId) {
        // --- USER BASED SALE ---
        console.log(
          `👤 Processing as User-based Sale (User ID: ${finalUserId})`,
        );
        const user = await prisma.user.findUnique({
          where: { id: finalUserId },
          include: {
            branch: {
              include: {
                treasury: true,
                warehouse: true,
              },
            },
          },
        });

        if (!user) {
          return res.status(404).json({
            error: `User not found with ID: ${finalUserId}`,
            resolution:
              "Your user account may have been removed. Please contact your administrator.",
          });
        }

        if (!user.branch) {
          return res.status(400).json({
            error: `User "${user.name}" is not assigned to any branch.`,
            resolution:
              "Contact your superadmin to assign you to a branch before making sales.",
          });
        }

        branchId = user.branchId;
        treasuryId = user.branch.treasuryId; // Default to branch treasury
        warehouseId = user.branch.warehouseId; // Default to branch warehouse

        console.log(`✅ User context resolved: Branch ${user.branch.name}`);
      } else if (finalEmployeeId) {
        // --- EMPLOYEE BASED SALE (Legacy) ---
        console.log(
          `👷 Processing as Employee-based Sale (Employee ID: ${finalEmployeeId})`,
        );
        const employee = await prisma.employee.findUnique({
          where: { id: finalEmployeeId },
          include: {
            branch: {
              include: {
                treasury: true,
                warehouse: true,
              },
            },
          },
        });

        if (!employee) {
          return res.status(404).json({
            error: `Employee not found with ID: ${finalEmployeeId}`,
            resolution:
              "The employee record may have been deleted. Please refresh and try again.",
          });
        }

        if (!employee.branch) {
          return res.status(400).json({
            error: `Employee "${employee.name}" must be assigned to a branch`,
            resolution:
              "Contact your administrator to assign this employee to a branch.",
          });
        }

        branchId = employee.branchId;
        treasuryId = employee.branch.treasuryId;
        warehouseId = employee.branch.warehouseId;

        console.log(
          `✅ Employee context resolved: Branch ${employee.branch.name}`,
        );
      } else {
        return res.status(400).json({
          error: "Either User ID or Employee ID is required to process a sale",
          resolution:
            "Please ensure you are logged in properly or contact technical support.",
        });
      }

      // console.log(`💰 Step 3: Branch configuration:`);
      // console.log(`  - Branch ID: ${branchId}`);
      // console.log(`  - Treasury ID: ${treasuryId}`);
      // console.log(`  - Warehouse ID: ${warehouseId}`);

      // --- CHECK ACTIVE SHIFT ---
      console.log("💰 Step 3.5: Checking for Active Shift...");
      let shiftId = null;
      if (finalUserId) {
        let activeShift = await prisma.shift.findFirst({
          where: {
            userId: finalUserId,
            status: "OPEN",
          },
        });

        if (!activeShift) {
          console.log("⚠️ No active shift found. Auto-starting new shift...");
          activeShift = await prisma.shift.create({
            data: {
              userId: finalUserId,
              branchId: branchId, // Use resolved branchId
              startTime: new Date(),
              status: "OPEN",
              startCash: 0, // Default 0 for auto-start
            },
          });
          console.log(`✅ Auto-started Shift ID: ${activeShift.id}`);
        } else {
          console.log(`✅ Found Active Shift ID: ${activeShift.id}`);
        }
        shiftId = activeShift.id;
      }
      // ---------------------------

      console.log("💰 Step 4: Generating sale number...");
      // Generate unique sale number
      const saleNumber = await generateSaleNumber();
      console.log(`✅ Generated sale number: ${saleNumber}`);

      console.log(
        "💰 Step 5: Executing Transaction (Create Sale + Update Treasury)...",
      );

      // EXECUTE TRANSACTION
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create Sale
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            clientId: parseInt(clientId),
            employeeId: finalEmployeeId,
            userId: finalUserId,
            branchId,
            treasuryId,
            warehouseId,
            shiftId, // Link Sale to Shift
            deliveryManId: deliveryManId ? parseInt(deliveryManId) : null,
            deliveryZoneId: deliveryZoneId ? parseInt(deliveryZoneId) : null,
            deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null,
            deliveryAddress: deliveryAddress || null,
            deliveryStatus: deliveryStatus || null,
            subtotal: parseFloat(subtotal),
            taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.14,
            taxAmount: parseFloat(taxAmount),
            total: parseFloat(total),
            paymentMethod: paymentMethod || "CASH",
            paidAmount: parseFloat(paidAmount),
            changeAmount: parseFloat(changeAmount) || 0,
            status: status || "COMPLETED",
            notes,
            items: {
              create: items.map((item) => ({
                itemId: parseInt(item.itemId),
                quantity: parseFloat(item.quantity),
                unitPrice: parseFloat(item.unitPrice),
                total: parseFloat(item.total),
              })),
            },
          },
          include: {
            client: true,
            employee: true,
            user: true,
            branch: true,
            treasury: true,
            warehouse: true,
            deliveryMan: true,
            deliveryZone: true,
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // 2. Update Treasury/Bank Balance
        const method = (paymentMethod || "CASH").toUpperCase();

        // Skip treasury update for delivery orders (money still with rider)
        const isDeliveryOrder =
          sale.deliveryStatus === "OUT_FOR_DELIVERY" && sale.deliveryManId;

        if (isDeliveryOrder) {
          const totalDebt = parseFloat(total) + (deliveryFee ? parseFloat(deliveryFee) : 0);
          console.log(`🚚 Delivery order detected. Adding to Driver Wallet: ${totalDebt} (Total: ${total} + Fee: ${deliveryFee})`);

          await tx.deliveryMan.update({
            where: { id: parseInt(sale.deliveryManId) },
            data: { walletBalance: { increment: totalDebt } },
          });

          await tx.deliveryManTransaction.create({
            data: {
              deliveryManId: parseInt(sale.deliveryManId),
              amount: parseFloat(total),
              type: "DEBT_ACCRUED",
              description: `Order #${saleNumber} Debt`,
              createdById: finalUserId || null,
            },
          });
        } else if (method === "CASH") {
          console.log(
            `💰 Payment is CASH. Updating Branch Treasury ID ${treasuryId}...`,
          );
          await tx.treasury.update({
            where: { id: treasuryId },
            data: { balance: { increment: parseFloat(total) } },
          });
          console.log("✅ Branch Treasury balance updated.");
        } else if (method === "CARD" || method === "VISA") {
          console.log(`💳 Payment is ${method}. Checking for Bank Treasury...`);

          // Fetch System Configuration for Bank Treasury ID
          const config = await tx.systemConfiguration.findFirst({
            select: { bankTreasuryId: true },
          });

          if (config && config.bankTreasuryId) {
            console.log(`   Found Bank Treasury ID: ${config.bankTreasuryId}`);

            await tx.treasury.update({
              where: { id: config.bankTreasuryId },
              data: { balance: { increment: parseFloat(total) } },
            });
            console.log("✅ Bank Treasury balance updated.");
          } else {
            console.error("❌ Bank Treasury NOT configured!");
            throw new Error(
              "إعدادات النظام غير مكتملة: لا يوجد خزينة بنك مرتبطة لاستلام مدفوعات الفيزا. يرجى مراجعة المسؤول.",
            );
          }
        } else {
          console.log(`ℹ️ Payment is ${paymentMethod}. Balances NOT updated.`);
        }

        // 3. Update Inventory & Check Stock
        for (const item of items) {
          const inventory = await tx.inventory.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: parseInt(item.itemId),
                warehouseId: warehouseId,
              },
            },
            include: { item: true },
          });

          if (!inventory || inventory.quantity < item.quantity) {
            const itemName = inventory?.item?.name || `Item #${item.itemId}`;
            const available = inventory ? inventory.quantity : 0;
            const error = new Error(
              `Insufficient stock for ${itemName}. Available: ${available}, Requested: ${item.quantity}`,
            );
            error.resolution = `Check the inventory for ${itemName} or reduce the quantity. You may also need to create a purchase order to restock.`;
            throw error;
          }

          // Decrement stock
          const updatedInventory = await tx.inventory.update({
            where: {
              itemId_warehouseId: {
                itemId: parseInt(item.itemId),
                warehouseId: warehouseId,
              },
            },
            data: { quantity: { decrement: parseFloat(item.quantity) } },
          });

          // Check Low Stock Warning
          if (updatedInventory.quantity <= (inventory.item.reorderPoint || 0)) {
            // We can't easily return this from the transaction return value directly if we return 'sale'
            // So we'll attach it to the sale object strictly for the response,
            // or we handle warnings outside.
            // Let's attach a temporary property to the result object.
            if (!sale.warnings) sale.warnings = [];
            sale.warnings.push(
              `Low stock warning: ${inventory.item.name} is now at ${updatedInventory.quantity}`,
            );
          }
        }

        return sale;
      });

      // console.log(
      //   "✅✅✅ Transaction completed successfully! Sale ID:",
      //   result.id
      // );
      // console.log("============================================");
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH mark delivery as collected - Requires POS permission
router.patch(
  "/:id/mark-delivered",
  authenticateToken,
  requireAnyPermission(["POS", "SALES"]),
  async (req, res, next) => {
    try {
      const saleId = parseInt(req.params.id);

      // Fetch the sale to verify it's a delivery order
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          branch: { include: { treasury: true } },
        },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!sale.deliveryManId) {
        return res.status(400).json({ error: "This is not a delivery order" });
      }

      // Execute transaction: Update delivery status + Update treasury
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update delivery status to DELIVERED
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            deliveryStatus: "DELIVERED",
          },
          include: {
            client: true,
            deliveryMan: true,
            deliveryZone: true,
          },
        });

        return updatedSale;
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// PUT update sale - Requires SALES permission
router.put(
  "/:id",
  authenticateToken,
  requirePermission("SALES"),
  async (req, res) => {
    try {
      const {
        clientId,
        employeeId,
        paymentMethod,
        subtotal,
        taxRate,
        taxAmount,
        total,
        paidAmount,
        changeAmount,
        status,
        notes,
        items,
      } = req.body;
      const saleId = parseInt(req.params.id);

      const sale = await prisma.$transaction(async (prisma) => {
        // 1. Update basic fields
        await prisma.sale.update({
          where: { id: saleId },
          data: {
            clientId: clientId ? parseInt(clientId) : undefined,
            employeeId: employeeId ? parseInt(employeeId) : undefined,
            paymentMethod,
            subtotal: subtotal !== undefined ? parseFloat(subtotal) : undefined,
            taxRate: taxRate !== undefined ? parseFloat(taxRate) : undefined,
            taxAmount:
              taxAmount !== undefined ? parseFloat(taxAmount) : undefined,
            total: total !== undefined ? parseFloat(total) : undefined,
            paidAmount:
              paidAmount !== undefined ? parseFloat(paidAmount) : undefined,
            changeAmount:
              changeAmount !== undefined ? parseFloat(changeAmount) : undefined,
            status,
            notes,
          },
        });

        // 2. Update items if provided
        if (items) {
          await prisma.saleItem.deleteMany({
            where: { saleId },
          });

          if (items.length > 0) {
            await prisma.saleItem.createMany({
              data: items.map((item) => ({
                saleId,
                itemId: parseInt(item.itemId),
                quantity: parseFloat(item.quantity),
                unitPrice: parseFloat(item.unitPrice),
                total: parseFloat(item.total),
              })),
            });
          }
        }

        // 3. Return updated sale with relations
        return await prisma.sale.findUnique({
          where: { id: saleId },
          include: {
            client: true,
            employee: true,
            branch: true,
            treasury: true,
            items: {
              include: {
                item: true,
              },
            },
          },
        });
      });

      res.json(sale);
    } catch (error) {
      next(error);
    }
  },
);

// POST refund sale - Requires SALES or POS permission + Manager Authentication
router.post(
  "/refund",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      const { saleId, items, managerUsername, managerPassword, notes } =
        req.body;

      // Validation
      if (!saleId || !items || items.length === 0) {
        return res.status(400).json({
          error: "Sale ID and items are required",
          resolution:
            "Please provide a valid sale ID and at least one item to refund.",
        });
      }

      if (!managerUsername || !managerPassword) {
        return res.status(400).json({
          error: "Manager authentication is required",
          resolution:
            "Please provide manager credentials to authorize the refund.",
        });
      }

      // Verify manager credentials
      const bcrypt = require("bcryptjs");
      const manager = await prisma.user.findUnique({
        where: { username: managerUsername },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!manager) {
        return res.status(401).json({
          error: "Invalid manager credentials",
          resolution: "Please check the username and try again.",
        });
      }

      const isValidPassword = await bcrypt.compare(
        managerPassword,
        manager.password,
      );
      if (!isValidPassword) {
        return res.status(401).json({
          error: "Invalid manager credentials",
          resolution: "Incorrect password. Please try again.",
        });
      }

      // Check if manager has appropriate role
      const allowedRoles = ["Superadmin", "Manager", "Branch Manager"];
      const isAuthorized = allowedRoles.includes(manager.role.name);

      if (!isAuthorized) {
        return res.status(403).json({
          error: "Access denied. Role not authorized.",
          resolution:
            "Only Branch Managers, Managers, or Superadmins can authorize refunds.",
        });
      }

      // Fetch original sale
      const originalSale = await prisma.sale.findUnique({
        where: { id: parseInt(saleId) },
        include: {
          items: {
            include: {
              item: true,
            },
          },
        },
      });

      if (!originalSale) {
        return res.status(404).json({
          error: "Original sale not found",
          resolution:
            "The sale may have been deleted. Please verify the sale number.",
        });
      }

      console.log("💰 Starting refund transaction for sale ID:", saleId);

      // Execute refund transaction
      const result = await prisma.$transaction(async (tx) => {
        let refundSubtotal = 0;

        // Calculate refund amounts and validate quantities
        for (const refundItem of items) {
          const originalItem = originalSale.items.find(
            (i) => i.itemId === parseInt(refundItem.itemId),
          );

          if (!originalItem) {
            throw new Error(
              `Item ${refundItem.itemId} was not in the original sale`,
            );
          }

          if (
            parseFloat(refundItem.quantity) > parseFloat(originalItem.quantity)
          ) {
            throw new Error(
              `Refund quantity for ${originalItem.item.name} exceeds original quantity`,
            );
          }

          refundSubtotal +=
            parseFloat(originalItem.unitPrice) *
            parseFloat(refundItem.quantity);

          // Restore inventory
          await tx.inventory.upsert({
            where: {
              itemId_warehouseId: {
                itemId: parseInt(refundItem.itemId),
                warehouseId: originalSale.warehouseId,
              },
            },
            update: {
              quantity: { increment: parseFloat(refundItem.quantity) },
            },
            create: {
              itemId: parseInt(refundItem.itemId),
              warehouseId: originalSale.warehouseId,
              quantity: parseFloat(refundItem.quantity),
            },
          });
        }

        // Calculate tax and total
        const taxRate = parseFloat(originalSale.taxRate);
        const taxAmount = refundSubtotal * taxRate;
        const total = refundSubtotal + taxAmount;

        // Generate refund sale number
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const refundCount = await tx.sale.count({
          where: {
            saleNumber: { startsWith: `REFUND-${year}${month}` },
          },
        });
        const refundNumber = `REFUND-${year}${month}-${String(refundCount + 1).padStart(5, "0")}`;

        // Create negative sale record for the refund
        const refundSale = await tx.sale.create({
          data: {
            saleNumber: refundNumber,
            clientId: originalSale.clientId,
            employeeId: originalSale.employeeId,
            userId: originalSale.userId,
            branchId: originalSale.branchId,
            treasuryId: originalSale.treasuryId,
            warehouseId: originalSale.warehouseId,
            shiftId: originalSale.shiftId,
            subtotal: -refundSubtotal, // Negative for refund
            taxRate: taxRate,
            taxAmount: -taxAmount, // Negative for refund
            total: -total, // Negative for refund
            paymentMethod: originalSale.paymentMethod,
            paidAmount: -total, // Negative for refund
            changeAmount: 0,
            status: "COMPLETED",
            notes: notes
              ? `استرجاع من فاتورة ${originalSale.saleNumber}: ${notes}`
              : `استرجاع من فاتورة ${originalSale.saleNumber}`,
            items: {
              create: items.map((item) => {
                const originalItem = originalSale.items.find(
                  (i) => i.itemId === parseInt(item.itemId),
                );
                return {
                  itemId: parseInt(item.itemId),
                  quantity: -parseFloat(item.quantity), // Negative for refund
                  unitPrice: parseFloat(originalItem.unitPrice),
                  total:
                    -parseFloat(originalItem.unitPrice) *
                    parseFloat(item.quantity), // Negative
                };
              }),
            },
          },
          include: {
            client: true,
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        console.log(
          "💰 Refund sale created successfully. Now processing treasury refund...",
        );

        // Refund treasury balance
        const method = (originalSale.paymentMethod || "CASH").toUpperCase();
        console.log(`   Payment method: ${method}, Amount to refund: ${total}`);

        if (method === "CASH") {
          await tx.treasury.update({
            where: { id: originalSale.treasuryId },
            data: { balance: { decrement: total } },
          });
        } else if (method === "CARD" || method === "VISA") {
          const config = await tx.systemConfiguration.findFirst({
            select: { bankTreasuryId: true },
          });
          if (config && config.bankTreasuryId) {
            await tx.treasury.update({
              where: { id: config.bankTreasuryId },
              data: { balance: { decrement: total } },
            });
          }
        }

        return refundSale;
      });

      console.log(`✅ Refund completed successfully: ${result.saleNumber}`);
      res.status(201).json(result);
    } catch (error) {
      console.error("❌ Refund error:", error.message);
      console.error("❌ Error stack:", error.stack);
      next(error);
    }
  },
);

// DELETE sale - Requires SALES permission
router.delete(
  "/:id",
  authenticateToken,
  requirePermission("SALES"),
  async (req, res) => {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Fetch Sale with Items
        const sale = await tx.sale.findUnique({
          where: { id: parseInt(req.params.id) },
          include: { items: true },
        });

        if (!sale) {
          throw new Error("Sale not found");
        }

        // 2. Restock Items (Increment Inventory)
        if (sale.items && sale.items.length > 0) {
          for (const item of sale.items) {
            // Find appropriate warehouse (Sale has warehouseId)
            const warehouseId = sale.warehouseId;
            if (warehouseId) {
              await tx.inventory.upsert({
                where: {
                  itemId_warehouseId: {
                    itemId: item.itemId,
                    warehouseId: warehouseId,
                  },
                },
                update: {
                  quantity: { increment: Number(item.quantity) },
                },
                create: {
                  itemId: item.itemId,
                  warehouseId: warehouseId,
                  quantity: Number(item.quantity),
                },
              });
            }
          }
        }

        // 3. Refund Treasury (If paid)
        if (Number(sale.paidAmount) > 0) {
          const method = sale.paymentMethod;

          if (method === "CASH" && sale.treasuryId) {
            await tx.treasury.update({
              where: { id: sale.treasuryId },
              data: { balance: { decrement: Number(sale.paidAmount) } },
            });
          } else if (method === "CARD" || method === "VISA") {
            // Find Bank Treasury
            const config = await tx.systemConfiguration.findFirst({
              select: { bankTreasuryId: true },
            });
            if (config && config.bankTreasuryId) {
              await tx.treasury.update({
                where: { id: config.bankTreasuryId },
                data: { balance: { decrement: Number(sale.paidAmount) } },
              });
            }
          }
        }

        // 4. Delete Sale
        await tx.sale.delete({
          where: { id: parseInt(req.params.id) },
        });
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
