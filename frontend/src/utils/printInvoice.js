import React from "react";
import { createRoot } from "react-dom/client";
import BulkInvoicePrint from "../components/bulk/BulkInvoicePrint.js";

export const PRINT_INVOICE_DELAY_MS = 150;

function getPrintInvoiceTitle(order, doc) {
  return doc?.documentNumber || order?.orderNumber || order?.id?.toString() || "invoice";
}

/**
 * Mounts a dedicated HTML invoice print surface and opens the browser print dialog.
 *
 * @param {object} order
 * @param {object|null} doc
 * @param {object} options
 * @returns {() => void} idempotent cleanup handler
 */
export function printInvoice(order, doc = null, options = {}) {
  const component = options.component ?? BulkInvoicePrint;
  const settings = options.settings ?? null;
  const createRootFn = options.createRootFn ?? createRoot;
  const documentApi = options.documentApi ?? document;
  const browserWindow = options.browserWindow ?? window;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

  const container = documentApi.createElement("div");
  const originalTitle = documentApi.title;
  const root = createRootFn(container);

  let cleanedUp = false;
  let printTimerId = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    if (printTimerId !== null) {
      clearTimeoutFn(printTimerId);
    }

    if (typeof browserWindow.removeEventListener === "function") {
      browserWindow.removeEventListener("afterprint", cleanup);
    }

    root.unmount();
    container.remove();
    documentApi.title = originalTitle;
  };

  documentApi.body.appendChild(container);
  documentApi.title = getPrintInvoiceTitle(order, doc);

  if (typeof browserWindow.addEventListener === "function") {
    browserWindow.addEventListener("afterprint", cleanup);
  }

  try {
    root.render(
      React.createElement(component, {
        order,
        doc,
        settings,
      })
    );
  } catch (error) {
    cleanup();
    throw error;
  }

  printTimerId = setTimeoutFn(() => {
    try {
      browserWindow.print();
    } catch (error) {
      cleanup();
      throw error;
    }
  }, PRINT_INVOICE_DELAY_MS);

  return cleanup;
}
