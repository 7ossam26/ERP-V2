import React from "react";
import { createRoot } from "react-dom/client";
import ShiftReport80mm from "../components/shifts/ShiftReport80mm";

const PRINT_DELAY_MS = 200;

export function printShiftReport(report, settings = {}) {
  if (!report) return () => {};

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
  document.title = `shift-${report.shiftId || ""}-report`;
  window.addEventListener("afterprint", cleanup);

  try {
    root.render(
      React.createElement(ShiftReport80mm, { report, settings }),
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

export default printShiftReport;
