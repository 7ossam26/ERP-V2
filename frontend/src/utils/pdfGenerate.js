import { renderOrderPdf } from "./pdfClient.js";

/**
 * @deprecated Bulk order invoice printing now uses `printInvoice` in
 * `src/utils/printInvoice.js` so Arabic text is rendered by the browser print engine.
 *
 * Generates an order PDF and opens it in a new browser tab.
 *
 * @param {object} order   - Full order object from the API (with items, customer, etc.)
 * @param {object|null} doc - The BulkDocument to render (provides documentNumber + type).
 *                            If null, renders a generic SALES_RECEIPT.
 */
export async function generateAndOpenOrderPdf(order, doc = null, options = {}) {
  const renderPdf = options.renderPdf ?? renderOrderPdf;
  const browserWindow = options.browserWindow ?? window;
  const urlApi = options.urlApi ?? URL;
  const documentApi = options.documentApi ?? document;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const previewTab = browserWindow.open("about:blank", "_blank");

  try {
    const blob = await renderPdf(order, doc);
    const url = urlApi.createObjectURL(blob);

    if (previewTab && !previewTab.closed) {
      previewTab.location.href = url;
    } else {
      const downloadLink = documentApi.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `${order?.orderNumber || order?.id || "order"}.pdf`;
      downloadLink.click();
    }

    setTimeoutFn(() => urlApi.revokeObjectURL(url), 60_000);
  } catch (error) {
    if (previewTab && !previewTab.closed) {
      previewTab.close();
    }

    throw error;
  }
}
