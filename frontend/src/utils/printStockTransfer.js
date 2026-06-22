import React from "react";
import { createRoot } from "react-dom/client";
import StockTransferReceipt80mm from "../components/stock/StockTransferReceipt80mm";

const PRINT_DELAY_MS = 200;

export function printStockTransfer(transfer, settings = {}) {
  if (!transfer) return () => {};

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
  document.title = `transfer-${transfer.transferNumber || ""}`;
  window.addEventListener("afterprint", cleanup);

  try {
    root.render(
      React.createElement(StockTransferReceipt80mm, { transfer, settings }),
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

export default printStockTransfer;
