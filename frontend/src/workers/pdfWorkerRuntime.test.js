import test from "node:test";
import assert from "node:assert/strict";

import {
  createPdfWorkerModuleLoader,
  installPdfWorkerGlobals,
} from "./pdfWorkerRuntime.js";

test("installPdfWorkerGlobals aliases window to the worker global", () => {
  const workerGlobal = {
    navigator: { userAgent: "worker" },
  };

  installPdfWorkerGlobals(workerGlobal);

  assert.strictEqual(workerGlobal.window, workerGlobal);
  assert.strictEqual(workerGlobal.self, workerGlobal);
  assert.deepEqual(workerGlobal.navigator, { userAgent: "worker" });
});

test("createPdfWorkerModuleLoader installs globals before loading react-pdf modules", async () => {
  const workerGlobal = {
    navigator: { userAgent: "worker" },
  };
  const callOrder = [];

  const loadModules = createPdfWorkerModuleLoader({
    globalTarget: workerGlobal,
    installGlobals: (target) => {
      callOrder.push("installGlobals");
      installPdfWorkerGlobals(target);
    },
    importReact: async () => {
      callOrder.push(`react:${workerGlobal.window === workerGlobal}`);
      return { default: { createElement: () => ({}) } };
    },
    importRenderer: async () => {
      callOrder.push(`renderer:${workerGlobal.window === workerGlobal}`);
      return { Font: { register: () => {} }, pdf: () => ({}) };
    },
    importInvoice: async () => {
      callOrder.push(`invoice:${workerGlobal.window === workerGlobal}`);
      return { default: function BulkInvoicePDF() {} };
    },
  });

  const modules = await loadModules();

  assert.equal(typeof modules.React.createElement, "function");
  assert.equal(typeof modules.Font.register, "function");
  assert.equal(typeof modules.BulkInvoicePDF, "function");
  assert.deepEqual(callOrder, [
    "installGlobals",
    "react:true",
    "renderer:true",
    "invoice:true",
  ]);
});

test("createPdfWorkerModuleLoader memoizes loaded modules", async () => {
  let reactImports = 0;
  let rendererImports = 0;
  let invoiceImports = 0;

  const loadModules = createPdfWorkerModuleLoader({
    globalTarget: {},
    importReact: async () => {
      reactImports += 1;
      return { default: { createElement: () => ({}) } };
    },
    importRenderer: async () => {
      rendererImports += 1;
      return { Font: { register: () => {} }, pdf: () => ({}) };
    },
    importInvoice: async () => {
      invoiceImports += 1;
      return { default: function BulkInvoicePDF() {} };
    },
  });

  const firstLoad = await loadModules();
  const secondLoad = await loadModules();

  assert.strictEqual(firstLoad, secondLoad);
  assert.equal(reactImports, 1);
  assert.equal(rendererImports, 1);
  assert.equal(invoiceImports, 1);
});
