import test from "node:test";
import assert from "node:assert/strict";
import React from "react";

import { PRINT_INVOICE_DELAY_MS, printInvoice } from "./printInvoice.js";

test("printInvoice mounts the invoice view, updates the title, prints, and cleans up after afterprint", () => {
  const appendedNodes = [];
  const clearedTimers = [];
  const timers = [];
  let afterprintHandler = null;
  let removedAfterprintHandler = null;

  const container = {
    removeCalls: 0,
    remove() {
      this.removeCalls += 1;
    },
  };

  const root = {
    renderedNode: null,
    unmountCalls: 0,
    render(node) {
      this.renderedNode = node;
    },
    unmount() {
      this.unmountCalls += 1;
    },
  };

  const documentApi = {
    title: "ERP Dashboard",
    body: {
      appendChild(node) {
        appendedNodes.push(node);
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "div");
      return container;
    },
  };

  const browserWindow = {
    printCalls: 0,
    addEventListener(type, handler) {
      assert.equal(type, "afterprint");
      afterprintHandler = handler;
    },
    removeEventListener(type, handler) {
      assert.equal(type, "afterprint");
      removedAfterprintHandler = handler;
    },
    print() {
      this.printCalls += 1;
    },
  };

  printInvoice(
    { id: 5, orderNumber: "BULK-0005" },
    { type: "TAX_INVOICE", documentNumber: "INV-0005" },
    {
      component: ({ order, doc }) =>
        React.createElement("div", {
          "data-order-number": order.orderNumber,
          "data-doc-number": doc.documentNumber,
        }),
      createRootFn(node) {
        assert.strictEqual(node, container);
        return root;
      },
      documentApi,
      browserWindow,
      setTimeoutFn(callback, ms) {
        timers.push({ callback, ms });
        return timers.length;
      },
      clearTimeoutFn(timerId) {
        clearedTimers.push(timerId);
      },
    }
  );

  assert.deepEqual(appendedNodes, [container]);
  assert.equal(documentApi.title, "INV-0005");
  assert.ok(root.renderedNode);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, PRINT_INVOICE_DELAY_MS);

  timers[0].callback();

  assert.equal(browserWindow.printCalls, 1);

  afterprintHandler();

  assert.equal(root.unmountCalls, 1);
  assert.equal(container.removeCalls, 1);
  assert.equal(documentApi.title, "ERP Dashboard");
  assert.strictEqual(removedAfterprintHandler, afterprintHandler);
  assert.deepEqual(clearedTimers, [1]);

  afterprintHandler();

  assert.equal(root.unmountCalls, 1);
  assert.equal(container.removeCalls, 1);
});

test("printInvoice cleans up immediately when rendering the print surface fails", () => {
  const clearedTimers = [];
  let afterprintHandler = null;
  let removedAfterprintHandler = null;

  const container = {
    removeCalls: 0,
    remove() {
      this.removeCalls += 1;
    },
  };

  const documentApi = {
    title: "ERP Dashboard",
    body: {
      appendChild() {},
    },
    createElement() {
      return container;
    },
  };

  const browserWindow = {
    addEventListener(type, handler) {
      assert.equal(type, "afterprint");
      afterprintHandler = handler;
    },
    removeEventListener(type, handler) {
      assert.equal(type, "afterprint");
      removedAfterprintHandler = handler;
    },
    print() {
      throw new Error("print should not be called");
    },
  };

  const root = {
    unmountCalls: 0,
    render() {
      throw new Error("render failed");
    },
    unmount() {
      this.unmountCalls += 1;
    },
  };

  assert.throws(
    () =>
      printInvoice(
        { id: 8, orderNumber: "BULK-0008" },
        { type: "SALES_RECEIPT", documentNumber: "INV-0008" },
        {
          createRootFn() {
            return root;
          },
          documentApi,
          browserWindow,
          clearTimeoutFn(timerId) {
            clearedTimers.push(timerId);
          },
        }
      ),
    /render failed/
  );

  assert.equal(root.unmountCalls, 1);
  assert.equal(container.removeCalls, 1);
  assert.equal(documentApi.title, "ERP Dashboard");
  assert.strictEqual(removedAfterprintHandler, afterprintHandler);
  assert.deepEqual(clearedTimers, []);
});
