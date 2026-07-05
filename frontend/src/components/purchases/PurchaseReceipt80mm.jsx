import React from "react";

export const PURCHASE_RECEIPT_ROOT_CLASS = "purchase-receipt-80mm-root";

const R = PURCHASE_RECEIPT_ROOT_CLASS;

const paymentLabelAr = (m) => {
  const up = (m || "").toUpperCase();
  return (
    { CASH: "نقدي", CREDIT: "بطاقة ائتمان", DEFERRED: "آجل", MIXED: "متنوع" }[up] ||
    m ||
    "—"
  );
};

const fmt = (n) => Number(n || 0).toFixed(2);

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

    .${R} .pu-meta {
      font-weight: 800 !important;
      font-style: italic;
    }

    .${R} .pu-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .${R} .pu-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .${R} .pu-divider-dashed {
      border-top: 1.5px dashed #000;
      margin: 3px 0;
    }

    .${R} .pu-divider-solid {
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

    .${R} td.pu-num,
    .${R} th.pu-num {
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

const PurchaseReceipt80mm = ({ purchase, settings = {} }) => {
  if (!purchase) return null;

  const companyName = settings.companyName || "Elghonemy ERP";
  const taxNumber = settings.taxNumber;

  const isCancelled = purchase.paymentStatus === "CANCELLED";
  const items = Array.isArray(purchase.items) ? purchase.items : [];
  const remaining = Number(purchase.remaining || 0);
  const discountAmount = Number(purchase.discountAmount || 0);

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img src="/assets/logo.png" alt="Logo" />
        <div style={{ fontSize: 13, margin: "2px 0" }}>{companyName}</div>
        {taxNumber && (
          <div className="pu-meta" style={{ fontSize: 9, margin: "1px 0" }}>
            الرقم الضريبي: {taxNumber}
          </div>
        )}
        <div style={{ fontSize: 12, margin: "2px 0" }}>فاتورة مشتريات</div>
        <div className="pu-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          رقم الفاتورة: #{purchase.id}
        </div>
        <div className="pu-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          {purchase.createdAt
            ? new Date(purchase.createdAt).toLocaleString("ar-EG")
            : "—"}
        </div>
        {isCancelled && (
          <div
            style={{
              display: "inline-block",
              border: "2px solid #000",
              padding: "2px 10px",
              fontSize: 12,
              letterSpacing: "0.2em",
              margin: "4px auto",
            }}>
            ملغاة
          </div>
        )}
      </div>

      <div className="pu-divider-solid" />

      {/* Meta */}
      <div style={{ fontSize: 10 }}>
        <div className="pu-row">
          <span>المورد:</span>
          <span>{purchase.supplier?.name || "—"}</span>
        </div>
        <div className="pu-row">
          <span>المخزن:</span>
          <span>{purchase.warehouse?.name || "—"}</span>
        </div>
        {purchase.treasury?.name && (
          <div className="pu-row">
            <span>الخزينة:</span>
            <span>{purchase.treasury.name}</span>
          </div>
        )}
        {purchase.supplierInvoiceNo && (
          <div className="pu-row">
            <span>فاتورة المورد:</span>
            <span>{purchase.supplierInvoiceNo}</span>
          </div>
        )}
        <div className="pu-row">
          <span>طريقة الدفع:</span>
          <span>{paymentLabelAr(purchase.paymentMethod)}</span>
        </div>
      </div>

      <div className="pu-divider-solid" />

      {/* Items */}
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>الصنف</th>
            <th className="pu-num" style={{ textAlign: "center" }}>الكمية</th>
            <th className="pu-num" style={{ textAlign: "left" }}>سعر</th>
            <th className="pu-num" style={{ textAlign: "left" }}>إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={{ textAlign: "right" }}>{it.name || it.item?.name || "—"}</td>
              <td className="pu-num" style={{ textAlign: "center" }}>
                {Number(it.quantity || 0).toFixed(2)}
              </td>
              <td className="pu-num" style={{ textAlign: "left" }}>
                {fmt(it.purchasePrice)}
              </td>
              <td className="pu-num" style={{ textAlign: "left" }}>
                {fmt(it.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginTop: 4, fontSize: 10 }}>
        <div className="pu-row">
          <span>المجموع الفرعي</span>
          <span className="pu-num">{fmt(purchase.subtotal)} ج.م</span>
        </div>
        {discountAmount > 0 && (
          <div className="pu-row">
            <span>
              الخصم{" "}
              {purchase.discountType === "PERCENTAGE"
                ? `(%${purchase.discountValue})`
                : ""}
            </span>
            <span className="pu-num">-{fmt(discountAmount)} ج.م</span>
          </div>
        )}
        <div
          className="pu-row"
          style={{
            fontSize: 12,
            marginTop: 2,
            paddingTop: 2,
            borderTop: "1.5px solid #000",
          }}>
          <span>الصافي</span>
          <span className="pu-num">{fmt(purchase.netTotal)} ج.م</span>
        </div>
        <div className="pu-row">
          <span>المدفوع</span>
          <span className="pu-num">{fmt(purchase.paidAmount)} ج.م</span>
        </div>
        {remaining > 0 && (
          <div className="pu-row" style={{ fontSize: 12 }}>
            <span>المتبقي</span>
            <span className="pu-num">{fmt(remaining)} ج.م</span>
          </div>
        )}
      </div>

      <div className="pu-divider-dashed" />

      <div style={{ textAlign: "center", fontSize: 9, marginTop: 4 }}>
        <div className="pu-meta">{companyName}</div>
      </div>
    </div>
  );
};

export default PurchaseReceipt80mm;
