import React from "react";
import { createRoot } from "react-dom/client";
import DeliveryTicketPrint from "../components/pos/DeliveryTicketPrint.jsx";

const PRINT_DELAY_MS = 150;

/**
 * Mounts a hidden 80mm delivery ticket and triggers the browser print dialog.
 * Mirrors the shape of printInvoice() but dedicated to dispatched call-center orders.
 */
export function printDeliveryTicket(order, settings = null) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const originalTitle = document.title;
  let cleaned = false;
  let timerId = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (timerId) clearTimeout(timerId);
    window.removeEventListener("afterprint", cleanup);
    root.unmount();
    container.remove();
    document.title = originalTitle;
  };

  document.body.appendChild(container);
  document.title = `ticket-${order?.sale?.saleNumber || order?.id || "order"}`;
  window.addEventListener("afterprint", cleanup);

  try {
    root.render(React.createElement(DeliveryTicketPrint, { order, settings }));
  } catch (err) {
    cleanup();
    throw err;
  }

  timerId = setTimeout(() => {
    try { window.print(); } catch (err) { cleanup(); throw err; }
  }, PRINT_DELAY_MS);

  return cleanup;
}

export default printDeliveryTicket;
