import React from "react";
import { createRoot } from "react-dom/client";
import ThermalReceipt80mm from "../components/pos/ThermalReceipt80mm";

const PRINT_DELAY_MS = 200;

export function printThermalReceipt(sale, settings = {}) {
  if (!sale) return () => {};

  const container = document.createElement("div");
  const originalTitle = document.title;
  const root = createRoot(container);

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
  document.title = sale.saleNumber || `sale-${sale.id || ""}`;
  window.addEventListener("afterprint", cleanup);

  try {
    root.render(
      React.createElement(ThermalReceipt80mm, { sale, settings }),
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

export default printThermalReceipt;
