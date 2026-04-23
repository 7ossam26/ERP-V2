# PDF Arabic Rendering — Diagnosis & Path Forward

**Branch:** `feat/call-center-phase-1`
**Date:** 2026-04-23
**Status:** Design — awaiting direction (P0-A / P0-B / P0-C / P0-D)
**Related:** [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md) — superseded in part by this plan depending on the choice below

---

## 1. Overview

> **Update - 2026-04-23:** Implementation has started on the recommended P0-B path. The bulk order detail page now opens a browser-native A4 print surface instead of the old `@react-pdf/renderer` flow.

### Problem

The bulk-order PDF *does* render to the browser, but **every Arabic character is mojibake** — e.g. section labels like "العميل", "المخزن", "الإجمالي" come out as garbled Latin-Extended glyphs (`ۍ9Ä`, `Œ&QŽzBŒ&`, `JD'E,%D'`).

Latin text and digits (`BULK-0008`, `Superadmin`, `30.00`) render correctly. Only Arabic is broken.

### What the mojibake is actually showing

The visible characters are **glyph indices** from the embedded font being rendered as raw Latin-Extended codepoints. Root cause is one (or a combination) of:
1. The WOFF2 file shipped (**13 KB Cairo-Regular**, **15 KB Cairo-Latin-Regular**) is a **unicode-range subset** — too small to contain the full Arabic glyph set.
2. `fontkit`'s WOFF2 subsetter has a known bug when embedding Cairo's Arabic **composite glyphs** — crashes or produces a broken `cmap` after subsetting. A workaround exists in-repo but isn't wired up.
3. `@react-pdf/renderer`'s text engine does no Arabic **BiDi reordering** or **contextual shaping** (initial/medial/final glyph forms) natively — even with the correct font, Arabic can render as disconnected isolated forms.

### Evidence from the repo

- `frontend/public/fonts/Cairo-Regular.woff2` = **13 KB**. Full Cairo Arabic (unsubsetted) is ~200 KB.
- `frontend/public/fonts/Cairo-Latin-Regular.woff2` = **15 KB**. Latin-only.
- `frontend/src/vendor/fontkitPatched.js` — **exists, contains a targeted fix** for the WOFF2 composite-glyph subsetting bug, but is **only referenced by its own test file**. Not imported by `@react-pdf`'s font loader or anything in the render path.
- `frontend/tmp-cairo-regular-from-woff2.ttf` (36 KB) at repo root — evidence of a prior experiment converting WOFF2 → TTF mid-debug.
- `@react-pdf/renderer` version: **^4.5.1**.
- `BulkInvoicePDF.jsx` registers both fonts under the same family `"Cairo"` with no `unicode-range` or fallback rules — the renderer picks one arbitrarily.

### Why this blocks everything

The Web Worker + font-prefetch plan in [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md) only solves:
- **B2** — main-thread blocking → UI freeze
- **T4** — font-fetch race → non-deterministic freeze

Neither addresses **Arabic shaping / glyph subsetting**, which is what the user sees as "the PDF is unusable". Moving broken-Arabic rendering off the main thread still produces broken Arabic.

**This plan must be resolved before the Worker plan becomes useful.**

---

## 2. Diagnosis — Stacked Problems

| # | Problem | Symptom | Status |
|---|---------|---------|--------|
| 1 | Font is a Latin-heavy subset, Arabic glyphs missing or partial | Mojibake for Arabic | 🔴 Open — root of visible issue |
| 2 | `fontkit` WOFF2 subsetter mangles Cairo composite glyphs | Broken `cmap` after embedding | 🔴 Open — patch written, not wired |
| 3 | `@react-pdf` doesn't shape Arabic (no BiDi / contextual joining) | Even with good font, forms don't join | 🟡 Open — only visible after #1 and #2 are fixed |
| 4 | Font race at render time (T4) | Non-deterministic freeze | 🟡 Open — covered by other plan |
| 5 | Main-thread block during render (B2) | UI freeze, SSE drops | 🟡 Open — covered by other plan |

---

## 3. Design — Four Paths

### ⭐ P0-B (recommended): Native browser HTML print — abandon `@react-pdf/renderer` for this invoice

Build the invoice as regular React HTML styled with `@media print` CSS. Call `window.print()`. Let the browser's own text engine handle Arabic — which it does perfectly, because every Arabic page on the web already uses it.

#### Architecture
- **New:** `frontend/src/components/bulk/BulkInvoicePrint.jsx` — HTML/JSX version of the invoice. Uses Tailwind + a scoped `@media print` stylesheet.
- **Modified:** `frontend/src/utils/pdfGenerate.js` → becomes `frontend/src/utils/printInvoice.js`. Mounts `BulkInvoicePrint` into a hidden portal, sets `document.title` to the document number, calls `window.print()`, restores on `afterprint`.
- **Modified:** `BulkOrderDetailPage.jsx` — `openPdf(doc)` becomes `printInvoice(order, doc)`. Button label: "طباعة / PDF".
- **Deleted / deprecated:** `frontend/src/components/bulk/BulkInvoicePDF.jsx`, font `Font.register` logic, `fontkitPatched.js` (keep until P0-D scenario confirms they're unused).

#### User flow
1. Click "طباعة / PDF".
2. Browser print dialog opens instantly (no 30 s render).
3. User picks a physical printer → prints. OR picks "Save as PDF" → gets a PDF file.
4. Arabic renders perfectly because the OS/browser has Cairo (or equivalent Arabic system font) and handles bidi + shaping natively.

#### Pros
- **Arabic just works.** Zero font-embedding logic, zero shaping bugs.
- **Eliminates Pillar 1 + 2** of the Worker plan entirely — no blocking render, no font pre-fetch.
- **Tiny code delta.** The invoice is ~100 lines of JSX + CSS.
- **Browsers can "Save as PDF"** from any print dialog — same artifact users want.
- **Native Arabic font fallback** — if Cairo isn't on the machine, browser picks an Arabic-capable substitute without ceremony.

#### Cons
- **Different UX** — print dialog instead of "PDF opens in a new tab". Some users find a PDF file more forwardable.
- **Layout control is CSS-only** — paginated tables need `page-break-inside: avoid`, header repeats via `thead`, footers via `@page`. Doable but different mental model from React-PDF's `StyleSheet`.
- **Not fully offline** if fonts are served from the app itself (they already are — `/fonts/Cairo-*.woff2` ship with the app).
- **Can't easily email the PDF** from the app — user has to print-to-PDF first, then attach.

---

### P0-A: Full Cairo TTF + wire up fontkit patch

Replace the 13/15 KB WOFF2 subsets with the full unsubsetted Cairo TTF (~200 KB) and wire `fontkitPatched.js` into `@react-pdf`'s font loader. Keep `@react-pdf/renderer`.

#### Architecture
- **New:** `frontend/public/fonts/Cairo-Regular.ttf` (~200 KB, full Arabic glyph tables including GSUB joining features).
- **Modified:** `BulkInvoicePDF.jsx` — registers the TTF, removes the Latin-only variant (TTF covers both).
- **Modified:** `@react-pdf`'s font module swapped to use `fontkitPatched.create()`. Requires a Vite alias in [vite.config.js](frontend/vite.config.js) redirecting `fontkit` imports from `@react-pdf/font` to our patched version.
- All of the Worker + pre-fetch plan in [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md) still applies.

#### Pros
- **Keeps the stack you already have.**
- Everything in the Worker/font-prefetch plan remains valid.
- PDF artifact is a real file in a new tab.

#### Cons
- **Arabic shaping not guaranteed.** Even with full font, `@react-pdf`'s Arabic support depends on fontkit reading the font's GSUB tables correctly. Cairo ships the right tables; fontkit 2.x supports Arabic shaping, but quality varies. Needs a visual spot-check.
- **Font payload + 190 KB** — non-trivial for a rarely-used feature.
- **Vite alias against `@react-pdf/font`'s internal dependency** is fragile — a dependency upgrade can silently unwire it.
- **Doesn't solve shaping edge cases** that still show up in `@react-pdf` (spacing around Arabic punctuation, ligatures with Latin interleaved, number direction in mixed text).

---

### P0-C: Switch to `pdfmake` or `jsPDF` + `arabic-persian-reshaper`

Library swap to one designed for Arabic. Rewrite `BulkInvoicePDF.jsx` in the new library's paradigm.

#### Pros
- Proper Arabic, still a PDF file artifact.
- `pdfmake` is declarative-ish (similar mental model).

#### Cons
- **Full rewrite of the invoice.**
- **New library, new bugs.** Neither is as actively maintained as `@react-pdf/renderer`.
- **Shaping still requires a reshaper library**, increasing dependency surface.
- Doesn't solve the font-size / bundle issue cleanly.

---

### P0-D: Hybrid — ship P0-B now, keep `@react-pdf` in tree for future

Ship native HTML print today; don't delete `BulkInvoicePDF.jsx` / `pdfGenerate.js` — just stop using them from [BulkOrderDetailPage.jsx](frontend/src/pages/bulk/BulkOrderDetailPage.jsx).

#### Pros
- **Unblocks users immediately.**
- Low risk — the dead code path is well-known and replaceable later.

#### Cons
- Carries dead code + dependency weight (`@react-pdf/renderer` stays in `package.json`).
- Team has to remember the dead code is dead — comment + `@deprecated` JSDoc mitigates this.

---

## 4. Recommendation

**P0-B** — native HTML print. Reasons:

1. The user's actual pain is "Arabic looks like garbage". Every alternative still has an Arabic-correctness risk; browser print has none.
2. **Simplifies the adjacent plan.** Pillar 1 (Worker) and Pillar 2 (font pre-fetch) in [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md) become unnecessary — no main-thread block, no font registration. That frees 2–3 days of work to go into Pillar 3 (SSE audit) which is more valuable anyway.
3. **The stack aligns.** You already have Tailwind, React, and an invoice layout. HTML invoice is a 100-line component; PDF-library rewrites are 300+ lines each.
4. **Arabic text is a first-class citizen in browsers.** `@react-pdf`, `pdfmake`, `jsPDF` all treat it as an edge case.
5. **`no-print` classes already exist** in `BulkOrderDetailPage.jsx` — the pattern is partly set up already.

**If the user strongly prefers "a real PDF file artifact in a new tab"**, fall back to **P0-A** (full TTF + wire up patch) with accepted risk that shaping edge cases may still need rounds of polish.

---

## 5. Implementation Plan — P0-B (pending user confirmation)

### Phase A — Build the HTML invoice

1. **A1.** Create `frontend/src/components/bulk/BulkInvoicePrint.jsx`. Port the structure from `BulkInvoicePDF.jsx`:
   - Header (title + doc number + order number + date)
   - Two info cards (customer + warehouse/createdBy)
   - Items table
   - Totals section (net, tax, total, paid, balance)
   - Footer
2. **A2.** Create `frontend/src/styles/invoice-print.css` (or scoped JSX) with a `@media print` block:
   - `@page { size: A4; margin: 14mm; }`
   - Hide everything except `.invoice-print-root`.
   - Force black text, remove shadows/gradients (ink-saver).
   - `thead { display: table-header-group }` for per-page table header.
   - `tr { page-break-inside: avoid }`.
3. **A3.** Verify Cairo font is loaded in the page. Keep the two WOFF2 files — the HTML page needs them for screen display anyway. For print, add Cairo to a `@font-face` block that's explicitly included in print CSS.

### Phase B — Wire into the detail page

4. **B1.** Create `frontend/src/utils/printInvoice.js`:
   - Renders `<BulkInvoicePrint order={...} doc={...} />` into a portal at `document.body`.
   - Stashes original `document.title`; sets it to the document number so the printed PDF filename is sensible.
   - Calls `window.print()`.
   - On `afterprint` event: restore title, unmount portal.
   - Edge case: if user hits Escape in the print dialog, `afterprint` still fires — the portal cleanup is idempotent.
5. **B2.** Modify `BulkOrderDetailPage.jsx`:
   - Remove `import { generateAndOpenOrderPdf } from "../../utils/pdfGenerate"`.
   - Add `import { printInvoice } from "../../utils/printInvoice"`.
   - Rename `openPdf` → `printInvoiceHandler`. Remove `setGenerating` / `generating` state — print dialog opens instantly, no loading state needed.
   - Button label: "طباعة / PDF".

### Phase C — Deprecate the old path

6. **C1.** Add `@deprecated` JSDoc to `BulkInvoicePDF.jsx` and `pdfGenerate.js` with a pointer to the new files. Don't delete yet — one release of soak time.
7. **C2.** Update [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md):
   - Mark Pillar 1 (Worker) as **superseded** by this plan.
   - Mark Pillar 2 (font pre-fetch) as **superseded**.
   - Keep Pillar 3 (SSE audit) intact — it's independent.
8. **C3.** Remove `tmp-cairo-regular-from-woff2.ttf` from the repo root (stray experiment file).

### Phase D — Verification

9. **D1.** Print BULK-0008 (1 line order from screenshot) — Arabic renders correctly, layout fits A4.
10. **D2.** Print a multi-line order — table paginates cleanly, header repeats on page 2+.
11. **D3.** "Save as PDF" from the dialog — resulting file has readable Arabic when opened in Acrobat AND Edge's PDF viewer (the one that showed the garbage in the first place).
12. **D4.** Print from a different machine without Cairo installed — verify font-face loads from the app's `/fonts/` path and Arabic still renders (or falls back to a system Arabic font).
13. **D5.** Dark-mode UI — print should render light background regardless of UI theme. Test this.

---

## 6. Implementation Plan — P0-A (alternative path, if user picks this instead)

Only expanded here briefly; full detail to be added if this path is chosen.

1. Download full unsubsetted Cairo `.ttf` from [Google Fonts](https://fonts.google.com/specimen/Cairo).
2. Drop into `frontend/public/fonts/Cairo-Regular.ttf`. Delete the two WOFF2 files.
3. Update `BulkInvoicePDF.jsx` font registration to point at the TTF.
4. Add a Vite resolve alias redirecting `fontkit` to `./src/vendor/fontkitPatched.js`. Verify via `npm run build` the patched version is in the bundle.
5. Visual QA: print a multi-word Arabic string with mixed RTL+digits (e.g. `الإجمالي: 1,234.56 ج.م`). Check:
   - Arabic letters join correctly (initial/medial/final forms).
   - Digits render LTR inside RTL text.
   - Punctuation (`:`, `،`, `-`) places correctly.
6. If shaping is broken: stop, pivot to P0-B. Don't sink more time.
7. Then continue the Worker + font-prefetch plan in [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md) as originally designed.

---

## 7. Decision Log

| # | Decision | Alternatives | Reason |
|---|---|---|---|
| 1 | Arabic rendering is the **blocking** issue | Treat it as secondary to the Worker refactor | Without readable Arabic, Worker optimisation delivers no user value |
| 2 | Recommend **P0-B (HTML print)** | P0-A (full TTF), P0-C (library swap), P0-D (hybrid) | Arabic correctness is free in browsers; biggest simplification of the adjacent plan |
| 3 | Pending user confirmation on P0-A vs P0-B vs P0-C vs P0-D | — | Not yet committed; captured as an open decision |
| 4 | `fontkitPatched.js` stays in repo for now | Delete immediately | If user picks P0-A, we need it. If P0-B, remove in Phase C cleanup |
| 5 | `tmp-cairo-regular-from-woff2.ttf` at repo root is a stray experiment | Keep as reference | Add to `.gitignore` / delete in Phase C |

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Browser print "Save as PDF" produces a file with wrong margins on some printers | Medium | Low | `@page { margin }` handles A4; other paper sizes are user responsibility |
| Cairo font isn't loaded by the time `window.print()` fires (mid-fetch) | Low | Medium | Preload Cairo via `<link rel="preload" as="font">` in `index.html`. The fonts are already shipped with the app, so this is cache-warm on the second print |
| Some users on old Edge versions get different print dialog behaviour | Low | Low | Test on target browser fleet; fallback is OS print |
| User expected "PDF opens in new tab" and is confused by print dialog | Medium | Low | Button label clarifies: "طباعة / PDF" (Print / PDF) |
| P0-A pivot later — we discover shaping *does* work and regret picking P0-B | Low | Low | P0-B is strictly simpler; reverting would be trivial, we keep `BulkInvoicePDF.jsx` one release for rollback |

---

## 9. Open Questions (to resolve with user)

1. **P0-A / P0-B / P0-C / P0-D** — which direction?
2. **Is "PDF file in a new tab" a hard requirement** from any stakeholder, or is print-dialog → Save-as-PDF acceptable? (This single answer decides between P0-B and P0-A.)
3. Should we also support **bulk printing** (e.g. "print all open orders") now, or defer? HTML print handles one-at-a-time well; batch is trickier.
4. What happens to the **Call-center POS** print path ([PrintTicket.jsx](frontend/src/components/orders/PrintTicket.jsx)) — is it already HTML-print or does it use `@react-pdf` too? If it uses `@react-pdf`, we should unify.

---

## 10. Confirmation Checklist (pre-implementation)

- [ ] User picks P0-A / P0-B / P0-C / P0-D
- [ ] If P0-B: confirm no hard "must be a .pdf file artifact" requirement from stakeholders
- [ ] Audit `PrintTicket.jsx` to see if the POS print path also needs the same fix
- [ ] Decide fate of `tmp-cairo-regular-from-woff2.ttf` and `fontkitPatched.js`
- [ ] Update [pdf-worker-sse-hardening.md](./pdf-worker-sse-hardening.md) to supersede Pillar 1 + 2 once P0-B is locked in

---
