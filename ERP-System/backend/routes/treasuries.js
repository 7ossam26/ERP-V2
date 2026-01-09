const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET all treasuries
router.get("/", async (req, res) => {
  try {
    const treasuries = await prisma.treasury.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(treasuries);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch treasuries", message: error.message });
  }
});

// GET all cash transfers (MUST be before /:id to avoid route conflict)
router.get("/transfers", async (req, res) => {
  try {
    const transfers = await prisma.cashTransfer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        fromTreasury: true,
        toTreasury: true,
      },
    });
    res.json(transfers);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch transfers", message: error.message });
  }
});

// GET treasury by ID
router.get("/:id", async (req, res) => {
  try {
    const treasury = await prisma.treasury.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!treasury) {
      return res.status(404).json({ error: "Treasury not found" });
    }
    res.json(treasury);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch treasury", message: error.message });
  }
});

// POST Transfer between treasuries
// POST Transfer Request (Handshake Step 1)
router.post("/transfer", async (req, res) => {
  try {
    const { fromTreasuryId, amount, notes } = req.body;
    const transferAmount = Number(amount);

    if (!fromTreasuryId || !transferAmount || transferAmount <= 0) {
      return res.status(400).json({ error: "Invalid transfer details" });
    }

    // Get Main Treasury from System Configuration
    const systemConfig = await prisma.systemConfiguration.findFirst({
      where: { id: 1 },
    });

    let mainTreasuryId = null;

    if (systemConfig && systemConfig.mainTreasuryId) {
      // Use configured Main Treasury
      mainTreasuryId = systemConfig.mainTreasuryId;
    } else {
      // Fallback: Find by ID 1 or name containing "Main" or "رئيسية"
      const mainTreasury = await prisma.treasury.findFirst({
        where: {
          OR: [
            { id: 1 },
            { name: { contains: "رئيسية" } },
            { name: "Main Treasury" },
          ],
        },
      });

      if (!mainTreasury) {
        throw new Error(
          "Main Treasury not found. Please configure it in System Settings."
        );
      }
      mainTreasuryId = mainTreasury.id;
    }

    // Verify the treasury exists
    const mainTreasury = await prisma.treasury.findUnique({
      where: { id: mainTreasuryId },
    });

    if (!mainTreasury) {
      throw new Error("Configured Main Treasury does not exist");
    }

    if (parseInt(fromTreasuryId) === mainTreasuryId) {
      throw new Error("Cannot transfer from Main Treasury to itself");
    }

    // Use transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check source balance
      const source = await tx.treasury.findUnique({
        where: { id: parseInt(fromTreasuryId) },
      });

      if (!source || Number(source.balance) < transferAmount) {
        throw new Error("Insufficient funds in source treasury");
      }

      // 2. Decrement source (Money leaves the branch immediately)
      await tx.treasury.update({
        where: { id: parseInt(fromTreasuryId) },
        data: { balance: { decrement: transferAmount } },
      });

      // 3. Create Transfer Record (PENDING) - Money is "in transit"
      return await tx.cashTransfer.create({
        data: {
          fromTreasuryId: parseInt(fromTreasuryId),
          toTreasuryId: mainTreasuryId,
          amount: transferAmount,
          notes,
          status: "PENDING",
        },
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Transfer Error:", error);
    res.status(400).json({ error: error.message || "Transfer failed" });
  }
});

// POST Approve Transfer (Handshake Step 2)
router.post("/transfer/:id/approve", async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer || transfer.status !== "PENDING") {
        throw new Error("Transfer not found or not pending");
      }

      // 1. Increment details (Money received by Main Treasury)
      await tx.treasury.update({
        where: { id: transfer.toTreasuryId },
        data: { balance: { increment: transfer.amount } },
      });

      // 2. Update Status
      return await tx.cashTransfer.update({
        where: { id: transferId },
        data: { status: "APPROVED" },
      });
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Approval failed" });
  }
});

// POST Reject Transfer (Refund)
router.post("/transfer/:id/reject", async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer || transfer.status !== "PENDING") {
        throw new Error("Transfer not found or not pending");
      }

      // 1. Refund Source (Money returned to branch)
      await tx.treasury.update({
        where: { id: transfer.fromTreasuryId },
        data: { balance: { increment: transfer.amount } },
      });

      // 2. Update Status
      return await tx.cashTransfer.update({
        where: { id: transferId },
        data: { status: "REJECTED" },
      });
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Rejection failed" });
  }
});

// POST create new treasury
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    const treasury = await prisma.treasury.create({
      data: { name },
    });
    res.status(201).json(treasury);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create treasury", message: error.message });
  }
});

// PUT update treasury
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const treasury = await prisma.treasury.update({
      where: { id: parseInt(req.params.id) },
      data: { name },
    });
    res.json(treasury);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update treasury", message: error.message });
  }
});

// DELETE treasury
router.delete("/:id", async (req, res) => {
  try {
    await prisma.treasury.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete treasury", message: error.message });
  }
});

module.exports = router;
