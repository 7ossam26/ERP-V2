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

    if (!employeeId) {
      console.error("❌ Validation failed: Employee is required");
      return res.status(400).json({ error: "Employee is required" });
    }
    console.log(`✅ Employee ID: ${employeeId}`);

    if (!items || items.length === 0) {
      console.error("❌ Validation failed: At least one item is required");
      return res.status(400).json({ error: "At least one item is required" });
    }
    console.log(`✅ Items count: ${items.length}`);

    console.log("💰 Step 2: Fetching employee with branch...");
    // Fetch employee to get branch, treasury, and warehouse
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
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
      console.error(`❌ Employee not found with ID: ${employeeId}`);
      return res
        .status(404)
        .json({ error: `Employee not found with ID: ${employeeId}` });
    }
    console.log(`✅ Employee found: ${employee.name}`);

    if (!employee.branch) {
      console.error(`❌ Employee ${employeeId} has no branch assigned`);
      console.error(`Employee data:`, JSON.stringify(employee, null, 2));
      return res.status(400).json({
        error: `Employee "${employee.name}" must be assigned to a branch`,
      });
    }
    console.log(
      `✅ Branch found: ${employee.branch.name} (ID: ${employee.branchId})`
    );

    const branchId = employee.branchId;
    const treasuryId = employee.branch.treasuryId; // Using the branch's linked treasury
    const warehouseId = employee.branch.warehouseId;

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
          employeeId: parseInt(employeeId),
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
