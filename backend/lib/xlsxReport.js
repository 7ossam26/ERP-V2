/**
 * xlsxReport.js — small helpers for server-built Arabic Excel reports.
 *
 * routes/dataExport.js builds its sheets inline with a fixed 28-char width and
 * no direction. Reports need a little more: right-to-left sheets, money cells
 * formatted as money, merged group headers and columns sized to their content.
 * SheetJS community (xlsx 0.18) cannot style cells or freeze panes; those are
 * deliberately out of scope here.
 */

const XLSX = require("xlsx");

const MONEY_FORMAT = "#,##0.00";

/**
 * Array-of-arrays → worksheet with money-formatted numbers and auto widths.
 *
 * @param {Array<Array<any>>} aoa
 * @param {object} [opts]
 * @param {Array} [opts.merges]   SheetJS ranges ({ s:{r,c}, e:{r,c} })
 * @param {number} [opts.minWidth=8]
 * @param {number} [opts.maxWidth=45]
 */
function sheetFromRows(aoa, { merges = [], minWidth = 8, maxWidth = 45 } = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const widths = [];
  aoa.forEach((row, r) => {
    row.forEach((value, c) => {
      if (typeof value === "number") {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) cell.z = MONEY_FORMAT;
      }
      const len = value == null ? 0 : typeof value === "number" ? value.toFixed(2).length + 3 : String(value).length;
      widths[c] = Math.max(widths[c] || 0, len);
    });
  });
  ws["!cols"] = widths.map((w) => ({ wch: Math.min(maxWidth, Math.max(minWidth, w + 2)) }));
  if (merges.length) ws["!merges"] = merges;
  return ws;
}

/** A workbook whose sheets open right-to-left. */
function rtlWorkbook() {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

/** Excel sheet names: ≤ 31 chars, none of : \ / ? * [ ] */
const safeSheetName = (name) => String(name).replace(/[:\\/?*[\]]/g, " ").slice(0, 31);

function appendSheet(wb, ws, name) {
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name));
}

/** Send a workbook as an .xlsx download. */
function sendWorkbook(res, wb, filename) {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.send(buf);
}

module.exports = { sheetFromRows, rtlWorkbook, appendSheet, sendWorkbook, MONEY_FORMAT };
