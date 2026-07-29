import React from "react";

export const INVENTORY_COUNT_ROOT_CLASS = "inventory-count-a4-root";

const R = INVENTORY_COUNT_ROOT_CLASS;

// Match the quantity display used on the inventory page (trim trailing zeros).
const fmtQty = (n) => parseFloat(Number(n || 0).toFixed(4));

// Money with two decimals + thousands separators.
const fmtMoney = (n) => Number(Number(n || 0).toFixed(2)).toLocaleString();

const fmtDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("ar-EG");
  } catch {
    return "—";
  }
};

// sellPrice can arrive as the string "-" when no price is set.
const hasSell = (v) =>
  v !== "-" && v !== null && v !== undefined && !isNaN(Number(v));

const PRINT_STYLES = `
  .${R} {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }

  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    /* Collapse the whole app out of the print layout so it can't spill onto
       blank pages — only the marked print container stays in flow. */
    body > *:not([data-print-root]) {
      display: none !important;
    }

    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    .${R} {
      position: static !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      width: 100%;
      font-family: "Cairo", sans-serif;
      font-size: 12px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
      color: #000 !important;
    }

    .${R}, .${R} * {
      color: #000 !important;
      font-weight: 700 !important;
    }

    .${R} .ic-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }

    .${R} .ic-logo {
      max-width: 130px;
      max-height: 70px;
      margin: 0 auto 6px;
      display: block;
      object-fit: contain;
    }

    .${R} .ic-title {
      font-size: 22px;
      font-weight: 800;
      margin: 2px 0;
    }

    .${R} .ic-company {
      font-size: 14px;
      margin: 1px 0;
    }

    .${R} .ic-meta-row {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 12px;
    }

    .${R} .ic-meta {
      font-style: italic;
    }

    .${R} table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    /* Repeat the header row on every printed page. */
    .${R} thead {
      display: table-header-group;
    }

    .${R} tr {
      break-inside: avoid;
    }

    .${R} th {
      border: 1px solid #000;
      padding: 5px;
      background: #e5e7eb !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-weight: 800;
      text-align: center;
    }

    .${R} td {
      border: 1px solid #000;
      padding: 5px;
      text-align: center;
      vertical-align: middle;
    }

    .${R} td.ic-name {
      text-align: right;
    }

    .${R} .ic-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Blank cells for the physical count — give them room to write. */
    .${R} .ic-blank {
      min-width: 80px;
    }

    .${R} tfoot td {
      font-weight: 800;
      border: 1px solid #000;
      padding: 6px;
    }

    .${R} .ic-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      font-size: 13px;
      font-weight: 800;
    }

    .${R} .ic-signatures > div {
      width: 45%;
    }

    .${R} .ic-sign-line {
      border-top: 1px solid #000;
      margin-top: 34px;
      padding-top: 5px;
      text-align: center;
    }
  }
`;

const InventoryCountReportA4 = ({
  items,
  branchName,
  printedAt,
  includePrices = true,
  settings = {},
}) => {
  const companyName = settings.companyName || "Elghonemy ERP";
  const printedIso = printedAt || new Date().toISOString();

  // Sort items ascending by name (Arabic collation) for an easy-to-scan sheet.
  const sorted = (Array.isArray(items) ? [...items] : []).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "ar"),
  );

  let grandCost = 0;
  let grandSell = 0;
  sorted.forEach((item) => {
    const qty = Number(item.quantity || 0);
    grandCost += qty * Number(item.costPrice || 0);
    if (hasSell(item.sellPrice)) grandSell += qty * Number(item.sellPrice);
  });

  // Base columns are always shown; price columns are optional.
  const colSpan = includePrices ? 11 : 7;

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      {/* Header — logo centered */}
      <div className="ic-header">
        <img className="ic-logo" src="/assets/logo.png" alt="Logo" />
        <h1 className="ic-title">جرد المخزون</h1>
        <p className="ic-company">{companyName}</p>
        <div className="ic-meta-row">
          <span>الفرع: {branchName || "—"}</span>
          <span className="ic-meta">
            طُبع في: {fmtDateTime(printedIso)} — عدد الأصناف: {sorted.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>كود</th>
            <th>الصنف</th>
            <th>التصنيف</th>
            <th>الوحدة</th>
            <th>الكمية بالنظام</th>
            <th>الكمية الفعلية</th>
            <th>الفرق</th>
            {includePrices && (
              <>
                <th>سعر التكلفة</th>
                <th>إجمالي التكلفة</th>
                <th>سعر البيع</th>
                <th>إجمالي البيع</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.length > 0 ? (
            sorted.map((item, idx) => {
              const qty = Number(item.quantity || 0);
              const cost = Number(item.costPrice || 0);
              const sellNum = hasSell(item.sellPrice)
                ? Number(item.sellPrice)
                : null;
              const totalSell = sellNum === null ? null : qty * sellNum;
              return (
                <tr key={item.id ?? idx}>
                  <td className="ic-num">{item.code}</td>
                  <td className="ic-name">{item.name}</td>
                  <td>{item.category || "—"}</td>
                  <td>{item.unit || "—"}</td>
                  <td className="ic-num">{fmtQty(qty)}</td>
                  <td className="ic-blank"></td>
                  <td className="ic-blank"></td>
                  {includePrices && (
                    <>
                      <td className="ic-num">{fmtMoney(cost)}</td>
                      <td className="ic-num">{fmtMoney(qty * cost)}</td>
                      <td className="ic-num">
                        {sellNum === null ? "-" : fmtMoney(sellNum)}
                      </td>
                      <td className="ic-num">
                        {totalSell === null ? "-" : fmtMoney(totalSell)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={colSpan}>لا توجد أصناف</td>
            </tr>
          )}
        </tbody>
        {includePrices && sorted.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={8} style={{ textAlign: "left" }}>
                الإجمالي
              </td>
              <td className="ic-num">{fmtMoney(grandCost)}</td>
              <td></td>
              <td className="ic-num">{fmtMoney(grandSell)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Signatures */}
      <div className="ic-signatures">
        <div>
          <div className="ic-sign-line">اسم القائم بالجرد</div>
        </div>
        <div>
          <div className="ic-sign-line">التوقيع</div>
        </div>
      </div>
    </div>
  );
};

export default InventoryCountReportA4;
