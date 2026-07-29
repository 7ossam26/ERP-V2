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
const hasSell = (v) => v !== "-" && v !== null && v !== undefined && !isNaN(Number(v));

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

    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }

    body * { visibility: hidden !important; }
    .${R}, .${R} * { visibility: visible !important; }

    .${R} {
      position: absolute;
      inset: 0;
      width: 100%;
      opacity: 1;
      pointer-events: auto;
      z-index: auto;
      font-family: "Cairo", sans-serif;
      font-size: 10px;
      line-height: 1.3;
      direction: rtl;
      text-align: right;
      color: #000 !important;
    }

    .${R}, .${R} * {
      color: #000 !important;
    }

    .${R} .ic-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }

    .${R} .ic-title {
      font-size: 18px;
      font-weight: 800;
      margin: 0 0 2px;
    }

    .${R} .ic-sub {
      font-size: 12px;
      font-weight: 700;
      margin: 1px 0;
    }

    .${R} .ic-meta {
      font-size: 10px;
      font-style: italic;
    }

    .${R} table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
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
      padding: 3px 4px;
      background: #e5e7eb !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-weight: 800;
      text-align: center;
    }

    .${R} td {
      border: 1px solid #000;
      padding: 3px 4px;
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
      min-width: 70px;
    }

    .${R} tfoot td {
      font-weight: 800;
      border: 1px solid #000;
      padding: 4px;
    }

    .${R} .ic-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      font-size: 11px;
      font-weight: 700;
    }

    .${R} .ic-signatures > div {
      width: 45%;
    }

    .${R} .ic-sign-line {
      border-top: 1px solid #000;
      margin-top: 28px;
      padding-top: 4px;
      text-align: center;
    }
  }
`;

const InventoryCountReportA4 = ({ items, branchName, printedAt, settings = {} }) => {
  const list = Array.isArray(items) ? items : [];
  const companyName = settings.companyName || "Elghonemy ERP";
  const printedIso = printedAt || new Date().toISOString();

  let grandCost = 0;
  let grandSell = 0;
  list.forEach((item) => {
    const qty = Number(item.quantity || 0);
    grandCost += qty * Number(item.costPrice || 0);
    if (hasSell(item.sellPrice)) grandSell += qty * Number(item.sellPrice);
  });

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      {/* Header */}
      <div className="ic-header">
        <div>
          <h1 className="ic-title">جرد المخزون</h1>
          <p className="ic-sub">{companyName}</p>
          <p className="ic-sub">الفرع: {branchName || "—"}</p>
        </div>
        <div style={{ textAlign: "left" }}>
          <p className="ic-meta">طُبع في: {fmtDateTime(printedIso)}</p>
          <p className="ic-meta">عدد الأصناف: {list.length}</p>
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
            <th>سعر التكلفة</th>
            <th>إجمالي التكلفة</th>
            <th>سعر البيع</th>
            <th>إجمالي البيع</th>
          </tr>
        </thead>
        <tbody>
          {list.length > 0 ? (
            list.map((item, idx) => {
              const qty = Number(item.quantity || 0);
              const cost = Number(item.costPrice || 0);
              const totalCost = qty * cost;
              const sellNum = hasSell(item.sellPrice) ? Number(item.sellPrice) : null;
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
                  <td className="ic-num">{fmtMoney(cost)}</td>
                  <td className="ic-num">{fmtMoney(totalCost)}</td>
                  <td className="ic-num">{sellNum === null ? "-" : fmtMoney(sellNum)}</td>
                  <td className="ic-num">{totalSell === null ? "-" : fmtMoney(totalSell)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={11}>لا توجد أصناف</td>
            </tr>
          )}
        </tbody>
        {list.length > 0 && (
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
