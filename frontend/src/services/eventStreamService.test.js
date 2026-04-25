import test from "node:test";
import assert from "node:assert/strict";

function installLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  return storage;
}

function installEventSourceMock() {
  class FakeEventSource {
    static instances = [];

    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.closed = false;
      this.listeners = new Map();
      FakeEventSource.instances.push(this);
    }

    addEventListener(type, fn) {
      this.listeners.set(type, fn);
    }

    close() {
      this.closed = true;
      this.readyState = 2;
    }
  }

  Object.defineProperty(globalThis, "EventSource", {
    configurable: true,
    value: FakeEventSource,
  });

  return FakeEventSource;
}

function jsonResponse(body) {
  return {
    ok: true,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? "application/json" : null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function errorResponse(status, body) {
  return {
    ok: false,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? "application/json" : null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

async function importFreshEventStream() {
  const cacheKey = `${Date.now()}-${Math.random()}`;
  return import(`./eventStreamService.js?test=${cacheKey}`);
}

test("start keeps one ticket request and one EventSource when called twice", async () => {
  installLocalStorage({
    token: "jwt",
    user: JSON.stringify({ id: 42 }),
  });
  installEventSourceMock();
  const fetchResolvers = [];

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: () => new Promise((resolve) => fetchResolvers.push(resolve)),
  });

  const { default: eventStream } = await importFreshEventStream();

  eventStream.start();
  eventStream.start();

  assert.equal(fetchResolvers.length, 1);

  fetchResolvers[0](jsonResponse({ ticket: "ticket-1" }));
  await flushMicrotasks();

  assert.ok(eventStream.source);

  eventStream.stop();
});

test("dispatch stores the replay cursor under the current user id", async () => {
  const storage = installLocalStorage({
    token: "jwt",
    user: JSON.stringify({ id: 7 }),
  });
  installEventSourceMock();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => jsonResponse({ ticket: "ticket-1" }),
  });

  const { default: eventStream } = await importFreshEventStream();

  eventStream._dispatch({
    data: JSON.stringify({ id: 99, type: "NEW_CALL_CENTER_ORDER" }),
  });

  assert.equal(storage.getItem("sse:lastEventId:7"), "99");
  assert.equal(storage.getItem("sse:lastEventId"), null);
});

test("clearReplayCursor clears the current user cursor and legacy cursor", async () => {
  const storage = installLocalStorage({
    token: "jwt",
    user: JSON.stringify({ id: 7 }),
    "sse:lastEventId:7": "99",
    "sse:lastEventId": "88",
  });
  installEventSourceMock();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => jsonResponse({ ticket: "ticket-1" }),
  });

  const { default: eventStream } = await importFreshEventStream();

  eventStream.clearReplayCursor();

  assert.equal(storage.getItem("sse:lastEventId:7"), null);
  assert.equal(storage.getItem("sse:lastEventId"), null);
});

test("ticket 401 stops instead of scheduling a reconnect storm", async () => {
  installLocalStorage({
    token: "expired-jwt",
    user: JSON.stringify({ id: 7 }),
  });
  installEventSourceMock();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => errorResponse(401, { error: "Unauthorized" }),
  });

  const { default: eventStream } = await importFreshEventStream();

  eventStream.start();
  await flushMicrotasks();

  assert.equal(eventStream.stopped, true);
  assert.equal(eventStream.status, "closed");
  assert.equal(eventStream.reconnectTimer, null);
});
