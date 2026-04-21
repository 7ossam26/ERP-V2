// SSE integration test (design §9.2, §12.6-12.7).
// Boots the events router on an ephemeral port. Uses a raw HTTP client
// to parse SSE frames so we don't pull in an extra dependency.
//
// Auth flow: client POSTs to /ticket with a Bearer JWT → gets a short-lived
// ticket → opens /stream?ticket=<ticket>. This test mocks `authenticateToken`'s
// DB lookup and the notification queries.

const seededReplayRows = [];

const mockUserId = 42;

jest.mock("../../config/database", () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: mockUserId }),
  },
  notification: {
    findMany: jest.fn(async ({ where }) => {
      const gt = where?.id?.gt ?? 0;
      const userId = where?.userId;
      return seededReplayRows.filter(
        (r) => r.id > gt && (userId == null || r.userId === userId),
      );
    }),
    // Used for replay-truncated check: findFirst with id: { lte: lastId }
    findFirst: jest.fn(async ({ where }) => {
      const userId = where?.userId;
      const lte = where?.id?.lte;
      const rows = seededReplayRows.filter(
        (r) =>
          (userId == null || r.userId === userId) &&
          (lte == null || r.id <= lte),
      );
      if (!rows.length) return null;
      // Return highest id (desc order)
      return rows.reduce((a, b) => (a.id > b.id ? a : b));
    }),
  },
}));

const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const bus = require("../../lib/eventBus");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_change_me";

function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/events", require("../../routes/events"));
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function postForTicket(server, token) {
  const { port, address } = server.address();
  return new Promise((resolve, reject) => {
    const body = "";
    const req = http.request(
      {
        host: address,
        port,
        path: "/api/events/ticket",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`ticket request failed: ${res.statusCode}`));
          }
          resolve(JSON.parse(data).ticket);
        });
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

function openStream(server, { ticket, lastEventId }) {
  const { port, address } = server.address();
  const qs = new URLSearchParams({ ticket });
  if (lastEventId != null) qs.set("lastEventId", String(lastEventId));

  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: address, port, path: `/api/events/stream?${qs.toString()}` },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`status ${res.statusCode}`));
        }
        const events = [];
        let buffer = "";
        const waiters = [];

        const tryFlush = () => {
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = parseFrame(frame);
            if (parsed) {
              events.push(parsed);
              while (waiters.length && events.length) {
                waiters.shift()(events.shift());
              }
            }
          }
        };

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buffer += chunk;
          tryFlush();
        });
        res.on("error", (err) => waiters.forEach((w) => w(null, err)));

        resolve({
          res,
          req,
          next: () =>
            new Promise((r, rj) => {
              if (events.length) return r(events.shift());
              waiters.push((ev, err) => (err ? rj(err) : r(ev)));
            }),
          close: () => {
            try {
              req.destroy();
            } catch {}
          },
        });
      },
    );
    req.on("error", reject);
  });
}

function parseFrame(frame) {
  const lines = frame.split("\n");
  const ev = {};
  for (const line of lines) {
    if (line.startsWith(":")) continue; // comment (heartbeat/connected)
    const m = line.match(/^([^:]+):\s?(.*)$/);
    if (!m) continue;
    const [, field, value] = m;
    if (field === "id") ev.id = value;
    else if (field === "event") ev.event = value;
    else if (field === "data") ev.data = value;
  }
  if (ev.data == null && ev.event == null) return null;
  if (ev.data != null) {
    try { ev.parsed = JSON.parse(ev.data); } catch {}
  }
  return ev;
}

describe("SSE /api/events/stream", () => {
  let server;
  const userId = mockUserId;
  const token = jwt.sign({ id: userId, role: "CASHIER" }, JWT_SECRET);

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
  });

  beforeEach(() => {
    seededReplayRows.length = 0;
  });

  test("delivers live events to the authenticated user", async () => {
    const ticket = await postForTicket(server, token);
    const stream = await openStream(server, { ticket });

    // Wait for subscription to attach (after the `:connected` comment is written).
    await new Promise((r) => setTimeout(r, 50));

    bus.publish(`notifications:user:${userId}`, {
      id: 1001,
      type: "NEW_CALL_CENTER_ORDER",
      payload: { orderId: 1 },
      createdAt: new Date().toISOString(),
    });

    const ev = await stream.next();
    expect(ev.event).toBe("NEW_CALL_CENTER_ORDER");
    expect(ev.id).toBe("1001");
    expect(ev.parsed).toMatchObject({
      id: 1001,
      type: "NEW_CALL_CENTER_ORDER",
      payload: { orderId: 1 },
    });

    stream.close();
  });

  test("replays missed notifications when lastEventId is provided", async () => {
    // Seed the anchor notification (id=500, the last one the client saw) so
    // findFirst(id ≤ 500) is non-null → no replay-truncated fires.
    seededReplayRows.push(
      {
        id: 500,
        userId,
        type: "NEW_CALL_CENTER_ORDER",
        payload: { orderId: 499 },
        createdAt: new Date("2026-04-20T09:59:00Z"),
      },
      {
        id: 501,
        userId,
        type: "NEW_CALL_CENTER_ORDER",
        payload: { orderId: 500 },
        createdAt: new Date("2026-04-20T10:00:00Z"),
      },
      {
        id: 502,
        userId,
        type: "ORDER_STATUS_CHANGED",
        payload: { orderId: 500, status: "PREPARING" },
        createdAt: new Date("2026-04-20T10:01:00Z"),
      },
    );

    const ticket = await postForTicket(server, token);
    const stream = await openStream(server, { ticket, lastEventId: 500 });

    const first = await stream.next();
    const second = await stream.next();

    expect(first.id).toBe("501");
    expect(first.event).toBe("NEW_CALL_CENTER_ORDER");
    expect(first.parsed.replay).toBe(true);
    expect(second.id).toBe("502");
    expect(second.event).toBe("ORDER_STATUS_CHANGED");
    expect(second.parsed.replay).toBe(true);

    stream.close();
  });

  test("emits replay-truncated when lastEventId predates all stored notifications", async () => {
    // Client last saw id=400. DB's oldest notification is id=600.
    // No row with id ≤ 400 exists → history was TTL-purged → emit replay-truncated,
    // then stream the notifications that DO exist (id=600).
    seededReplayRows.push({
      id: 600,
      userId,
      type: "NEW_CALL_CENTER_ORDER",
      payload: { orderId: 600 },
      createdAt: new Date("2026-04-21T09:00:00Z"),
    });

    const ticket = await postForTicket(server, token);
    const stream = await openStream(server, { ticket, lastEventId: 400 });

    // First frame should be the synthetic replay-truncated event.
    const first = await stream.next();
    expect(first.event).toBe("replay-truncated");

    // Then the actual missed notification (id=600) follows.
    const second = await stream.next();
    expect(second.id).toBe("600");

    stream.close();
  });

  test("rejects stream connection without a ticket", async () => {
    const { port, address } = server.address();
    const status = await new Promise((resolve, reject) => {
      const req = http.get(
        { host: address, port, path: "/api/events/stream" },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
    });
    expect(status).toBe(401);
  });

  test("rejects ticket request without a valid Bearer token", async () => {
    const { port, address } = server.address();
    const status = await new Promise((resolve, reject) => {
      const req = http.request(
        { host: address, port, path: "/api/events/ticket", method: "POST",
          headers: { "Content-Length": "0" } },
        (res) => { res.resume(); resolve(res.statusCode); },
      );
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(401);
  });
});
