/**
 * Audit Trail Routes — READ ONLY
 *
 * All endpoints require the user to be authenticated AND have
 * hasSensitiveAccess = true (or be Superadmin / Admin).
 *
 * No DELETE or UPDATE routes exist. The DB user should also have
 * INSERT + SELECT only on audit_logs.
 */
const express = require("express");
const router  = express.Router();
const prisma  = require("../config/database");
const { authenticateToken, requireSensitiveAccess } = require("../middleware/auth");
const { verifyIntegrity } = require("../utils/auditLogger");

// All routes in this file require auth + sensitive access
router.use(authenticateToken, requireSensitiveAccess);

// ─── GET /api/audit ──────────────────────────────────────────────────────────
// List audit logs with filtering, pagination, and optional branch scoping.
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
    if (branchId) where.branchId     = Number(branchId);

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
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
          ipAddress:    true,
          branchId:     true,
          rowHash:      true,
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
// Quick counts grouped by action type for the last N days.
router.get("/summary", async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const counts = await prisma.auditLog.groupBy({
      by:      ["action"],
      where:   { createdAt: { gte: from } },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const topEntities = await prisma.auditLog.groupBy({
      by:      ["targetEntity"],
      where:   { createdAt: { gte: from } },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    5,
    });

    const topUsers = await prisma.auditLog.groupBy({
      by:      ["userId"],
      where:   { createdAt: { gte: from }, userId: { not: null } },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    5,
    });

    res.json({
      period:      { days, from },
      byAction:    counts.map((r) => ({ action: r.action, count: r._count.id })),
      topEntities: topEntities.map((r) => ({ entity: r.targetEntity, count: r._count.id })),
      topUsers:    topUsers.map((r) => ({ userId: r.userId, count: r._count.id })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/audit/verify ───────────────────────────────────────────────────
// Run HMAC integrity check across all (or date-ranged) audit records.
router.get("/verify", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const result = await verifyIntegrity({ from, to });
    res.json({
      ...result,
      integrity: result.tampered.length === 0 ? "OK" : "COMPROMISED",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
