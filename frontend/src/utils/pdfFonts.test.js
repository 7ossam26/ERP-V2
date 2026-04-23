import test from "node:test";
import assert from "node:assert/strict";

import { createPdfFontPreloader } from "./pdfFonts.js";

test("createPdfFontPreloader memoizes font fetches", async () => {
  const requestedUrls = [];
  const fontUrls = {
    regular: "/fonts/Cairo-Regular.woff2",
    latin: "/fonts/Cairo-Latin-Regular.woff2",
  };
  const preloader = createPdfFontPreloader({
    fontUrls,
    fetchImpl: async (url) => {
      requestedUrls.push(url);

      return {
        ok: true,
      };
    },
  });

  const firstPromise = preloader.preload();
  const secondPromise = preloader.preload();

  assert.strictEqual(firstPromise, secondPromise);

  const urls = await firstPromise;

  assert.deepEqual(requestedUrls, [fontUrls.regular, fontUrls.latin]);
  assert.deepEqual(urls, fontUrls);
});

test("createPdfFontPreloader retries after a failed preload", async () => {
  const fontUrls = {
    regular: "/fonts/Cairo-Regular.woff2",
    latin: "/fonts/Cairo-Latin-Regular.woff2",
  };
  let firstAttempt = true;

  const preloader = createPdfFontPreloader({
    fontUrls,
    fetchImpl: async (url) => {
      if (firstAttempt && url === fontUrls.regular) {
        return {
          ok: false,
          status: 503,
        };
      }

      firstAttempt = false;

      return {
        ok: true,
      };
    },
  });

  await assert.rejects(preloader.preload(), /Failed to preload PDF font/);

  const urls = await preloader.preload();

  assert.deepEqual(urls, fontUrls);
});
