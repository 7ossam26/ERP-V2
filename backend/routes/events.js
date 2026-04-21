// routes/events.js
// Server-Sent Events (SSE) stream for real-time notifications.
// Each authenticated client opens ONE long-lived GET /api/events/stream connection.
// We subscribe to the EventBus topic for this user and push JSON events.
// On reconnect, the client sends `Last-Event-ID` and we replay any notification
// rows newer than that id, so no events are lost across dropouts/deploys.
//
// Auth: EventSource can't attach custom headers, so the long-lived JWT must not
// travel in the URL (it leaks through proxy logs, browser history, Referer).
// Instead the client first calls POST /api/events/ticket with its normal Bearer
// token, gets a single-use short-lived ticket, and uses that in ?ticket= when
// opening the stream. Tickets are consumed on first use.

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { authenticateToken } = require("../middleware/auth");
const prisma = require("../config/database");
const bus = require("../lib/eventBus");

const HEARTBEAT_MS = 25_000; // below most proxy idle timeouts (usually 30-60s)
const TICKET_TTL_MS = 30_000;

const ticketStore = new Map(); // ticket -> { userId, expiresAt }

function purgeExpiredTickets(now = Date.now()) {
  for (const [t, entry] of ticketStore) {
    if (entry.expiresAt <= now) ticketStore.delete(t);
  }
}

router.post("/ticket", authenticateToken, (req, res) => {
  purgeExpiredTickets();
  const ticket = crypto.randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + TICKET_TTL_MS;
  ticketStore.set(ticket, { userId: req.user.id, expiresAt });
  res.json({ ticket, expiresAt });
});

function authFromTicket(req, res, next) {
  const ticket = req.query.ticket;
  if (!ticket) {
    return res.status(401).json({ error: "Missing stream ticket" });
  }
  const entry = ticketStore.get(ticket);
  ticketStore.delete(ticket); // single-use
  if (!entry || entry.expiresAt <= Date.now()) {
    return res.status(401).json({ error: "Invalid or expired stream ticket" });
  }
  req.user = { id: entry.userId };
  next();
}

router.get("/stream", authFromTicket, async (req, res) => {
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
      const [missed, lastKnown] = await Promise.all([
        prisma.notification.findMany({
          where: { userId, id: { gt: lastId } },
          orderBy: { id: "asc" },
          take: 200,
        }),
        // Check if the client's last-seen notification still exists in the DB.
        // If it doesn't, the history was TTL-purged and the client must refetch.
        prisma.notification.findFirst({
          where: { userId, id: { lte: lastId } },
          orderBy: { id: "desc" },
          select: { id: true },
        }),
      ]);

      // No record at-or-before lastId means the notification was purged (30-day TTL).
      if (!lastKnown) {
        res.write(`event: replay-truncated\ndata: {}\n\n`);
      }

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
