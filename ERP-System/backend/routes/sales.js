const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

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
        Object.keys(prisma).filter((k) => !k.startsWith("_"))
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

// GET all sales
router.get("/", async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
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
    res
      .status(500)
      .json({ error: "Failed to fetch sales", message: error.message });
  }
});

// GET sale by ID
router.get("/:id", async (req, res) => {
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
      return res.status(404).json({ error: "Sale not found" });
    }
    res.json(sale);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch sale", message: error.message });
  }
});

// POST create new sale
router.post("/", async (req, res) => {
  try {
    console.log("💰 ============ SALES API CALLED ============");
    console.log("💰 Request body:", JSON.stringify(req.body, null, 2));

    const {
      clientId,
      employeeId,
      userId, // New field
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
      return res.status(400).json({ error: "Client is required" });
    }
    console.log(`✅ Client ID: ${clientId}`);

    if (!items || items.length === 0) {
      console.error("❌ Validation failed: At least one item is required");
      return res.status(400).json({ error: "At least one item is required" });
    }
    console.log(`✅ Items count: ${items.length}`);

    let branchId, treasuryId, warehouseId;
    let finalEmployeeId = employeeId ? parseInt(employeeId) : null;
    let finalUserId = userId ? parseInt(userId) : null;

    console.log("💰 Step 2: Determining Sales Context (User vs Employee)...");

    if (finalUserId) {
      // --- USER BASED SALE ---
      console.log(`👤 Processing as User-based Sale (User ID: ${finalUserId})`);
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
        return res
          .status(404)
          .json({ error: `User not found with ID: ${finalUserId}` });
      }

      if (!user.branch) {
        return res.status(400).json({
          error: `User "${user.name}" is not assigned to any branch. Please contact superadmin.`,
        });
      }

      branchId = user.branchId;
      treasuryId = user.branch.treasuryId; // Default to branch treasury
      warehouseId = user.branch.warehouseId; // Default to branch warehouse

      console.log(`✅ User context resolved: Branch ${user.branch.name}`);
    } else if (finalEmployeeId) {
      // --- EMPLOYEE BASED SALE (Legacy) ---
      console.log(
        `👷 Processing as Employee-based Sale (Employee ID: ${finalEmployeeId})`
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
        return res
          .status(404)
          .json({ error: `Employee not found with ID: ${finalEmployeeId}` });
      }

      if (!employee.branch) {
        return res.status(400).json({
          error: `Employee "${employee.name}" must be assigned to a branch`,
        });
      }

      branchId = employee.branchId;
      treasuryId = employee.branch.treasuryId;
      warehouseId = employee.branch.warehouseId;

      console.log(
        `✅ Employee context resolved: Branch ${employee.branch.name}`
      );
    } else {
      return res.status(400).json({
        error: "Either User ID or Employee ID is required to process a sale",
      });
    }

    console.log(`💰 Step 3: Branch configuration:`);
    console.log(`  - Branch ID: ${branchId}`);
    console.log(`  - Treasury ID: ${treasuryId}`);
    console.log(`  - Warehouse ID: ${warehouseId}`);

    console.log("💰 Step 4: Generating sale number...");
    // Generate unique sale number
    const saleNumber = await generateSaleNumber();
    console.log(`✅ Generated sale number: ${saleNumber}`);

    console.log(
      "💰 Step 5: Executing Transaction (Create Sale + Update Treasury)..."
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
          items: {
            include: {
              item: true,
            },
          },
        },
      });

      // 2. Update Treasury/Bank Balance
      const method = (paymentMethod || "CASH").toUpperCase();

      if (method === "CASH") {
        console.log(
          `💰 Payment is CASH. Updating Branch Treasury ID ${treasuryId}...`
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
          console.warn(
            "⚠️ Bank Treasury NOT configured! Money not added to any treasury."
          );
          // Ideally, we might want to throw an error or log this significantly
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
          throw new Error(
            `Insufficient stock for item ${item.itemId}. Available: ${
              inventory ? inventory.quantity : 0
            }`
          );
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
            `Low stock warning: ${inventory.item.name} is now at ${updatedInventory.quantity}`
          );
        }
      }

      return sale;
    });

    console.log(
      "✅✅✅ Transaction completed successfully! Sale ID:",
      result.id
    );
    console.log("============================================");
    res.status(201).json(result);
  } catch (error) {
    console.error("❌❌❌ ERROR CREATING SALE ❌❌❌");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    if (error.meta) {
      console.error("Error meta:", JSON.stringify(error.meta, null, 2));
    }
    console.error("Full error stack:", error.stack);
    console.error("============================================");

    res.status(500).json({
      error: "Failed to create sale",
      message: error.message,
      details: error.code || error.name,
    });
  }
});

// PUT update sale (for updating status, held carts, etc.)
router.put("/:id", async (req, res) => {
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
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Sale not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to update sale", message: error.message });
  }
});

// DELETE sale
router.delete("/:id", async (req, res) => {
  try {
    await prisma.sale.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Sale not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete sale", message: error.message });
  }
});

module.exports = router;
