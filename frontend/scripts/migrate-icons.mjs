#!/usr/bin/env node
/**
 * Icon Migration Codemod — Phase 12b-UI
 *
 * Replaces:
 *   <span className="material-icons-round ...">icon_name</span>
 *   <span className="material-symbols-outlined ...">icon_name</span>
 * With:
 *   <Icon name="icon_name" className="..." />
 *
 * Also adds the Icon import to each modified file.
 *
 * Usage: node frontend/scripts/migrate-icons.mjs [--dry-run]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "../src");
const DRY_RUN = process.argv.includes("--dry-run");

// Icon component path (relative import will be computed per file)
const ICON_COMPONENT_PATH = "components/ui/Icon";

let totalFiles = 0;
let modifiedFiles = 0;
let totalReplacements = 0;

/**
 * Recursively find all .jsx files in a directory
 */
function findJsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsxFiles(full));
    } else if (entry.name.endsWith(".jsx") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Compute relative import path from a file to the Icon component
 */
function relativeImport(filePath) {
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, path.join(SRC_DIR, ICON_COMPONENT_PATH));
  rel = rel.replace(/\\/g, "/"); // Windows path fix
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

/**
 * Main migration: replace material icon spans with <Icon> in a single file
 */
function migrateFile(filePath) {
  totalFiles++;
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;

  // Skip the Icon component itself
  if (filePath.includes("Icon.jsx") && filePath.includes("components")) return;

  let replacements = 0;

  // Pattern 1: Single-line material-icons-round / material-symbols-outlined spans
  // Matches: <span className="material-icons-round text-xl text-red-500">error</span>
  // Also handles className with template literals using backticks
  const singleLineRe = /<span\s+className=(?:"([^"]*(?:material-icons-round|material-symbols-outlined)[^"]*)"|{`([^`]*(?:material-icons-round|material-symbols-outlined)[^`]*)`})>\s*([A-Za-z_]+)\s*<\/span>/g;

  content = content.replace(singleLineRe, (match, classStr, templateClassStr, iconName) => {
    const cls = classStr || templateClassStr || "";
    const cleaned = cls
      .replace(/material-icons-round/g, "")
      .replace(/material-symbols-outlined/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    replacements++;
    if (cleaned) {
      return `<Icon name="${iconName}" className="${cleaned}" />`;
    }
    return `<Icon name="${iconName}" />`;
  });

  // Pattern 2: Multi-line — className on one line, icon name on next line(s)
  // <span className="material-icons-round text-xl">
  //   icon_name
  // </span>
  const multiLineRe = /<span\s+className=(?:"([^"]*(?:material-icons-round|material-symbols-outlined)[^"]*)"|{`([^`]*(?:material-icons-round|material-symbols-outlined)[^`]*)`})\s*>\s*\n\s*([A-Za-z_]+)\s*\n\s*<\/span>/g;

  content = content.replace(multiLineRe, (match, classStr, templateClassStr, iconName) => {
    const cls = classStr || templateClassStr || "";
    const cleaned = cls
      .replace(/material-icons-round/g, "")
      .replace(/material-symbols-outlined/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    replacements++;
    if (cleaned) {
      return `<Icon name="${iconName}" className="${cleaned}" />`;
    }
    return `<Icon name="${iconName}" />`;
  });

  // Pattern 3: Dynamic className with conditional material-icons/symbols
  // className={`material-icons-round text-lg ${condition ? "x" : ""}`}
  // These need manual review — just flag them
  const dynamicRe = /<span\s+className=\{`[^`]*(?:material-icons-round|material-symbols-outlined)[^`]*`\}\s*>/g;
  const dynamicMatches = content.match(dynamicRe);
  if (dynamicMatches) {
    // Try to handle common pattern: className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>
    const dynamicFullRe = /<span\s+className=\{`([^`]*(?:material-icons-round|material-symbols-outlined)[^`]*)`\}\s*>\s*\n?\s*([A-Za-z_]+)\s*\n?\s*<\/span>/g;

    content = content.replace(dynamicFullRe, (match, cls, iconName) => {
      // Extract the static parts and dynamic parts
      const cleaned = cls
        .replace(/material-icons-round/g, "")
        .replace(/material-symbols-outlined/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      replacements++;
      // Keep the template literal for dynamic parts
      if (cleaned.includes("${")) {
        return `<Icon name="${iconName}" className={\`${cleaned}\`} />`;
      }
      if (cleaned) {
        return `<Icon name="${iconName}" className="${cleaned}" />`;
      }
      return `<Icon name="${iconName}" />`;
    });
  }

  // If we made replacements, add the import
  if (replacements > 0 && !content.includes("from") || (replacements > 0 && !content.includes(`"${relativeImport(filePath)}"`))) {
    // Check if Icon is already imported
    if (!content.match(/import\s+Icon\s+from\s+["']/)) {
      const importPath = relativeImport(filePath);
      const importLine = `import Icon from "${importPath}";\n`;

      // Insert after the last existing import
      const lastImportIdx = content.lastIndexOf("\nimport ");
      if (lastImportIdx !== -1) {
        const endOfLine = content.indexOf("\n", lastImportIdx + 1);
        content = content.slice(0, endOfLine + 1) + importLine + content.slice(endOfLine + 1);
      } else {
        // No imports found — add at top
        content = importLine + content;
      }
    }
  }

  if (content !== original) {
    modifiedFiles++;
    totalReplacements += replacements;

    if (DRY_RUN) {
      console.log(`[DRY] ${path.relative(SRC_DIR, filePath)} — ${replacements} replacements`);
    } else {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`[OK]  ${path.relative(SRC_DIR, filePath)} — ${replacements} replacements`);
    }
  }
}

// --- Main ---
console.log(`\nIcon Migration Codemod — Phase 12b-UI`);
console.log(`Source: ${SRC_DIR}`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

const files = findJsxFiles(SRC_DIR);
for (const f of files) {
  migrateFile(f);
}

console.log(`\n--- Summary ---`);
console.log(`Total files scanned: ${totalFiles}`);
console.log(`Files modified: ${modifiedFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(DRY_RUN ? "\n(Dry run — no files changed)" : "\nDone!");
