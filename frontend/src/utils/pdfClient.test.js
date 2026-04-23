import test from "node:test";
import assert from "node:assert/strict";

import { createPdfClient } from "./pdfClient.js";

class MockWorker {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(message, transfer) {
    this.messages.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function makeFontUrls() {
  return {
    regular: "/fonts/Cairo-Regular.woff2",
    latin: "/fonts/Cairo-Latin-Regular.woff2",
  };
}

test("createPdfClient sends font URLs only with the first render request", async () => {
  const workers = [];
  let preloadCalls = 0;
  const client = createPdfClient({
    createWorker: () => {
      const worker = new MockWorker();
      workers.push(worker);
      return worker;
    },
    preloadFonts: async () => {
      preloadCalls += 1;
      return makeFontUrls();
    },
    timeoutMs: 30_000,
    setTimeoutFn: () => ({ cleared: false }),
    clearTimeoutFn: () => {},
  });

  const firstRender = client.renderOrderPdf({ id: 1 }, null);
  await Promise.resolve();

  assert.equal(workers.length, 1);
  assert.equal(preloadCalls, 1);
  assert.equal(workers[0].messages.length, 1);
  assert.ok(workers[0].messages[0].message.fonts);
  assert.deepEqual(workers[0].messages[0].message.fonts, makeFontUrls());
  assert.equal(workers[0].messages[0].transfer, undefined);

  const firstBlob = new Blob(["first"]);
  workers[0].emit("message", {
    data: { kind: "result", id: 1, blob: firstBlob },
  });

  assert.strictEqual(await firstRender, firstBlob);

  const secondRender = client.renderOrderPdf({ id: 2 }, { type: "SALES_RECEIPT" });
  await Promise.resolve();

  assert.equal(preloadCalls, 1);
  assert.equal(workers[0].messages.length, 2);
  assert.equal(workers[0].messages[1].message.fonts, undefined);
  assert.equal(workers[0].messages[1].transfer, undefined);

  const secondBlob = new Blob(["second"]);
  workers[0].emit("message", {
    data: { kind: "result", id: 2, blob: secondBlob },
  });

  assert.strictEqual(await secondRender, secondBlob);
});

test("createPdfClient terminates and recreates the worker after a timeout", async () => {
  const workers = [];
  const timers = [];
  const client = createPdfClient({
    createWorker: () => {
      const worker = new MockWorker();
      workers.push(worker);
      return worker;
    },
    preloadFonts: async () => makeFontUrls(),
    timeoutMs: 30_000,
    setTimeoutFn: (callback, ms) => {
      const timer = { callback, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      timer.cleared = true;
    },
  });

  const timedOutRender = client.renderOrderPdf({ id: 99 }, null);
  await Promise.resolve();

  assert.equal(workers.length, 1);
  assert.equal(timers.length, 1);

  timers[0].callback();

  await assert.rejects(
    timedOutRender,
    (error) => error?.code === "PDF_RENDER_TIMEOUT"
  );

  assert.equal(workers[0].terminated, true);

  const recoveryRender = client.renderOrderPdf({ id: 100 }, null);
  await Promise.resolve();

  assert.equal(workers.length, 2);

  const recoveryBlob = new Blob(["recovered"]);
  workers[1].emit("message", {
    data: { kind: "result", id: 2, blob: recoveryBlob },
  });

  assert.strictEqual(await recoveryRender, recoveryBlob);
});
