import React from "react";

export const STOCK_TRANSFER_ROOT_CLASS = "stock-transfer-80mm-root";

const R = STOCK_TRANSFER_ROOT_CLASS;

const PRINT_STYLES = `
  .${R} {
    position: fixed;
    top: 0;
    left: 0;
    width: 74mm;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }

  @media print {
    @page { size: 78mm auto; margin: 2mm 2mm; }
    body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    body * { visibility: hidden !important; }
    .${R}, .${R} * { visibility: visible !important; }

    .${R} {
      position: absolute;
      inset: 0;
      width: 74mm;
      margin: 0 auto;
      opacity: 1;
      pointer-events: auto;
      z-index: auto;
      font-family: "Cairo", sans-serif;
      font-size: 10px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
      color: #000 !important;
    }

    .${R}, .${R} * {
      color: #000 !important;
      font-weight: 800 !important;
      -webkit-text-stroke: 0.2px #000;
      text-stroke: 0.2px #000;
    }

    .${R} .st-meta {
      font-weight: 800 !important;
      font-style: italic;
    }

    .${R} .st-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .${R} .st-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .${R} .st-divider-dashed {
      border-top: 1.5px dashed #000;
      margin: 3px 0;
    }

    .${R} .st-divider-solid {
      border-top: 1.5px solid #000;
      margin: 3px 0;
    }

    .${R} table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .${R} th {
      padding: 2px 1px;
      border-bottom: 1.5px solid #000;
    }

    .${R} td {
      padding: 2px 1px;
      border-bottom: 1px dashed #000;
      vertical-align: top;
    }

    .${R} td.st-num,
    .${R} th.st-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .${R} img {
      max-width: 42mm;
      margin: 0 auto 4px auto;
      display: block;
      filter: grayscale(100%) contrast(180%);
      -webkit-text-stroke: 0 !important;
      text-stroke: 0 !important;
      color: unset !important;
      font-weight: unset !important;
    }
  }
`;

const StockTransferReceipt80mm = ({ transfer, settings = {} }) => {
  if (!transfer) return null;

  const companyName = settings.companyName || "Elghonemy ERP";

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img src="/assets/logo.png" alt="Logo" />
        <div style={{ fontSize: 13, margin: "2px 0" }}>{companyName}</div>
        <div style={{ fontSize: 12, margin: "2px 0" }}>إيصال تحويل مخزني</div>
        <div className="st-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          رقم التحويل: {transfer.transferNumber}
        </div>
        <div className="st-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          {new Date(transfer.createdAt || Date.now()).toLocaleString("ar-EG")}
        </div>
      </div>

      <div className="st-divider-solid" />

      <div style={{ fontSize: 10 }}>
        <div className="st-row">
          <span>من مخزن:</span>
          <span>{transfer.fromWarehouseName || "—"}</span>
        </div>
        <div className="st-row">
          <span>إلى مخزن:</span>
          <span>{transfer.toWarehouseName || "—"}</span>
        </div>
      </div>

      <div className="st-divider-solid" />

      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>الصنف</th>
            <th className="st-num" style={{ textAlign: "center" }}>الكمية</th>
            <th className="st-num" style={{ textAlign: "left" }}>الوحدة</th>
          </tr>
        </thead>
        <tbody>
          {transfer.items?.map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: "right" }}>{item.name}</td>
              <td className="st-num" style={{ textAlign: "center" }}>
                {item.quantity}
              </td>
              <td className="st-num" style={{ textAlign: "left" }}>
                {item.unit || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transfer.notes && (
        <>
          <div className="st-divider-dashed" />
          <div style={{ fontSize: 10 }}>
            <div style={{ marginBottom: 2 }}>ملاحظات:</div>
            <div className="st-meta" style={{ fontSize: 9 }}>{transfer.notes}</div>
          </div>
        </>
      )}

      <div className="st-divider-dashed" />

      <div style={{ textAlign: "center", fontSize: 9, marginTop: 4 }}>
        <span className="st-meta">{companyName}</span>
      </div>
    </div>
  );
};

export default StockTransferReceipt80mm;
