// routes/events.js
// Server-Sent Events (SSE) stream for real-time notifications.
// Each authenticated client opens ONE long-lived GET /api/events/stream connection.
// We subscribe to the EventBus topic for this user and push JSON events.
// On reconnect, the client sends `Last-Event-ID` and we replay any notification
// rows newer than that id, so no events are lost across dropouts/deploys.
//
// Auth note: EventSource can't attach Authorization headers, so we accept the
// token via ?token=<jwt> query param. The token is verified with the same secret
// used everywhere else and no cookies / persistent state are involved.

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const prisma = require("../config/database");
const bus = require("../lib/eventBus");

const HEARTBEAT_MS = 25_000; // below most proxy idle timeouts (usually 30-60s)

function authFromQuery(req, res, next) {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret_key_change_me",
    );
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

router.get("/stream", authFromQuery, async (req, res) => {
  const userId = req.user.id;

  // SSE headers
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx)
  res.flushHeaders?.();

  const send = (event) => {
    // event: { id, type, payload, createdAt }
    if (event.id != null) res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.type || "message"}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // -----------------------------------------------------------
  // 1. Replay from Last-Event-ID (or from `lastEventId` query)
  // -----------------------------------------------------------
  const lastEventIdHeader =
    req.headers["last-event-id"] || req.query.lastEventId;
  const lastId = parseInt(lastEventIdHeader);
  if (Number.isFinite(lastId) && lastId > 0) {
    try {
      const missed = await prisma.notification.findMany({
        where: { userId, id: { gt: lastId } },
        orderBy: { id: "asc" },
        take: 200,
      });
      for (const n of missed) {
        send({
          id: n.id,
          type: n.type,
          payload: n.payload,
          createdAt: n.createdAt,
          replay: true,
        });
      }
    } catch (err) {
      console.error("[SSE] replay failed:", err.message);
    }
  }

  // Immediately send a "ready" comment so clients know connection is live.
  res.write(`: connected\n\n`);

  // -----------------------------------------------------------
  // 2. Subscribe to EventBus for this user's topic
  // -----------------------------------------------------------
  const unsubscribe = bus.subscribe(bus.topics.userNotifications(userId), (event) => {
    try {
      send(event);
    } catch (err) {
      console.error("[SSE] write failed:", err.message);
    }
  });

  // -----------------------------------------------------------
  // 3. Heartbeat — prevents proxies from killing idle connections
  // -----------------------------------------------------------
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      // connection gone; cleanup handled by 'close'
    }
  }, HEARTBEAT_MS);

  // -----------------------------------------------------------
  // 4. Cleanup on disconnect
  // -----------------------------------------------------------
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    try {
      res.end();
    } catch {}
  });
});

module.exports = router;
