// Escape a value for a CSV cell: stringify, double any internal quotes, wrap
// in quotes so commas / newlines inside item names don't break columns.
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

const fmtQty = (n) => parseFloat(Number(n || 0).toFixed(4));
const fmtMoney = (n) => Number(Number(n || 0).toFixed(2));

// sellPrice can arrive as the string "-" when no price is set.
const hasSell = (v) =>
  v !== "-" && v !== null && v !== undefined && !isNaN(Number(v));

const sanitizeFileName = (s) => (s || "الكل").replace(/[\\/:*?"<>|]/g, "-");

// U+FEFF byte-order mark — makes Excel read the CSV as UTF-8 (so Arabic renders).
const BOM = "﻿";

/**
 * Export inventory items to an Excel-compatible CSV file (UTF-8 with BOM so
 * Arabic text renders correctly). Downloads directly in the browser — no deps.
 */
export function exportInventoryToCsv({ items, branchName } = {}) {
  const list = Array.isArray(items) ? items : [];

  const headers = [
    "كود",
    "الصنف",
    "التصنيف",
    "الوحدة",
    "الكمية",
    "سعر التكلفة",
    "إجمالي التكلفة",
    "سعر البيع",
    "إجمالي البيع",
  ];

  const rows = list.map((item) => {
    const qty = Number(item.quantity || 0);
    const cost = Number(item.costPrice || 0);
    const sellNum = hasSell(item.sellPrice) ? Number(item.sellPrice) : null;
    return [
      item.code,
      item.name,
      item.category || "",
      item.unit || "",
      fmtQty(qty),
      fmtMoney(cost),
      fmtMoney(qty * cost),
      sellNum === null ? "-" : fmtMoney(sellNum),
      sellNum === null ? "-" : fmtMoney(qty * sellNum),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `جرد-${sanitizeFileName(branchName)}-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default exportInventoryToCsv;
