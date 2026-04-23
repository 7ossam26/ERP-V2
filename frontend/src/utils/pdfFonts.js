const PDF_FONT_FILES = Object.freeze({
  regular: "fonts/Cairo-Regular.woff2",
  latin: "fonts/Cairo-Latin-Regular.woff2",
});

function getPdfBaseUrl() {
  const baseUrl = import.meta.env?.BASE_URL ?? "/";
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function buildPdfFontUrl(fontFile) {
  const origin = globalThis.location?.origin;
  if (!origin) {
    throw new Error("PDF font preload requires a browser location origin");
  }

  return new URL(fontFile, `${origin}${getPdfBaseUrl()}`).toString();
}

async function fetchPdfFontBuffer(fetchImpl, url) {
  const response = await fetchImpl(url);

  if (!response?.ok) {
    throw new Error(`Failed to preload PDF font: ${url}`);
  }

  if (typeof response.arrayBuffer === "function") {
    await response.arrayBuffer();
  }

  return url;
}

export function createPdfFontPreloader({
  fetchImpl = (...args) => fetch(...args),
  fontUrls,
} = {}) {
  let preloadPromise = null;

  return {
    preload() {
      if (!preloadPromise) {
        const resolvedFontUrls = fontUrls ?? {
          regular: buildPdfFontUrl(PDF_FONT_FILES.regular),
          latin: buildPdfFontUrl(PDF_FONT_FILES.latin),
        };

        preloadPromise = Promise.all([
          fetchPdfFontBuffer(fetchImpl, resolvedFontUrls.regular),
          fetchPdfFontBuffer(fetchImpl, resolvedFontUrls.latin),
        ])
          .then(() => resolvedFontUrls)
          .catch((error) => {
            preloadPromise = null;
            throw error;
          });
      }

      return preloadPromise;
    },
  };
}

const defaultPdfFontPreloader = createPdfFontPreloader();

export function preloadPdfFonts() {
  return defaultPdfFontPreloader.preload();
}
