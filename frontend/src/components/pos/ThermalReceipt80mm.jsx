import React from "react";

export const THERMAL_RECEIPT_ROOT_CLASS = "thermal-receipt-80mm-root";

const R = THERMAL_RECEIPT_ROOT_CLASS;

const paymentLabelAr = (m) =>
  m === "CASH" ? "نقدي" : m === "VISA" ? "فيزا" : "انستاباي";

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
    @page {
      size: 78mm auto;
      margin: 2mm 2mm;
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
      width: 74mm;
      margin: 0 auto;
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

    .${R} .tr-row {
      display: flex;
      justify-content: space-between;
    }

    .${R} .tr-divider-dashed {
      border-top: 1px dashed #000;
      margin: 3px 0;
    }

    .${R} .tr-divider-solid {
      border-top: 1px solid #000;
      margin: 3px 0;
    }

    .${R} table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .${R} th {
      padding: 2px 1px;
      border-bottom: 1px solid #000;
      font-weight: bold;
    }

    .${R} td {
      padding: 2px 1px;
      border-bottom: 1px dashed #000;
      vertical-align: top;
    }

    .${R} img {
      max-width: 42mm;
      margin: 0 auto 4px auto;
      display: block;
      filter: grayscale(100%) contrast(180%);
    }
  }
`;

const ThermalReceipt80mm = ({ sale, settings = {} }) => {
  if (!sale) return null;

  const companyName =
    settings.companyName || sale.branch?.name || "Elghonemy ERP";
  const companyTaxNumber = settings.taxNumber || "";

  const items = sale.items || [];
  const subtotal = Number(sale.subtotal || 0);
  const taxAmount = Number(sale.taxAmount || 0);
  const total = Number(sale.total || 0);
  const deliveryFee = Number(sale.deliveryFee || 0);
  const discountAmount = Number(sale.discountAmount || 0);
  // Sale.total already includes delivery fee on save (see POSPage handleCompleteSale).
  const grandTotal = total;

  const clientName = sale.client?.name || "عميل نقدي";
  const employeeName =
    sale.user?.name ||
    sale.user?.username ||
    sale.employee?.name ||
    "—";
  const dateText = sale.createdAt
    ? new Date(sale.createdAt).toLocaleString("ar-EG")
    : "—";

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img src="/assets/logo.png" alt="Logo" />
        <h2 style={{ fontSize: 14, fontWeight: "bold", margin: "2px 0" }}>
          {companyName}
        </h2>
        <p style={{ fontSize: 10, margin: "1px 0" }}>{dateText}</p>
        {companyTaxNumber && (
          <p style={{ fontSize: 10, margin: "1px 0" }}>
            الرقم الضريبي: {companyTaxNumber}
          </p>
        )}
        <p style={{ fontSize: 9, margin: "1px 0", fontStyle: "italic" }}>
          (إعادة طباعة)
        </p>
      </div>

      <div className="tr-divider-dashed" />

      {/* Invoice meta */}
      <div style={{ fontSize: 10, marginBottom: 3 }}>
        <div className="tr-row">
          <span>رقم الفاتورة:</span>
          <span style={{ fontWeight: "bold" }}>
            {sale.saleNumber || `#${sale.id}`}
          </span>
        </div>
        <div className="tr-row">
          <span>العميل:</span>
          <span>{clientName}</span>
        </div>
        <div className="tr-row">
          <span>البائع:</span>
          <span>{employeeName}</span>
        </div>
      </div>

      {/* Delivery section */}
      {sale.deliveryAddress && (
        <>
          <div className="tr-divider-dashed" />
          <div style={{ fontSize: 10 }}>
            <div style={{ fontWeight: "bold", marginBottom: 2 }}>
              معلومات التوصيل
            </div>
            <div>
              <span style={{ fontWeight: "bold" }}>العنوان: </span>
              <span>{sale.deliveryAddress}</span>
            </div>
          </div>
        </>
      )}

      <div className="tr-divider-solid" />

      {/* Items */}
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>الصنف</th>
            <th style={{ textAlign: "center" }}>كمية</th>
            <th style={{ textAlign: "left" }}>سعر</th>
          </tr>
        </thead>
        <tbody>
          {items.map((si, idx) => (
            <tr key={si.id || idx}>
              <td style={{ textAlign: "right" }}>
                {si.item?.name || si.name || "-"}
              </td>
              <td style={{ textAlign: "center" }}>
                {Number(si.quantity || 0)}
              </td>
              <td style={{ textAlign: "left" }}>{fmt(si.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sub-totals */}
      <div style={{ marginTop: 4, fontSize: 10 }}>
        <div className="tr-row">
          <span>المجموع الفرعي</span>
          <span>{fmt(subtotal)} ج.م</span>
        </div>
        {discountAmount > 0 && (
          <div className="tr-row">
            <span>خصم</span>
            <span>-{fmt(discountAmount)} ج.م</span>
          </div>
        )}
        <div className="tr-row">
          <span>ضريبة</span>
          <span>{fmt(taxAmount)} ج.م</span>
        </div>
        {deliveryFee > 0 && (
          <div className="tr-row">
            <span>توصيل</span>
            <span>{fmt(deliveryFee)} ج.م</span>
          </div>
        )}
        <div className="tr-row">
          <span>الدفع</span>
          <span>{paymentLabelAr(sale.paymentMethod)}</span>
        </div>
      </div>

      <div className="tr-divider-solid" />

      {/* Grand total */}
      <div
        className="tr-row"
        style={{ fontSize: 13, fontWeight: "bold", margin: "3px 0" }}>
        <span>الإجمالي</span>
        <span>{fmt(grandTotal)} ج.م</span>
      </div>

      <div className="tr-divider-dashed" />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>
        <p style={{ fontWeight: "bold", margin: "1px 0" }}>
          نأمل رؤيتكم مرة أخرى
        </p>
        <p style={{ margin: "1px 0" }}>{companyName}</p>
      </div>
    </div>
  );
};

export default ThermalReceipt80mm;
