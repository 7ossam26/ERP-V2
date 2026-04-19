const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");
const { createOrderInTx } = require("../lib/orderService");

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
      const branchFilter = await getUserBranchFilter(req.user.id, req);
      const whereClause = {};
      if (branchFilter) {
        if (branchFilter.id.in) {
          // Multi-branch user (e.g., General Manager)
          whereClause.branchId = { in: branchFilter.id.in };
        } else {
          // Single-branch user
          whereClause.branchId = branchFilter.id;
        }
      }

      // Optional: filter by order channel (source)
      const { source } = req.query;
      if (source && source !== "all") {
        // Join through Order to filter by channel
        const matchingOrderSaleIds = await prisma.order.findMany({
          where: { channel: source.toUpperCase() },
          select: { saleId: true },
        });
        const saleIds = matchingOrderSaleIds.map((o) => o.saleId);
        whereClause.id = { in: saleIds };
      }

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
          order: { select: { channel: true } },
        },
      });
      res.json(sales);
    } catch (error) {
      next(error);
    }
  },
);

// GET recent sales — for return/refund modal (S8)
router.get(
  "/recent",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const branchFilter = await getUserBranchFilter(req.user.id, req);
      const whereClause = { status: "COMPLETED" };
      if (branchFilter) {
        if (branchFilter.id.in) {
          whereClause.branchId = { in: branchFilter.id.in };
        } else {
          whereClause.branchId = branchFilter.id;
        }
      }
      const sales = await prisma.sale.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          client: true,
          items: { include: { item: true } },
        },
      });
      res.json(sales);
    } catch (error) {
      next(error);
    }
  },
);

// GET pending preparation orders (S11 Phase 1 queue) — must be before /:id
router.get(
  "/preparation-queue",
  authenticateToken,
  requireAnyPermission(["POS", "SALES"]),
  async (req, res, next) => {
    try {
      const branchFilter = await getUserBranchFilter(req.user.id, req);
      const whereClause = {
        deliveryStatus: "PENDING",
        deliveryZoneId: { not: null },
        status: "COMPLETED",
      };
      if (branchFilter) {
        whereClause.branchId = branchFilter.id.in
          ? { in: branchFilter.id.in }
          : branchFilter.id;
      }
      const orders = await prisma.sale.findMany({
        where: whereClause,
        orderBy: { createdAt: "asc" }, // Oldest first (FIFO)
        include: {
          client: { select: { name: true, phoneNumber: true } },
          deliveryZone: true,
          items: { include: { item: true, bom: true } },
        },
      });
      res.json(orders);
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

// GET refunds for a shift - Requires SALES or POS permission
router.get(
  "/refunds",
  authenticateToken,
  requireAnyPermission(["SALES", "POS"]),
  async (req, res, next) => {
    try {
      const { shiftId } = req.query;
      if (!shiftId) return res.json([]);

      const refunds = await prisma.sale.findMany({
        where: {
          shiftId: parseInt(shiftId),
          saleNumber: { startsWith: "REFUND-" },
        },
        orderBy: { createdAt: "desc" },
        include: {
          client: true,
          items: { include: { item: true } },
        },
      });
      res.json(refunds);
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
      const branchFilter = await getUserBranchFilter(req.user.id, req);

      const whereClause = {
        OR: [
          { saleNumber: { contains: searchTerm } },
          { client: { name: { contains: searchTerm } } },
          { client: { phoneNumber: { contains: searchTerm } } },
        ],
      };

      // Add branch filter if applicable
      if (branchFilter) {
        if (branchFilter.id.in) {
          // Multi-branch user (e.g., General Manager)
          whereClause.branchId = { in: branchFilter.id.in };
        } else {
          // Single-branch user
          whereClause.branchId = branchFilter.id;
        }
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
  },
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
          // Fall back to system-wide defaults from SystemConfiguration
          const sysConfig = await prisma.systemConfiguration.findFirst({
            where: { id: 1 },
            include: { mainWarehouse: true, mainTreasury: true },
          });

          // Try to find a branch linked to the main warehouse
          const defaultBranch = sysConfig?.mainWarehouseId
            ? await prisma.branch.findFirst({
                where: { warehouseId: sysConfig.mainWarehouseId, isActive: true },
                include: { treasury: true, warehouse: true },
              })
            : null;

          if (!defaultBranch) {
            return res.status(400).json({
              error: `User "${user.name}" is not assigned to any branch.`,
              resolution:
                "Contact your superadmin to assign you to a branch before making sales.",
            });
          }

          branchId = defaultBranch.id;
          treasuryId = defaultBranch.treasuryId || sysConfig.mainTreasuryId;
          warehouseId = defaultBranch.warehouseId || sysConfig.mainWarehouseId;
          console.log(`⚠️ User has no branch — falling back to default branch: ${defaultBranch.name}`);
        } else {
          branchId = user.branchId;
          treasuryId = user.branch.treasuryId;
          warehouseId = user.branch.warehouseId;
          console.log(`✅ User context resolved: Branch ${user.branch.name}`);
        }
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
          const shiftErr = new Error(
            "لا توجد وردية مفتوحة. يرجى فتح وردية أولاً قبل إتمام البيع."
          );
          shiftErr.status = 400;
          throw shiftErr;
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
            paymentMethod: (paymentMethod || "CASH").toUpperCase(),
            paidAmount: parseFloat(paidAmount),
            changeAmount: parseFloat(changeAmount) || 0,
            status: status || "COMPLETED",
            notes,
            items: {
              create: items.map((item) => {
                const isBomOnly = String(item.itemId).startsWith("bom_");
                const bomId = item.bomId
                  ? parseInt(item.bomId)
                  : isBomOnly
                    ? parseInt(String(item.itemId).replace("bom_", ""))
                    : null;
                const itemId = isBomOnly ? null : parseInt(item.itemId);
                return {
                  itemId,
                  bomId,
                  quantity: parseFloat(item.quantity),
                  unitPrice: parseFloat(item.unitPrice),
                  total: parseFloat(item.total),
                };
              }),
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
        // Also skip for PENDING delivery orders (no driver assigned yet — Phase 1 of two-phase delivery)
        const isDeliveryOrderDispatched =
          sale.deliveryStatus === "OUT_FOR_DELIVERY" && sale.deliveryManId;
        const isDeliveryOrderPending =
          sale.deliveryZoneId && sale.deliveryStatus === "PENDING";
        const isDeliveryOrder = isDeliveryOrderDispatched || isDeliveryOrderPending;

        if (isDeliveryOrderDispatched) {
          // ---------------------------------------------------------
          // NEW: Driver Share Logic
          // ---------------------------------------------------------
          let driverShare = 0;
          let netDebt = 0;

          // 1. Fetch Delivery Zone to get the share config
          if (sale.deliveryZoneId) {
            const zone = await tx.deliveryZone.findUnique({
              where: { id: sale.deliveryZoneId },
            });
            if (zone && zone.driverShare) {
              driverShare = Number(zone.driverShare);
            }
          }

          // 2. Update Sale with the calculated share
          if (driverShare > 0) {
            await tx.sale.update({
              where: { id: sale.id },
              data: { deliveryDriverShare: driverShare },
            });
          }

          // 3. Calculate Net Debt for Driver's Wallet
          // Total Cash Held by Driver = Order Total (which includes delivery fee)
          // Driver Earns = driverShare
          // Driver Owes = Total Cash Held - Driver Earns
          const totalCashHeld = parseFloat(total);
          netDebt = totalCashHeld - driverShare;

          console.log(
            `🚚 Delivery Order #${saleNumber} | Zone Share: ${driverShare}`,
          );
          console.log(
            `💰 Driver Wallet Update: Held ${totalCashHeld} - Earned ${driverShare} = Net Debt ${netDebt}`,
          );

          await tx.deliveryMan.update({
            where: { id: parseInt(sale.deliveryManId) },
            data: { walletBalance: { increment: netDebt } },
          });

          await tx.deliveryManTransaction.create({
            data: {
              deliveryManId: parseInt(sale.deliveryManId),
              amount: netDebt, // Recording the DEBT amount (what he owes us)
              type: "DEBT_ACCRUED",
              description: `Order #${saleNumber} Debt (Share deducted: ${driverShare})`,
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
        } else if (method === "INSTAPAY" || method === "CARD" || method === "VISA") {
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
            const cardErr = new Error(
              "إعدادات النظام غير مكتملة: لا يوجد خزينة بنك مرتبطة لاستلام مدفوعات الفيزا. يرجى مراجعة المسؤول.",
            );
            cardErr.status = 422;
            throw cardErr;
          }
        } else {
          console.log(`ℹ️ Payment is ${paymentMethod}. Balances NOT updated.`);
        }

        // 3. Update Inventory & Check Stock (BOM-aware)
        for (const item of items) {
          const isBomOnly = String(item.itemId).startsWith("bom_");
          const saleItemId = isBomOnly ? null : parseInt(item.itemId);
          const saleBomId = item.bomId
            ? parseInt(item.bomId)
            : isBomOnly
              ? parseInt(String(item.itemId).replace("bom_", ""))
              : null;
          const saleQty = parseFloat(item.quantity);

          // Find BOM: first by explicit bomId, then by outputItemId
          let bom = null;
          if (saleBomId) {
            bom = await tx.bOM.findUnique({
              where: { id: saleBomId },
              include: { items: { include: { item: true } } },
            });
          }
          // Intentionally do NOT find BOM by saleItemId.
          // If the item has an outputItemId, it's a manufactured item and we should deduct its own inventory.

          if (bom) {
            // === BOM AUTO-CONSUMPTION ===
            // Deduct raw materials instead of the finished product
            const multiplier = saleQty / Number(bom.outputQuantity);
            console.log(
              `🏭 BOM Sale: ${bom.name} × ${saleQty} (multiplier: ${multiplier})`,
            );

            for (const bomItem of bom.items) {
              const materialQty = Number(bomItem.quantity) * multiplier;
              const materialInventory = await tx.inventory.findUnique({
                where: {
                  itemId_warehouseId: {
                    itemId: bomItem.itemId,
                    warehouseId: warehouseId,
                  },
                },
                include: { item: true },
              });

              if (
                !materialInventory ||
                Number(materialInventory.quantity) < materialQty
              ) {
                const matName = bomItem.item.name;
                const available = materialInventory
                  ? Number(materialInventory.quantity)
                  : 0;
                const error = new Error(
                  `Insufficient raw material: ${matName}. Available: ${available}, Required: ${materialQty.toFixed(2)}`,
                );
                error.resolution = `Check the inventory for raw material "${matName}" or reduce the quantity. You may need to purchase more stock.`;
                throw error;
              }

              // Decrement raw material stock
              const updatedMaterialInv = await tx.inventory.update({
                where: {
                  itemId_warehouseId: {
                    itemId: bomItem.itemId,
                    warehouseId: warehouseId,
                  },
                },
                data: { quantity: { decrement: materialQty } },
              });

              console.log(
                `   📦 Deducted ${materialQty.toFixed(2)} of ${bomItem.item.name} (remaining: ${updatedMaterialInv.quantity})`,
              );

              // Low stock warning for raw materials
              if (
                Number(updatedMaterialInv.quantity) <=
                (bomItem.item.reorderPoint || 0)
              ) {
                if (!sale.warnings) sale.warnings = [];
                sale.warnings.push(
                  `Low stock warning: ${bomItem.item.name} is now at ${updatedMaterialInv.quantity}`,
                );
              }
            }
          } else if (saleItemId) {
            // === DIRECT ITEM DEDUCTION (no BOM, only if we have a real itemId) ===
            let inventory = await tx.inventory.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: saleItemId,
                  warehouseId: warehouseId,
                },
              },
              include: { item: true },
            });

            const currentQty = inventory ? Number(inventory.quantity) : 0;

            if (currentQty < saleQty) {
              const itemName = inventory?.item?.name || `Item #${item.itemId}`;
              const needed = saleQty - currentQty;

              // B2: Auto-produce if a BOM exists for this item
              const autoBom = await tx.bOM.findFirst({
                where: { outputItemId: saleItemId },
                include: { items: { include: { item: true } } },
              });

              if (autoBom) {
                const outputPerRun = Number(autoBom.outputQuantity);
                const runsNeeded = Math.ceil(needed / outputPerRun);
                const totalProduced = runsNeeded * outputPerRun;

                // Check raw material availability
                const missingMaterials = [];
                for (const bomItem of autoBom.items) {
                  const materialQty = Number(bomItem.quantity) * runsNeeded;
                  const matInv = await tx.inventory.findUnique({
                    where: {
                      itemId_warehouseId: {
                        itemId: bomItem.itemId,
                        warehouseId: warehouseId,
                      },
                    },
                    include: { item: true },
                  });
                  const matAvail = matInv ? Number(matInv.quantity) : 0;
                  if (matAvail < materialQty) {
                    missingMaterials.push({
                      name: bomItem.item.name,
                      required: materialQty,
                      available: matAvail,
                    });
                  }
                }

                if (missingMaterials.length > 0) {
                  const matList = missingMaterials
                    .map(
                      (m) =>
                        `${m.name} (متاح: ${Number(m.available).toFixed(2)}, مطلوب: ${Number(m.required).toFixed(2)})`,
                    )
                    .join("، ");
                  const error = new Error(
                    `لا يمكن إنتاج "${itemName}" تلقائياً — مواد خام غير كافية: ${matList}`,
                  );
                  error.missingMaterials = missingMaterials;
                  throw error;
                }

                // Deduct raw materials
                for (const bomItem of autoBom.items) {
                  const materialQty = Number(bomItem.quantity) * runsNeeded;
                  await tx.inventory.update({
                    where: {
                      itemId_warehouseId: {
                        itemId: bomItem.itemId,
                        warehouseId: warehouseId,
                      },
                    },
                    data: { quantity: { decrement: materialQty } },
                  });
                }

                // Add produced quantity to inventory
                if (inventory) {
                  inventory = await tx.inventory.update({
                    where: {
                      itemId_warehouseId: {
                        itemId: saleItemId,
                        warehouseId: warehouseId,
                      },
                    },
                    data: { quantity: { increment: totalProduced } },
                    include: { item: true },
                  });
                } else {
                  inventory = await tx.inventory.create({
                    data: {
                      itemId: saleItemId,
                      warehouseId: warehouseId,
                      quantity: totalProduced,
                    },
                    include: { item: true },
                  });
                }

                // Create ProductionOrder for audit trail
                const autoTotalCost = autoBom.items.reduce((sum, bi) => {
                  return sum + Number(bi.quantity) * runsNeeded * Number(bi.item.costPrice || 0);
                }, 0);
                await tx.productionOrder.create({
                  data: {
                    bomId: autoBom.id,
                    sourceWarehouseId: warehouseId,
                    destWarehouseId: warehouseId,
                    targetOutputQty: totalProduced,
                    actualOutputQty: totalProduced,
                    outputWasteQty: 0,
                    totalCost: parseFloat(autoTotalCost.toFixed(2)),
                    notes: `إنتاج تلقائي من نقطة البيع - فاتورة رقم ${sale.saleNumber}`,
                    createdById: req.user.id,
                    items: {
                      create: autoBom.items.map((bi) => ({
                        itemId: bi.itemId,
                        quantityUsed: Number(bi.quantity) * runsNeeded,
                      })),
                    },
                  },
                });

                // Record auto-production in warnings for frontend toast
                if (!sale.warnings) sale.warnings = [];
                sale.warnings.push(
                  `AUTO_PRODUCED:${itemName}:${totalProduced.toFixed(2)}`,
                );
                console.log(
                  `🏭 B2 Auto-produced ${totalProduced} of "${itemName}" using BOM "${autoBom.name}"`,
                );
              } else {
                // No BOM available — hard stop
                const error = new Error(
                  `Insufficient stock for ${itemName}. Available: ${currentQty}, Requested: ${saleQty}`,
                );
                error.resolution = `Check the inventory for ${itemName} or reduce the quantity.`;
                throw error;
              }
            }

            // Decrement stock (works whether we just auto-produced or had enough stock)
            const updatedInventory = await tx.inventory.update({
              where: {
                itemId_warehouseId: {
                  itemId: saleItemId,
                  warehouseId: warehouseId,
                },
              },
              data: { quantity: { decrement: saleQty } },
            });

            // Check Low Stock Warning
            if (
              Number(updatedInventory.quantity) <=
              (inventory?.item?.reorderPoint || 0)
            ) {
              if (!sale.warnings) sale.warnings = [];
              sale.warnings.push(
                `Low stock warning: ${inventory?.item?.name || saleItemId} is now at ${updatedInventory.quantity}`,
              );
            }
          }
        }

        // Create matching Order row (workflow layer). POS sales are channel POS.
        // Status mirrors the delivery state: non-delivery POS = DELIVERED immediately.
        let orderStatus = "DELIVERED";
        if (sale.deliveryStatus === "PENDING") orderStatus = "NEW";
        else if (sale.deliveryStatus === "OUT_FOR_DELIVERY") orderStatus = "OUT_FOR_DELIVERY";
        else if (sale.deliveryStatus === "DELIVERED") orderStatus = "DELIVERED";
        else if (sale.deliveryStatus === "RETURNED" || sale.deliveryStatus === "CANCELED") orderStatus = "CANCELLED";

        await createOrderInTx(tx, {
          saleId: sale.id,
          branchId: sale.branchId,
          createdById: finalUserId || 1,
          channel: "POS",
          status: orderStatus,
        });

        // Stamp paidAt for POS payments that are settled at the counter (not in-flight COD).
        if (orderStatus === "DELIVERED") {
          await tx.sale.update({
            where: { id: sale.id },
            data: { paidAt: new Date() },
          });
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

// PATCH dispatch delivery - Assign driver to a PENDING delivery order (Phase 2 of two-phase delivery)
router.patch(
  "/:id/dispatch-delivery",
  authenticateToken,
  requireAnyPermission(["POS", "SALES"]),
  async (req, res, next) => {
    try {
      const saleId = parseInt(req.params.id);
      const { deliveryManId } = req.body;

      if (!deliveryManId) {
        return res
          .status(400)
          .json({ error: "Delivery man ID is required" });
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { deliveryZone: true },
      });

      if (!sale) return res.status(404).json({ error: "Sale not found" });
      if (sale.deliveryStatus !== "PENDING" || !sale.deliveryZoneId) {
        return res.status(400).json({
          error: "This order is not in preparation status",
          message: "هذا الطلب ليس في قسم التجهيز",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Calculate driver share from zone
        let driverShare = 0;
        if (sale.deliveryZone?.driverShare) {
          driverShare = Number(sale.deliveryZone.driverShare);
        }
        const totalCashHeld = parseFloat(sale.total);
        const netDebt = totalCashHeld - driverShare;

        // Assign driver and dispatch
        const updated = await tx.sale.update({
          where: { id: saleId },
          data: {
            deliveryManId: parseInt(deliveryManId),
            deliveryStatus: "OUT_FOR_DELIVERY",
            deliveryDriverShare: driverShare || null,
          },
          include: {
            client: true,
            deliveryMan: true,
            deliveryZone: true,
          },
        });

        // Update driver wallet
        await tx.deliveryMan.update({
          where: { id: parseInt(deliveryManId) },
          data: { walletBalance: { increment: netDebt } },
        });

        await tx.deliveryManTransaction.create({
          data: {
            deliveryManId: parseInt(deliveryManId),
            amount: netDebt,
            type: "DEBT_ACCRUED",
            description: `Order #${sale.saleNumber} Dispatched`,
            createdById: req.user.id,
          },
        });

        return updated;
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
  async (req, res, next) => {
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
              data: items.map((item) => {
                const isBomOnly = String(item.itemId).startsWith("bom_");
                const bomId = item.bomId
                  ? parseInt(item.bomId)
                  : isBomOnly
                    ? parseInt(String(item.itemId).replace("bom_", ""))
                    : null;
                const itemId = isBomOnly ? null : parseInt(item.itemId);
                return {
                  saleId,
                  itemId,
                  bomId,
                  quantity: parseFloat(item.quantity),
                  unitPrice: parseFloat(item.unitPrice),
                  total: parseFloat(item.total),
                };
              }),
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
      const allowedRoles = [
        "Superadmin",
        "Manager",
        "Branch Manager",
        "General Manager",
      ];
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

          // Restore inventory (BOM-aware)
          const refundItemId = parseInt(refundItem.itemId);
          const refundQty = parseFloat(refundItem.quantity);

          // Check if this item is a raw BOM (MTO) vs a manufactured item
          const isBomOnly = String(refundItem.itemId).startsWith("bom_");
          const refundBomId = refundItem.bomId
            ? parseInt(refundItem.bomId)
            : isBomOnly
              ? parseInt(String(refundItem.itemId).replace("bom_", ""))
              : null;
          const refundParsedItemId = isBomOnly
            ? null
            : parseInt(refundItem.itemId);

          let bom = null;
          if (refundBomId) {
            bom = await tx.bOM.findUnique({
              where: { id: refundBomId },
              include: { items: true },
            });
          }

          if (bom) {
            // === BOM REFUND: Restore raw materials ===
            const multiplier = refundQty / Number(bom.outputQuantity);
            for (const bomItem of bom.items) {
              const materialQty = Number(bomItem.quantity) * multiplier;
              await tx.inventory.upsert({
                where: {
                  itemId_warehouseId: {
                    itemId: bomItem.itemId,
                    warehouseId: originalSale.warehouseId,
                  },
                },
                update: {
                  quantity: { increment: materialQty },
                },
                create: {
                  itemId: bomItem.itemId,
                  warehouseId: originalSale.warehouseId,
                  quantity: materialQty,
                },
              });
            }
          } else if (refundParsedItemId) {
            // === DIRECT REFUND (no BOM) ===
            await tx.inventory.upsert({
              where: {
                itemId_warehouseId: {
                  itemId: refundParsedItemId,
                  warehouseId: originalSale.warehouseId,
                },
              },
              update: {
                quantity: { increment: refundQty },
              },
              create: {
                itemId: refundParsedItemId,
                warehouseId: originalSale.warehouseId,
                quantity: refundQty,
              },
            });
          }
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
  async (req, res, next) => {
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
