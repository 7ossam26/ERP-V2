import React from "react";
import { createRoot } from "react-dom/client";
import InventoryCountReportA4 from "../components/inventory/InventoryCountReportA4";

const PRINT_DELAY_MS = 200;

export function printInventoryCount({ items, branchName, settings = {} } = {}) {
  const container = document.createElement("div");
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
        settings,
      }),
    );
  } catch (err) {
    cleanup();
    throw err;
  }

  timerId = setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      cleanup();
      throw err;
    }
  }, PRINT_DELAY_MS);

  return cleanup;
}

export default printInventoryCount;
