import { loadPdfWorkerModules } from "./pdfWorkerRuntime.js";

let fontsRegistered = false;

function registerPdfFonts(Font, fonts) {
  if (fontsRegistered) {
    return;
  }

  if (!fonts?.regular || !fonts?.latin) {
    throw new Error("Missing PDF font buffers for worker render");
  }

  Font.register({
    family: "Cairo",
    fonts: [{ src: fonts.regular }, { src: fonts.latin }],
  });

  fontsRegistered = true;
}

self.addEventListener("message", async (event) => {
  const data = event?.data;
  if (!data || data.kind !== "render") {
    return;
  }

  try {
    const { React, Font, pdf, BulkInvoicePDF } = await loadPdfWorkerModules();

    if (!fontsRegistered) {
      registerPdfFonts(Font, data.fonts);
    }

    const blob = await pdf(
      React.createElement(BulkInvoicePDF, {
        order: data.order,
        doc: data.doc ?? null,
      })
    ).toBlob();

    self.postMessage({
      kind: "result",
      id: data.id,
      blob,
    });
  } catch (error) {
    self.postMessage({
      kind: "error",
      id: data.id,
      message: error?.message || "Failed to render PDF",
      stack: error?.stack,
    });
  }
});

self.postMessage({ kind: "ready" });
