import React from "react";
import { createRoot } from "react-dom/client";
import InventoryCountReportA4 from "../components/inventory/InventoryCountReportA4";

const PRINT_DELAY_MS = 200;

export function printInventoryCount({
  items,
  branchName,
  includePrices = true,
  settings = {},
} = {}) {
  const container = document.createElement("div");
  // Marks this node as the only body child that stays in the print layout —
  // the report CSS hides every other body child to avoid blank pages.
  container.setAttribute("data-print-root", "");
  const originalTitle = document.title;
  const root = createRoot(container);
  const printedAt = new Date().toISOString();

  let cleanedUp = false;
  let timerId = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (timerId !== null) clearTimeout(timerId);
    window.removeEventListener("afterprint", cleanup);
    root.unmount();
    container.remove();
    document.title = originalTitle;
  };

  document.body.appendChild(container);
  document.title = `جرد-${branchName || ""}`;
  window.addEventListener("afterprint", cleanup);

  try {
    root.render(
      React.createElement(InventoryCountReportA4, {
        items,
        branchName,
        printedAt,
        includePrices,
        settings,
      }),
    );
  } catch (err) {
    cleanup();
    throw err;
  }

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      window.print();
    } catch (err) {
      cleanup();
      throw err;
    }
  };

  // Wait for the logo (and any other images) to finish loading before printing
  // so it isn't dropped from the first print. A hard fallback guards the case
  // where an image never resolves.
  const waitForImages = () => {
    const imgs = Array.from(container.querySelectorAll("img"));
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length === 0) {
      timerId = setTimeout(doPrint, PRINT_DELAY_MS);
      return;
    }
    let remaining = pending.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) doPrint();
    };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    // Fallback: print anyway after 1.5s even if an image is stuck.
    timerId = setTimeout(doPrint, 1500);
  };

  // Let React paint the DOM first, then wait on images.
  timerId = setTimeout(waitForImages, PRINT_DELAY_MS);

  return cleanup;
}

export default printInventoryCount;
