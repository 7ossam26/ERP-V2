import test from "node:test";
import assert from "node:assert/strict";

import { generateAndOpenOrderPdf } from "./pdfGenerate.js";

test("generateAndOpenOrderPdf opens a blank tab before rendering and navigates it to the blob URL", async () => {
  const openedWindow = {
    closed: false,
    closeCalled: false,
    location: { href: "about:blank" },
    close() {
      this.closeCalled = true;
      this.closed = true;
    },
  };
  const scheduled = [];
  const revokedUrls = [];
  const blob = new Blob(["pdf"]);

  await generateAndOpenOrderPdf(
    { id: 15, orderNumber: "SO-15" },
    { type: "SALES_RECEIPT" },
    {
      renderPdf: async () => blob,
      browserWindow: {
        open: (url, target) => {
          assert.equal(url, "about:blank");
          assert.equal(target, "_blank");
          return openedWindow;
        },
      },
      urlApi: {
        createObjectURL: (value) => {
          assert.strictEqual(value, blob);
          return "blob:pdf-15";
        },
        revokeObjectURL: (url) => {
          revokedUrls.push(url);
        },
      },
      documentApi: {
        createElement: () => {
          throw new Error("anchor fallback should not run when the tab stays open");
        },
      },
      setTimeoutFn: (callback, ms) => {
        scheduled.push({ callback, ms });
        return scheduled.length;
      },
    }
  );

  assert.equal(openedWindow.location.href, "blob:pdf-15");
  assert.equal(openedWindow.closeCalled, false);
  assert.deepEqual(scheduled.map((timer) => timer.ms), [60_000]);

  scheduled[0].callback();

  assert.deepEqual(revokedUrls, ["blob:pdf-15"]);
});

test("generateAndOpenOrderPdf closes the blank tab when rendering fails", async () => {
  const openedWindow = {
    closed: false,
    closeCalled: false,
    location: { href: "about:blank" },
    close() {
      this.closeCalled = true;
      this.closed = true;
    },
  };

  await assert.rejects(
    generateAndOpenOrderPdf(
      { id: 16, orderNumber: "SO-16" },
      null,
      {
        renderPdf: async () => {
          throw new Error("worker exploded");
        },
        browserWindow: {
          open: () => openedWindow,
        },
        urlApi: {
          createObjectURL: () => "blob:pdf-16",
          revokeObjectURL: () => {},
        },
        documentApi: {
          createElement: () => {
            throw new Error("anchor fallback should not run on failures");
          },
        },
        setTimeoutFn: () => 1,
      }
    ),
    /worker exploded/
  );

  assert.equal(openedWindow.closeCalled, true);
});
