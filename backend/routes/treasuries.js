const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireCreatePermission,
  requireAnyPermission,
} = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET all treasuries
router.get("/", async (req, res) => {
  try {
    const treasuries = await prisma.treasury.findMany({
      where: { isActive: true },
      include: { branch: true },
      orderBy: { createdAt: "asc" },
    });

    // --- ALL BRANCHES AGGREGATION LOGIC ---
    // 1. Calculate total balance of all "real" treasuries
    const allBranchesTreasury = treasuries.find(
      (t) => t.name === "All Branches Treasury" || t.id === 4 // Fallback to ID 4 if name matches
    );

    if (allBranchesTreasury) {
      const realTreasuries = treasuries.filter(
        (t) => t.id !== allBranchesTreasury.id
      );
      const totalBalance = realTreasuries.reduce(
        (sum, t) => sum + Number(t.balance),
        0
      );

      // 2. Overwrite the balance in the response (Virtual View)
      allBranchesTreasury.balance = totalBalance;
      allBranchesTreasury.isVirtual = true; // Flag for frontend if needed
    }
    // --------------------------------------

    // --- VISIBILITY FILTER ---
    // Rule:
    // 1. Superadmin -> Sees ALL
    // 2. "All Branches" Branch User -> Sees ALL
    // 3. Regular Branch User -> Sees ONLY their branch's treasury

    if (req.user.role !== "Superadmin") {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { branch: true },
      });

      // Validating current user, if for some reason user not found or no branch, return empty or safe default
      // ideally every user has a branch if they are not superadmin, but let's be safe.

      const isAllBranches = user?.branch?.isAllBranches;
      const userTreasuryId = user?.branch?.treasuryId;

      if (!isAllBranches) {
        // Filter to only include the user's branch treasury
        return res.json(
          treasuries.filter((t) => t.id === userTreasuryId)
        );
      }
    }
    // -------------------------

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
        createdBy: { select: { id: true, name: true } },
        acceptedBy: { select: { id: true, name: true } },
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
    if (!treasury || !treasury.isActive) {
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
  // console.log("Processing transfer request:", req.body); // DEBUG LOG
  try {
    const { fromTreasuryId, toTreasuryId, amount, notes } = req.body;
    const transferAmount = Number(amount);

    if (!fromTreasuryId || !transferAmount || transferAmount <= 0) {
      return res.status(400).json({ error: "Invalid transfer details" });
    }

    let destinationTreasuryId = toTreasuryId;

    // IF destination not provided, fallback to Main Treasury (Backward compatibility)
    if (!destinationTreasuryId) {
      // Get Main Treasury from System Configuration
      const systemConfig = await prisma.systemConfiguration.findFirst({
        where: { id: 1 },
      });

      if (systemConfig && systemConfig.mainTreasuryId) {
        // Use configured Main Treasury
        destinationTreasuryId = systemConfig.mainTreasuryId;
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
        destinationTreasuryId = mainTreasury.id;
      }
    }

    // Verify the treasury exists
    const destinationTreasury = await prisma.treasury.findUnique({
      where: { id: parseInt(destinationTreasuryId) },
    });

    if (!destinationTreasury) {
      throw new Error("Destination Treasury does not exist");
    }

    if (parseInt(fromTreasuryId) === parseInt(destinationTreasuryId)) {
      throw new Error("Cannot transfer from Treasury to itself");
    }

    // Block transfers from "All Branches Treasury" (ID 4 or Name check)
    // We fetch source details in transaction anyway, but let's check basic ID first if known, 
    // or better, check after fetching source.

    // Use transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check source balance
      const source = await tx.treasury.findUnique({
        where: { id: parseInt(fromTreasuryId) },
        include: { branch: true },
      });

      if (!source) throw new Error("Source treasury not found");

      // --- ENFORCE READ-ONLY FOR ALL BRANCHES ---
      // Check if it's the "All Branches" treasury via name (legacy) or relation
      const isAllBranchesTreasury =
        source.name === "All Branches Treasury" ||
        (source.branch && source.branch.isAllBranches);

      if (isAllBranchesTreasury) {
        throw new Error("Cannot transfer funds FROM 'All Branches Treasury'. It is a read-only view.");
      }
      // ----------------------------------------

      if (Number(source.balance) < transferAmount) {
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
          toTreasuryId: parseInt(destinationTreasuryId),
          amount: transferAmount,
          notes,
          status: "PENDING",
          createdById: req.user.id,
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
  // console.log("Processing transfer approval:", req.params.id); // DEBUG LOG
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
        data: {
          status: "APPROVED",
          acceptedById: req.user.id,
        },
      });
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Approval failed" });
  }
});

// POST Reject Transfer (Refund)
router.post("/transfer/:id/reject", async (req, res) => {
  // console.log("Processing transfer rejection:", req.params.id); // DEBUG LOG
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
        data: {
          status: "REJECTED",
          acceptedById: req.user.id,
        },
      });
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Rejection failed" });
  }
});

// POST create new treasury
router.post(
  "/",
  requireCreatePermission("CREATES_TREASURIES"),
  async (req, res) => {
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
  }
);

// PUT update treasury
router.put(
  "/:id",
  requireAnyPermission(["TREASURIES", "CREATES_TREASURIES"]),
  async (req, res) => {
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
  }
);

// DELETE treasury
// DELETE treasury
router.delete("/:id", requirePermission("TREASURIES"), async (req, res, next) => {
  try {
    await prisma.treasury.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
