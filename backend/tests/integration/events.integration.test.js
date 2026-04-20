// SSE integration test (design §9.2).
// Boots the events router on an ephemeral port. Uses a raw HTTP client
// to parse SSE frames so we don't pull in an extra dependency.
// The `config/database` module is mocked — the only Prisma call in this
// route is `notification.findMany` for Last-Event-ID replay.

const seededReplayRows = [];

jest.mock("../../config/database", () => ({
  notification: {
    findMany: jest.fn(async ({ where }) => {
      const gt = where?.id?.gt ?? 0;
      return seededReplayRows.filter((r) => r.id > gt);
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
  app.use("/api/events", require("../../routes/events"));
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function openStream(server, { token, lastEventId }) {
  const { port, address } = server.address();
  const qs = new URLSearchParams({ token });
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
  if (ev.data == null) return null;
  try {
    ev.parsed = JSON.parse(ev.data);
  } catch {}
  return ev;
}

describe("SSE /api/events/stream", () => {
  let server;
  const userId = 42;
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
    const stream = await openStream(server, { token });

    // Wait briefly for subscription to attach (after "connected" comment is written).
    // The `:connected` is a comment and is filtered out by parseFrame.
    await new Promise((r) => setTimeout(r, 50));

    const publishPromise = bus.publish(`notifications:user:${userId}`, {
      id: 1001,
      type: "NEW_CALL_CENTER_ORDER",
      payload: { orderId: 1 },
      createdAt: new Date().toISOString(),
    });
    await publishPromise;

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
    seededReplayRows.push(
      {
        id: 501,
        type: "NEW_CALL_CENTER_ORDER",
        payload: { orderId: 500 },
        createdAt: new Date("2026-04-20T10:00:00Z"),
      },
      {
        id: 502,
        type: "ORDER_STATUS_CHANGED",
        payload: { orderId: 500, status: "PREPARING" },
        createdAt: new Date("2026-04-20T10:01:00Z"),
      },
    );

    const stream = await openStream(server, { token, lastEventId: 500 });

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

  test("rejects connection without a token", async () => {
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
});
