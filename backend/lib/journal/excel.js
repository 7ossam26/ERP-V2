/**
 * excel.js — the اليومية الأمريكية workbook.
 *
 *   Sheet 1  اليومية الأمريكية  opening row, one row per entry (or per day/type),
 *                               period movement and closing rows; a two-level
 *                               header with each account merged over مدين|دائن.
 *   Sheet 2  ملخص ومطابقة       balances per account + integrity + tie-outs.
 *   Sheet 3  تنبيهات            diagnostics.
 */

const { sheetFromRows, rtlWorkbook, appendSheet } = require("../xlsxReport");

const FIXED_HEADERS = ["التاريخ", "المرجع", "نوع الحركة", "البيان", "الفرع", "إجمالي مدين", "إجمالي دائن"];

/** A balance shows on one side only: its net, on whichever side it sits. */
const balanceCells = (t) => (t.net >= 0 ? [t.net || null, null] : [null, -t.net]);
const sum = (vals) => Math.round(vals.reduce((s, v) => s + (v || 0), 0) * 100) / 100;

function journalSheet(view, title) {
  const { columns } = view;
  const fixed = FIXED_HEADERS.length;
  const width = fixed + columns.length * 2;

  const header1 = [...FIXED_HEADERS];
  const header2 = new Array(fixed).fill(null);
  for (const c of columns) {
    header1.push(c.labelAr, null);
    header2.push("مدين", "دائن");
  }

  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: width - 1 } }];
  for (let c = 0; c < fixed; c++) merges.push({ s: { r: 1, c }, e: { r: 2, c } });
  columns.forEach((_, i) => {
    const c = fixed + i * 2;
    merges.push({ s: { r: 1, c }, e: { r: 1, c: c + 1 } });
  });

  const balanceRow = (label, totals) => {
    const cells = columns.flatMap((c) => balanceCells(totals[c.id]));
    const drs = cells.filter((_, i) => i % 2 === 0);
    const crs = cells.filter((_, i) => i % 2 === 1);
    return [null, null, label, null, null, sum(drs), sum(crs), ...cells];
  };

  const aoa = [[title], header1, header2, balanceRow("رصيد أول المدة", view.opening)];
  for (const r of view.rows) {
    aoa.push([
      r.day,
      r.ref,
      r.type,
      r.party,
      r.branch,
      r.totalDr,
      r.totalCr,
      ...columns.flatMap((c) => [r.lines[c.id]?.dr || null, r.lines[c.id]?.cr || null]),
    ]);
  }
  const periodCells = columns.flatMap((c) => [view.period[c.id].dr || null, view.period[c.id].cr || null]);
  aoa.push([
    null, null, "حركة الفترة", null, null,
    sum(columns.map((c) => view.period[c.id].dr)),
    sum(columns.map((c) => view.period[c.id].cr)),
    ...periodCells,
  ]);
  aoa.push(balanceRow("رصيد آخر المدة", view.closing));

  return sheetFromRows(aoa, { merges });
}

function summarySheet(view, tieOuts) {
  const aoa = [
    ["الحساب", "أول المدة مدين", "أول المدة دائن", "حركة مدين", "حركة دائن", "آخر المدة مدين", "آخر المدة دائن"],
  ];
  for (const c of view.columns) {
    aoa.push([
      c.labelAr,
      ...balanceCells(view.opening[c.id]),
      view.period[c.id].dr || null,
      view.period[c.id].cr || null,
      ...balanceCells(view.closing[c.id]),
    ]);
  }

  aoa.push([], ["سلامة القيود"]);
  aoa.push(["قيود غير متوازنة", view.integrity.unbalancedEntries]);
  aoa.push(["حركة الفترة متوازنة", view.integrity.periodBalanced ? "نعم" : "لا"]);

  if (tieOuts?.revenue) {
    const t = tieOuts.revenue;
    aoa.push([], ["المطابقة"], [t.label, t.journal, t.general, "الفرق", t.difference]);
  }
  if (tieOuts?.treasuries) {
    aoa.push([], ["الخزينة", "حسب اليومية", "حسب المستندات", "الرصيد المسجل", "رصيد بلا مستند"]);
    for (const t of tieOuts.treasuries) aoa.push([t.name, t.journal, t.documents, t.stored, t.unexplained]);
  }
  if (tieOuts?.suppliers) {
    const s = tieOuts.suppliers;
    aoa.push([], ["الموردين حسب اليومية", s.journal, "حسب حسابات الموردين", s.stored, "الفرق", s.difference]);
  }
  if (tieOuts?.customers) {
    const c = tieOuts.customers;
    aoa.push(["العملاء حسب اليومية", c.journal, "الرصيد المفتوح", c.openBalance, "مرتجع نقدي", c.cashRefundedOnReturns, "غير مفسر", c.residual]);
  }
  if (tieOuts?.drivers) {
    const d = tieOuts.drivers;
    aoa.push(["عهدة الطيارين حسب اليومية", d.journal, "محافظ الطيارين", d.wallets, "طلبات لم تخرج", d.pendingDispatch, "غير مفسر", d.residual]);
  }
  return sheetFromRows(aoa);
}

function diagnosticsSheet(view) {
  const aoa = [["التنبيه", "العدد", "القيمة", "أمثلة"]];
  for (const d of view.diagnostics) aoa.push([d.label, d.count, d.amount, d.samples.join("، ")]);
  if (view.diagnostics.length === 0) aoa.push(["لا توجد تنبيهات"]);
  return sheetFromRows(aoa, { maxWidth: 80 });
}

function buildJournalWorkbook(view, { title, tieOuts }) {
  const wb = rtlWorkbook();
  appendSheet(wb, journalSheet(view, title), "اليومية الأمريكية");
  appendSheet(wb, summarySheet(view, tieOuts), "ملخص ومطابقة");
  appendSheet(wb, diagnosticsSheet(view), "تنبيهات");
  return wb;
}

module.exports = { buildJournalWorkbook };
