const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET System Configuration
router.get("/", async (req, res) => {
  try {
    let config = await prisma.systemConfiguration.findFirst({
      where: { id: 1 },
      include: {
        mainWarehouse: true,
        mainTreasury: true,
        bankTreasury: true,
      },
    });

    // Create default if not exists
    if (!config) {
      config = await prisma.systemConfiguration.create({
        data: {
          id: 1,
          companyName: "ERP System",
        },
        include: {
          mainWarehouse: true,
          mainTreasury: true,
          bankTreasury: true,
        },
      });
    }

    res.json(config);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Helper to safely parse Integers (returns null for empty/invalid)
const safeInt = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const parsed = parseInt(val);
  return isNaN(parsed) ? null : parsed;
};

// PUT Update Configuration
router.put("/", requirePermission("SETTINGS"), async (req, res) => {
  try {
    const {
      companyName,
      mainWarehouseId,
      mainTreasuryId,
      bankTreasuryId,
      taxRate,
      salaryStartDay,
      salaryEndDay,
      shiftStartTime,
      shiftEndTime,
    } = req.body;

    // Validate Tax Rate
    const parsedTaxRate =
      taxRate !== undefined && taxRate !== "" ? parseFloat(taxRate) : undefined;

    const updateData = {
      companyName,
      mainWarehouseId: safeInt(mainWarehouseId),
      mainTreasuryId: safeInt(mainTreasuryId),
      bankTreasuryId: safeInt(bankTreasuryId),
      taxRate: parsedTaxRate,
      salaryStartDay: safeInt(salaryStartDay),
      salaryEndDay: safeInt(salaryEndDay),
      shiftStartTime,
      shiftEndTime,
    };

    // Remove undefined keys for update
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    const config = await prisma.systemConfiguration.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        companyName: companyName || "ERP System",
        mainWarehouseId: safeInt(mainWarehouseId),
        mainTreasuryId: safeInt(mainTreasuryId),
        bankTreasuryId: safeInt(bankTreasuryId),
        taxRate: parsedTaxRate !== undefined ? parsedTaxRate : 14.0,
        salaryStartDay: safeInt(salaryStartDay) || 1,
        salaryEndDay: safeInt(salaryEndDay) || 30,
        shiftStartTime: shiftStartTime || "09:00",
        shiftEndTime: shiftEndTime || "17:00",
      },
    });

    res.json(config);
  } catch (error) {
    console.error("Error updating settings:", error);
    res
      .status(500)
      .json({ error: "Failed to update settings", details: error.message });
  }
});

module.exports = router;
