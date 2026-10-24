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
const { roundMoney } = require("../utils/money");
const { getTreasuryCashSplit } = require("../lib/branchCash");

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

// GET the drawer / branch-safe split of one treasury (MUST be before /:id).
// Feeds the transfer screens: which containers a branch transfer can come from
// or go into, and how much each holds. See lib/branchCash.js.
router.get("/:id/cash-split", async (req, res) => {
  try {
    const split = await getTreasuryCashSplit(parseInt(req.params.id), prisma);
    if (!split) return res.status(404).json({ error: "Treasury not found" });
    res.json(split);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch treasury cash split", message: error.message });
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

// Tolerance for comparing an amount against a computed container figure.
const CASH_EPSILON = 0.005;

function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

// A container limit is a WARNING, not a wall: both figures are book figures,
// and a drawer can physically hold more than expected (an overage) or the safe
// more than the books say. The client shows the figures and resends with
// `force: true` once the user confirms.
function containerLimitError(message, details) {
  return httpError(409, message, { code: "CONTAINER_LIMIT", details });
}

// POST Transfer between treasuries
// POST Transfer Request (Handshake Step 1)
//
// `fromDrawer` says where the cash physically comes from when the source is a
// branch treasury: the register (true) or the branch safe (false, default —
// which is also what every transfer before the flag existed means). The branch
// treasury is ONE account holding both, so only this flag tells the shift's
// drawer formula whether the cashier's expected cash went down. A drawer
// transfer is stamped with the branch's OPEN shift; see
// calculateSystemExpectedCash in routes/shifts.js.
router.post("/transfer", async (req, res) => {
  try {
    const { fromTreasuryId, toTreasuryId, amount, notes } = req.body;
    const transferAmount = roundMoney(Number(amount));
    const sendFromDrawer = req.body.fromDrawer === true || req.body.fromDrawer === "true";
    const force = req.body.force === true || req.body.force === "true";

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

    const sourceId = parseInt(fromTreasuryId);

    // Use transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      const split = await getTreasuryCashSplit(sourceId, tx);
      if (!split) throw new Error("Source treasury not found");

      let fromShiftId = null;
      if (sendFromDrawer) {
        // Only a live, uncounted drawer can be drawn on. A PENDING_REVIEW
        // drawer has already been counted — moving cash out of it now would
        // change a figure the count was measured against.
        if (!split.branchId || split.shift?.status !== "OPEN") {
          throw httpError(
            400,
            split.shift?.status === "PENDING_REVIEW"
              ? "الوردية بانتظار الاعتماد — اعتمد الوردية أولاً أو حوّل من خزنة الفرع"
              : "لا توجد وردية مفتوحة لهذا الفرع — لا يمكن التحويل من الدرج",
            { code: "NO_OPEN_SHIFT" },
          );
        }
        fromShiftId = split.shift.id;
        if (!force && transferAmount > split.drawerCash + CASH_EPSILON) {
          throw containerLimitError(
            `المبلغ أكبر من النقدية المتوقعة في الدرج (${split.drawerCash})`,
            { container: "DRAWER", drawerCash: split.drawerCash, safeCash: split.safeCash },
          );
        }
      } else if (
        !force &&
        split.shift?.status === "OPEN" &&
        split.safeCash != null &&
        transferAmount > split.safeCash + CASH_EPSILON
      ) {
        // With an OPEN shift, the part of the balance beyond the safe is in the
        // cashier's register. Sending it "from the safe" would leave the drawer
        // formula expecting cash that is gone — the phantom shortage this flag
        // exists to prevent.
        throw containerLimitError(
          `المبلغ أكبر من رصيد خزنة الفرع (${split.safeCash}). النقدية في الدرج ${split.drawerCash} — إذا كان التحويل من الدرج اختر "من الدرج"`,
          { container: "SAFE", drawerCash: split.drawerCash, safeCash: split.safeCash },
        );
      }

      // Debit with a compare-and-set, not a read-then-write: two concurrent
      // transfers could both pass a separate balance check and overdraw.
      const debit = await tx.treasury.updateMany({
        where: { id: sourceId, balance: { gte: transferAmount } },
        data: { balance: { decrement: transferAmount } },
      });
      if (debit.count === 0) {
        throw httpError(400, "Insufficient funds in source treasury");
      }

      // Create Transfer Record (PENDING) - Money is "in transit"
      return await tx.cashTransfer.create({
        data: {
          fromTreasuryId: sourceId,
          toTreasuryId: parseInt(destinationTreasuryId),
          amount: transferAmount,
          notes,
          status: "PENDING",
          createdById: req.user.id,
          fromDrawer: sendFromDrawer,
          fromShiftId,
        },
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Transfer Error:", error);
    const status = error.status && Number.isInteger(error.status) ? error.status : 400;
    res.status(status).json({
      error: error.message || "Transfer failed",
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }
});

// POST Approve Transfer (Handshake Step 2)
//
// `toDrawer` says the receiver put the cash in the register rather than the
// branch safe. Only valid when the destination branch has an OPEN shift, which
// is stamped on the transfer so that shift's expected drawer goes up.
router.post("/transfer/:id/approve", async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);
    const receiveIntoDrawer =
      req.body?.toDrawer === true || req.body?.toDrawer === "true";

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer || transfer.status !== "PENDING") {
        throw httpError(400, "Transfer not found or not pending");
      }

      let toShiftId = null;
      if (receiveIntoDrawer) {
        const split = await getTreasuryCashSplit(transfer.toTreasuryId, tx);
        if (!split?.branchId || split.shift?.status !== "OPEN") {
          throw httpError(
            400,
            "لا توجد وردية مفتوحة في الفرع المستلم — لا يمكن الاستلام في الدرج",
            { code: "NO_OPEN_SHIFT" },
          );
        }
        toShiftId = split.shift.id;
      }

      // Claim with a conditional write. A plain read takes no lock, so two
      // concurrent approvals (or an approve racing a reject) could both see
      // PENDING and both move money. Exactly one claim can match.
      const claimed = await tx.cashTransfer.updateMany({
        where: { id: transferId, status: "PENDING" },
        data: {
          status: "APPROVED",
          acceptedById: req.user.id,
          resolvedAt: new Date(),
          toDrawer: receiveIntoDrawer,
          toShiftId,
        },
      });
      if (claimed.count === 0) {
        throw httpError(409, "Transfer is no longer pending");
      }

      // Money received by the destination treasury
      await tx.treasury.update({
        where: { id: transfer.toTreasuryId },
        data: { balance: { increment: transfer.amount } },
      });

      return tx.cashTransfer.findUnique({ where: { id: transferId } });
    });

    res.json(result);
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 400;
    res.status(status).json({
      error: error.message || "Approval failed",
      message: error.message,
      code: error.code,
    });
  }
});

// POST Reject Transfer (Refund)
//
// The refund goes back to the source treasury. For a drawer transfer, whether
// the cash lands back in that drawer is decided by `resolvedAt` against the
// shift's end — see calculateSystemExpectedCash.
router.post("/transfer/:id/reject", async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer || transfer.status !== "PENDING") {
        throw httpError(400, "Transfer not found or not pending");
      }

      // Same conditional claim as approve — see there.
      const claimed = await tx.cashTransfer.updateMany({
        where: { id: transferId, status: "PENDING" },
        data: {
          status: "REJECTED",
          acceptedById: req.user.id,
          resolvedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw httpError(409, "Transfer is no longer pending");
      }

      // Refund Source (Money returned to branch)
      await tx.treasury.update({
        where: { id: transfer.fromTreasuryId },
        data: { balance: { increment: transfer.amount } },
      });

      return tx.cashTransfer.findUnique({ where: { id: transferId } });
    });

    res.json(result);
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 400;
    res.status(status).json({
      error: error.message || "Rejection failed",
      message: error.message,
    });
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
