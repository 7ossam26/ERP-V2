import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SUSPICIOUS = /[\u00d8\u00d9\u00c3\u00c2\uFFFD]|\u00e2\u20ac|\u00f0\u0178/;
const SOURCE_FILE = /\.(js|jsx|ts|tsx)$/;
const IGNORED_DIRS = new Set(["node_modules", "dist", "build"]);
const IGNORED_FILES = new Set(["encodingSmoke.test.js"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    if (SOURCE_FILE.test(entry.name) && !IGNORED_FILES.has(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

const offenders = walk(ROOT)
  .map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(SUSPICIOUS);

    if (!match) {
      return null;
    }

    return `${path.relative(ROOT, filePath)} -> ${match[0]}`;
  })
  .filter(Boolean);

assert.deepStrictEqual(
  offenders,
  [],
  `Found mojibake in frontend source:\n${offenders.join("\n")}`,
);

console.log("encodingSmoke.test.js passed");
