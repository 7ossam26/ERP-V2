import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { create } from "./fontkitPatched.js";

test("fontkitPatched subsets Cairo Arabic glyphs without DataView range errors", () => {
  const fontBuffer = readFileSync(
    new URL("../../public/fonts/Cairo-Regular.woff2", import.meta.url)
  );
  const font = create(new Uint8Array(fontBuffer));
  const run = font.layout("إيصال بيع شكراً لتعاملكم معنا");
  const subset = font.createSubset();

  for (const glyph of run.glyphs) {
    subset.includeGlyph(glyph.id);
  }

  assert.doesNotThrow(() => subset.encode());
});
