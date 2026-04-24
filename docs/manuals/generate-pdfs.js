const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const MANUALS_DIR = path.join(ROOT, "docs", "manuals");
const OUTPUT_DIR = path.join(MANUALS_DIR, "pdf");
const TEMP_DIR = path.join(OUTPUT_DIR, ".html");
const LOGO_PATH = path.join(ROOT, "frontend", "public", "assets", "logo.png");

const MANUAL_FILES = [
  "manual-owner.md",
  "manual-branch-manager.md",
  "manual-cashier.md",
  "manual-warehouse-keeper.md",
  "manual-accountant.md",
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDataUri(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  const mimeType =
    extension === "png"
      ? "image/png"
      : extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : "application/octet-stream";

  const buffer = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function applyInlineFormatting(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(markdown, fileDir) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      blocks.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      closeList();
      const imagePath = path.resolve(fileDir, imageMatch[2]);
      if (fs.existsSync(imagePath)) {
        blocks.push(
          `<figure><img src="${toDataUri(imagePath)}" alt="${escapeHtml(
            imageMatch[1],
          )}" /></figure>`,
        );
      }
      continue;
    }

    if (trimmed.startsWith("# ")) {
      closeList();
      blocks.push(`<h1>${applyInlineFormatting(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      closeList();
      blocks.push(`<h2>${applyInlineFormatting(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeList();
      blocks.push(`<h3>${applyInlineFormatting(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      closeList();
      blocks.push(
        `<div class="callout">${applyInlineFormatting(trimmed.slice(2))}</div>`,
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        blocks.push("<ul>");
        inList = true;
      }
      blocks.push(`<li>${applyInlineFormatting(trimmed.slice(2))}</li>`);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      closeList();
      blocks.push(`<p class="step">${applyInlineFormatting(trimmed)}</p>`);
      continue;
    }

    closeList();
    blocks.push(`<p>${applyInlineFormatting(trimmed)}</p>`);
  }

  closeList();
  return blocks.join("\n");
}

function buildHtmlDocument(title, bodyHtml, logoDataUri) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 14mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        color: #1f2937;
        background: #f8f4ef;
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        line-height: 1.8;
      }
      .page {
        background: #ffffff;
        border: 1px solid #e5d7ca;
        border-radius: 24px;
        padding: 28px 30px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 18px;
        border-bottom: 2px solid #e8ddd3;
        padding-bottom: 18px;
        margin-bottom: 22px;
      }
      .header img {
        width: 84px;
        height: auto;
        object-fit: contain;
      }
      .header-copy {
        flex: 1;
      }
      .eyebrow {
        color: #8b6b53;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 28px;
        line-height: 1.4;
        color: #5f3f2a;
      }
      h2 {
        margin: 26px 0 10px;
        font-size: 20px;
        color: #7a5439;
      }
      h3 {
        margin: 20px 0 8px;
        font-size: 16px;
        color: #7a5439;
      }
      p, li {
        font-size: 13.5px;
        margin: 0 0 10px;
      }
      ul {
        margin: 0 0 14px;
        padding-right: 20px;
      }
      li {
        margin-bottom: 6px;
      }
      code {
        background: #f5ede6;
        border-radius: 6px;
        padding: 1px 6px;
        font-size: 12px;
      }
      .callout {
        margin: 14px 0;
        padding: 12px 14px;
        border-right: 4px solid #cf7d4b;
        background: #fff5ee;
        color: #6b4a35;
        border-radius: 14px;
        font-size: 13px;
      }
      .step {
        margin: 0 0 8px;
        font-weight: 600;
      }
      figure {
        margin: 18px 0;
      }
      figure img {
        max-width: 100%;
        border-radius: 18px;
        border: 1px solid #eaded4;
      }
      .footer {
        margin-top: 28px;
        border-top: 1px solid #eaded4;
        padding-top: 12px;
        color: #8b6b53;
        font-size: 11px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <img src="${logoDataUri}" alt="Ramex Store" />
        <div class="header-copy">
          <div class="eyebrow">Ramex Store ERP</div>
          <h1>${escapeHtml(title)}</h1>
        </div>
      </header>
      ${bodyHtml}
      <div class="footer">دليل تشغيلي عربي — Phase 8 handover pack</div>
    </main>
  </body>
</html>`;
}

function resolveBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_PDF_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function toFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

async function generateManualPdfs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const logoDataUri = fs.existsSync(LOGO_PATH) ? toDataUri(LOGO_PATH) : "";

  const browserExecutable = resolveBrowserExecutable();
  if (!browserExecutable) {
    throw new Error(
      "No supported browser executable found for headless PDF generation.",
    );
  }

  for (const manualFile of MANUAL_FILES) {
    const sourcePath = path.join(MANUALS_DIR, manualFile);
    const outputPath = path.join(
      OUTPUT_DIR,
      manualFile.replace(/\.md$/i, ".pdf"),
    );
    const htmlPath = path.join(TEMP_DIR, manualFile.replace(/\.md$/i, ".html"));
    const markdown = fs.readFileSync(sourcePath, "utf8");
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : manualFile;
    const bodyHtml = markdownToHtml(markdown, path.dirname(sourcePath));
    const html = buildHtmlDocument(title, bodyHtml, logoDataUri);

    fs.writeFileSync(htmlPath, html, "utf8");

    const result = spawnSync(
      browserExecutable,
      [
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--print-to-pdf-no-header",
        `--print-to-pdf=${outputPath}`,
        toFileUrl(htmlPath),
      ],
      {
        stdio: "inherit",
      },
    );

    if (result.status !== 0) {
      throw new Error(`PDF generation failed for ${manualFile}`);
    }

    console.log(`Generated ${outputPath}`);
  }

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

generateManualPdfs().catch((error) => {
  console.error("Failed to generate manual PDFs:", error.message);
  process.exit(1);
});
