export function installPdfWorkerGlobals(globalTarget = globalThis) {
  if (typeof globalTarget.self === "undefined") {
    globalTarget.self = globalTarget;
  }

  if (typeof globalTarget.window === "undefined") {
    globalTarget.window = globalTarget;
  }

  return globalTarget;
}

export function createPdfWorkerModuleLoader({
  globalTarget = globalThis,
  installGlobals = installPdfWorkerGlobals,
  importReact = () => import("react"),
  importRenderer = () => import("@react-pdf/renderer"),
  importInvoice = () => import("../components/bulk/BulkInvoicePDF.js"),
} = {}) {
  let modulesPromise = null;

  return () => {
    if (!modulesPromise) {
      installGlobals(globalTarget);

      modulesPromise = Promise.all([
        importReact(),
        importRenderer(),
        importInvoice(),
      ])
        .then(([reactModule, rendererModule, invoiceModule]) => ({
          React: reactModule.default ?? reactModule,
          Font: rendererModule.Font,
          pdf: rendererModule.pdf,
          BulkInvoicePDF: invoiceModule.default,
        }))
        .catch((error) => {
          modulesPromise = null;
          throw error;
        });
    }

    return modulesPromise;
  };
}

export const loadPdfWorkerModules = createPdfWorkerModuleLoader();
