const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireCreatePermission,
  requireAnyPermission,
  getUserBranchFilter,
} = require("../middleware/auth");

// Protect all routes with authentication
router.use(authenticateToken);

// GET all treasuries — a shared lookup used to populate treasury dropdowns
// across the app. Available to any authenticated user (no per-page permission
// gate): the result is already scoped to the caller's assigned branch(es) by
// getUserBranchFilter below, so each user only sees their own branch cash
// treasury plus the shared global treasuries (MAIN/VISA/INSTAPAY). Global roles
// see all. Gating this by module permission caused 403s on pages that were
// legitimately granted but whose module drifted out of the allowlist.
router.get("/", async (req, res) => {
  try {
    // Don't pass req — show all accessible treasuries for dropdowns, not just the active branch's
    const branchFilter = await getUserBranchFilter(req.user.id);

    // Build query: Active treasuries
    const where = { isActive: true };

    // Optional scope filter: ?scope=BRANCH_CASH|GLOBAL_VISA|GLOBAL_INSTAPAY|MAIN
    // Also accept comma-separated list: ?scope=BRANCH_CASH,MAIN
    if (req.query.scope) {
      const ALLOWED_SCOPES = ["BRANCH_CASH", "GLOBAL_VISA", "GLOBAL_INSTAPAY", "MAIN"];
      const requested = String(req.query.scope)
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ALLOWED_SCOPES.includes(s));
      if (requested.length === 1) where.scope = requested[0];
      else if (requested.length > 1) where.scope = { in: requested };
    }

    // ?all=true — return every active treasury, no branch filter.
    // Used by Cash Transfer destination dropdown so users can send to any drawer.
    const showAll = String(req.query.all || "").toLowerCase() === "true";

    // If scoped to a branch, only show that branch's cash treasury + global treasuries
    // (MAIN / GLOBAL_VISA / GLOBAL_INSTAPAY are not branch-bound and must remain visible)
    if (branchFilter && !showAll) {
      const branchClause = branchFilter.id.in
        ? { branch: { id: { in: branchFilter.id.in } } }
        : { branch: { id: branchFilter.id } };
      where.OR = [
        branchClause,
        { scope: { in: ["GLOBAL_VISA", "GLOBAL_INSTAPAY", "MAIN"] } },
      ];
    }

    const treasuries = await prisma.treasury.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: "asc" },
    });

    res.json(treasuries);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch treasuries", message: error.message });
  }
});

// GET global-balances — Visa, Instapay, Main treasury balances in one call.
// Used by the Branches-Sales header cards (Phase 5 / 6).
router.get("/global-balances", async (req, res) => {
  try {
    const cfg = await prisma.systemConfiguration.findFirst({
      select: {
        mainTreasuryId: true,
        visaTreasuryId: true,
        instapayTreasuryId: true,
      },
    });

    const fetchOne = async (id) => {
      if (!id) return null;
      const t = await prisma.treasury.findUnique({
        where: { id },
        select: { id: true, name: true, balance: true, scope: true },
      });
      if (!t) return null;
      return { id: t.id, name: t.name, balance: Number(t.balance || 0) };
    };

    const [mainTreasury, visaTreasury, instapayTreasury] = await Promise.all([
      fetchOne(cfg?.mainTreasuryId),
      fetchOne(cfg?.visaTreasuryId),
      fetchOne(cfg?.instapayTreasuryId),
    ]);

    res.json({ mainTreasury, visaTreasury, instapayTreasury });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch global treasury balances",
      message: error.message,
    });
  }
});

// GET balances — every active treasury with its live balance, for the
// "أرصدة الخزائن" dashboard module. Unlike GET / this is NOT branch-scoped:
// the whole point is a company-wide view, so it is gated by the TREASURIES
// module permission instead. (MUST be before /:id to avoid route conflict.)
router.get("/balances", requirePermission("TREASURIES"), async (req, res) => {
  try {
    const treasuries = await prisma.treasury.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        scope: true,
        balance: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });

    // MAIN first, then global Visa/Instapay, then branch drawers by name
    const SCOPE_ORDER = { MAIN: 0, GLOBAL_VISA: 1, GLOBAL_INSTAPAY: 2, BRANCH_CASH: 3 };
    treasuries.sort(
      (a, b) =>
        (SCOPE_ORDER[a.scope] ?? 9) - (SCOPE_ORDER[b.scope] ?? 9) ||
        (a.branch?.name || a.name).localeCompare(b.branch?.name || b.name, "ar"),
    );

    const rows = treasuries.map((t) => ({
      ...t,
      balance: Number(t.balance || 0),
    }));

    res.json({
      treasuries: rows,
      totalBalance: rows.reduce((s, t) => s + t.balance, 0),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch treasury balances",
      message: error.message,
    });
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
            "Main Treasury not found. Please configure it in System Settings.",
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

    // Use transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check source balance
      const source = await tx.treasury.findUnique({
        where: { id: parseInt(fromTreasuryId) },
        include: { branch: true },
      });

      if (!source) throw new Error("Source treasury not found");

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
    const status = error.status && Number.isInteger(error.status) ? error.status : 400;
    res.status(status).json({ error: error.message || "Transfer failed" });
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
  },
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
  },
);

// DELETE treasury
// DELETE treasury
router.delete(
  "/:id",
  requirePermission("TREASURIES"),
  async (req, res, next) => {
    try {
      await prisma.treasury.update({
        where: { id: parseInt(req.params.id) },
        data: { isActive: false },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
