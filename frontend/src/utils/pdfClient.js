import { preloadPdfFonts } from "./pdfFonts.js";

const PDF_RENDER_TIMEOUT_MS = 30_000;

function createPdfRenderError(message, code, cause) {
  const error = new Error(message);
  error.code = code;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function createBrowserPdfWorker() {
  return new Worker(new URL("../workers/pdfWorker.js", import.meta.url), {
    type: "module",
  });
}

export function createPdfClient({
  createWorker = createBrowserPdfWorker,
  preloadFonts = preloadPdfFonts,
  timeoutMs = PDF_RENDER_TIMEOUT_MS,
  setTimeoutFn = (...args) => setTimeout(...args),
  clearTimeoutFn = (timeoutId) => clearTimeout(timeoutId),
} = {}) {
  let worker = null;
  let nextRequestId = 1;
  let didSendFonts = false;
  const pendingRequests = new Map();

  const rejectAllPending = (error) => {
    for (const request of pendingRequests.values()) {
      clearTimeoutFn(request.timeoutId);
      request.reject(error);
    }

    pendingRequests.clear();
  };

  const resetWorker = (error = null) => {
    if (worker) {
      worker.terminate();
      worker = null;
    }

    didSendFonts = false;

    if (error) {
      rejectAllPending(error);
    }
  };

  const handleWorkerMessage = (event) => {
    const data = event?.data;
    if (!data || typeof data !== "object") {
      return;
    }

    if (data.kind === "ready") {
      return;
    }

    const request = pendingRequests.get(data.id);
    if (!request) {
      return;
    }

    clearTimeoutFn(request.timeoutId);
    pendingRequests.delete(data.id);

    if (data.kind === "result") {
      request.resolve(data.blob);
      return;
    }

    if (data.kind === "error") {
      const error = createPdfRenderError(
        data.message || "Failed to generate PDF in worker",
        "PDF_RENDER_FAILED",
        data.stack ? new Error(data.stack) : undefined
      );

      if (data.stack) {
        error.workerStack = data.stack;
        error.stack = `${error.stack}\n[Worker stack]\n${data.stack}`;
      }

      request.reject(error);
    }
  };

  const handleWorkerFailure = (event) => {
    resetWorker(
      createPdfRenderError(
        event?.message || "PDF worker crashed",
        "PDF_WORKER_FAILED",
        event?.error ?? event
      )
    );
  };

  const ensureWorker = () => {
    if (worker) {
      return worker;
    }

    worker = createWorker();
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", handleWorkerFailure);
    worker.addEventListener("messageerror", handleWorkerFailure);

    return worker;
  };

  const renderOrderPdf = async (order, doc = null) => {
    const activeWorker = ensureWorker();
    const requestId = nextRequestId;
    nextRequestId += 1;

    const message = {
      kind: "render",
      id: requestId,
      order,
      doc,
    };

    if (!didSendFonts) {
      const fonts = await preloadFonts();
      message.fonts = fonts;
      didSendFonts = true;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeoutFn(() => {
        resetWorker(
          createPdfRenderError(
            "Timed out generating PDF",
            "PDF_RENDER_TIMEOUT"
          )
        );
      }, timeoutMs);

      pendingRequests.set(requestId, { resolve, reject, timeoutId });

      try {
        activeWorker.postMessage(message);
      } catch (error) {
        pendingRequests.delete(requestId);
        clearTimeoutFn(timeoutId);
        resetWorker();
        reject(
          createPdfRenderError(
            "Failed to dispatch PDF render to worker",
            "PDF_WORKER_POST_FAILED",
            error
          )
        );
      }
    });
  };

  const terminate = () => {
    resetWorker(
      createPdfRenderError("PDF worker terminated", "PDF_WORKER_TERMINATED")
    );
  };

  return {
    renderOrderPdf,
    terminate,
  };
}

const defaultPdfClient = createPdfClient();

export function renderOrderPdf(order, doc = null) {
  return defaultPdfClient.renderOrderPdf(order, doc);
}

export function terminatePdfWorkerForTests() {
  defaultPdfClient.terminate();
}
