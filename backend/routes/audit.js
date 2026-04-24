const express = require("express");
const XLSX = require("xlsx");
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken, requirePermission("AUDIT"));

function buildDateRange(from, to) {
  if (!from && !to) {
    return undefined;
  }

  const createdAt = {};

  if (from) {
    const startDate = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(startDate.getTime())) {
      createdAt.gte = startDate;
    }
  }

  if (to) {
    const endDate = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(endDate.getTime())) {
      createdAt.lte = endDate;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}

function buildWhereClause(query) {
  const {
    action,
    module,
    entity,
    userId,
    from,
    to,
    search,
  } = query;

  const where = {};
  const targetEntity = module || entity;
  const dateRange = buildDateRange(from, to);

  if (action) {
    where.action = String(action).toUpperCase();
  }

  if (targetEntity) {
    where.targetEntity = String(targetEntity).trim().toLowerCase();
  }

  if (userId) {
    where.userId = Number.parseInt(userId, 10);
  }

  if (dateRange) {
    where.createdAt = dateRange;
  }

  if (search) {
    where.OR = [
      { targetEntity: { contains: search } },
      { targetId: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { username: { contains: search } } },
    ];
  }

  return where;
}

async function fetchLogs(where, { take, skip } = {}) {
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
    select: {
      id: true,
      action: true,
      targetEntity: true,
      targetId: true,
      details: true,
      oldValues: true,
      ipAddress: true,
      branchId: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, username: true },
      },
      branch: {
        select: { id: true, name: true },
      },
    },
  });
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const take = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
      200,
    );
    const skip = (page - 1) * take;
    const where = buildWhereClause(req.query);

    const [logs, total] = await Promise.all([
      fetchLogs(where, { take, skip }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/filters", async (req, res, next) => {
  try {
    const [users, actions, modules] = await Promise.all([
      prisma.auditLog.findMany({
        distinct: ["userId"],
        where: { userId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { action: true },
        orderBy: { action: "asc" },
      }),
      prisma.auditLog.groupBy({
        by: ["targetEntity"],
        _count: { targetEntity: true },
        orderBy: { targetEntity: "asc" },
      }),
    ]);

    res.json({
      users: users.map((row) => row.user).filter(Boolean),
      actions: actions.map((row) => row.action),
      modules: modules.map((row) => row.targetEntity),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const where = buildWhereClause(req.query);
    const logs = await fetchLogs(where);

    const rows = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      userName: log.user?.name || "",
      username: log.user?.username || "",
      module: log.targetEntity,
      action: log.action,
      targetId: log.targetId || "",
      branch: log.branch?.name || "",
      ipAddress: log.ipAddress || "",
      beforeJson: JSON.stringify(log.oldValues || {}, null, 2),
      afterJson: JSON.stringify(log.details || {}, null, 2),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-${Date.now()}.xlsx"`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const days = Math.min(Number.parseInt(req.query.days, 10) || 7, 90);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [counts, topEntities] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["action"],
        where: { createdAt: { gte: from } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.auditLog.groupBy({
        by: ["targetEntity"],
        where: { createdAt: { gte: from } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    res.json({
      period: { days, from },
      byAction: counts.map((row) => ({
        action: row.action,
        count: row._count.id,
      })),
      topEntities: topEntities.map((row) => ({
        entity: row.targetEntity,
        count: row._count.id,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
