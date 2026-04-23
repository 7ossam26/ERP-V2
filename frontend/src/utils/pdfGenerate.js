import React from "react";
import { pdf } from "@react-pdf/renderer";
import BulkInvoicePDF from "../components/bulk/BulkInvoicePDF";

/**
 * Generates an order PDF and opens it in a new browser tab.
 *
 * @param {object} order   - Full order object from the API (with items, customer, etc.)
 * @param {object|null} doc - The BulkDocument to render (provides documentNumber + type).
 *                            If null, renders a generic SALES_RECEIPT.
 */
export async function generateAndOpenOrderPdf(order, doc = null) {
  const blob = await pdf(
    React.createElement(BulkInvoicePDF, { order, doc })
  ).toBlob();

  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");

  // Release the object URL after the browser has had time to load it
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
