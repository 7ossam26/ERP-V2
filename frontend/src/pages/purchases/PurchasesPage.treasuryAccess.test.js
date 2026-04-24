import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./PurchasesPage.jsx", import.meta.url), "utf8");

test("purchase entry does not hard-require treasury list during initial bootstrap", () => {
  const promiseAllBlocks = Array.from(
    source.matchAll(/Promise\.all\(\s*\[([\s\S]*?)\]\s*\)/g),
    (match) => match[1],
  );

  assert.equal(
    promiseAllBlocks.some((block) => block.includes("treasuryService.getAll(")),
    false,
  );
});
