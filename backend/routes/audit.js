/**
 * Audit Trail Routes — READ ONLY
 *
 * All endpoints require the user to be authenticated AND have
 * hasSensitiveAccess = true (or be Superadmin / Admin).
 *
 * No DELETE or UPDATE routes exist.
 */
const express = require("express");
const router  = express.Router();
const prisma  = require("../config/database");
const { authenticateToken, requireSensitiveAccess, getUserBranchFilter } = require("../middleware/auth");

router.use(authenticateToken, requireSensitiveAccess);

// ─── GET /api/audit ──────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const {
      page      = 1,
      limit     = 50,
      action,
      entity,
      userId,
      branchId,
      from,
      to,
      search,
    } = req.query;

    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = {};

    if (action)   where.action       = action.toUpperCase();
    if (entity)   where.targetEntity = entity;
    if (userId)   where.userId       = Number(userId);

    // Enforce branch access control
    const authorizedBranchFilter = await getUserBranchFilter(req.user.id, req);
    if (branchId) {
      const requestedId = Number(branchId);
      // Validate the requested branch is within the user's allowed branches
      if (authorizedBranchFilter) {
        const allowedIds = authorizedBranchFilter.id.in || [authorizedBranchFilter.id];
        if (!allowedIds.includes(requestedId)) {
          return res.status(403).json({ error: "Access denied to this branch" });
        }
      }
      where.branchId = requestedId;
    } else if (authorizedBranchFilter) {
      // No specific branch requested — scope to all allowed branches
      where.branchId = authorizedBranchFilter.id.in
        ? { in: authorizedBranchFilter.id.in }
        : authorizedBranchFilter.id;
    }

    if (from || to) {
      where.createdAt = {};
      const fromDate = from ? new Date(from) : null;
      const toDate   = to   ? new Date(to)   : null;
      if (fromDate && !isNaN(fromDate)) where.createdAt.gte = fromDate;
      if (toDate   && !isNaN(toDate))   where.createdAt.lte = toDate;
    }

    if (search) {
      where.OR = [
        { targetEntity: { contains: search } },
        { targetId:     { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id:           true,
          action:       true,
          targetEntity: true,
          targetId:     true,
          details:      true,
          oldValues:    true,
          ipAddress:    true,
          branchId:     true,
          createdAt:    true,
          user: {
            select: { id: true, name: true, username: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data:       logs,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / take),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/audit/summary ──────────────────────────────────────────────────
router.get("/summary", async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Enforce branch access control
    const authorizedBranchFilter = await getUserBranchFilter(req.user.id, req);
    const branchWhere = {};
    if (authorizedBranchFilter) {
      branchWhere.branchId = authorizedBranchFilter.id.in
        ? { in: authorizedBranchFilter.id.in }
        : authorizedBranchFilter.id;
    }

    const counts = await prisma.auditLog.groupBy({
      by:      ["action"],
      where:   { createdAt: { gte: from }, ...branchWhere },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const topEntities = await prisma.auditLog.groupBy({
      by:      ["targetEntity"],
      where:   { createdAt: { gte: from }, ...branchWhere },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    5,
    });

    res.json({
      period:      { days, from },
      byAction:    counts.map((r) => ({ action: r.action, count: r._count.id })),
      topEntities: topEntities.map((r) => ({ entity: r.targetEntity, count: r._count.id })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
