// routes/notifications.js
// REST endpoints for notification history + read-state management.
// The SSE stream (routes/events.js) delivers real-time pushes; this route backs
// the "bell" history panel and the ack actions that dismiss notifications across
// every open tab / cashier.

const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

router.use(authenticateToken);

// -----------------------------------------------------------
// GET /api/notifications
// Query: unreadOnly=true, type=NEW_CALL_CENTER_ORDER, page, limit
// Scope: always the authenticated user's own notifications.
// -----------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const unreadOnly = String(req.query.unreadOnly || "") === "true";

    const where = { userId };
    if (unreadOnly) where.readAt = null;
    if (req.query.type) where.type = req.query.type;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    res.json({
      data,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// PATCH /api/notifications/:id/read — mark one row as read
// -----------------------------------------------------------
router.patch("/:id/read", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id);
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (n.readAt) return res.json(n);
    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// PATCH /api/notifications/read-by-order/:orderId
// When a cashier claims an order (NEW -> PREPARING) we auto-dismiss the
// broadcast for every cashier at the branch. Each cashier's client hits this
// endpoint on the next stream event; server-side we match rows by payload.orderId.
// Scope: limited to req.user.id so one user can't mark another user's rows read.
// -----------------------------------------------------------
router.patch("/read-by-order/:orderId", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = parseInt(req.params.orderId);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Invalid orderId" });
    }
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        // Prisma MySQL JSON path filter
        payload: { path: "$.orderId", equals: orderId },
      },
      data: { readAt: new Date() },
    });
    res.json({ dismissed: result.count });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// POST /api/notifications/read-all — mark everything read for the current user
// -----------------------------------------------------------
router.post("/read-all", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ dismissed: result.count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
