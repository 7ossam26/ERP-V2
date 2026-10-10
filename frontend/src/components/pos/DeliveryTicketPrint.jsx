import React from "react";

export const DELIVERY_TICKET_ROOT_CLASS = "delivery-ticket-print-root";
const R = DELIVERY_TICKET_ROOT_CLASS;

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
    font-family: "Cairo", system-ui, sans-serif;
    color: #000;
    background: #fff;
  }

  @media print {
    @page { size: 78mm auto; margin: 2mm; }
    body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    body * { visibility: hidden !important; }
    .${R}, .${R} * { visibility: visible !important; }
    .${R} {
      position: absolute !important;
      top: 0 !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      opacity: 1 !important;
      z-index: 9999 !important;
      width: 74mm !important;
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

    .${R} .dt-meta {
      font-weight: 800 !important;
      font-style: italic;
    }

    .${R} .dt-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 6px;
    }

    .${R} .dt-divider-dashed {
      border-top: 1.5px dashed #000;
      margin: 3px 0;
    }

    .${R} .dt-divider-solid {
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

    .${R} td.dt-num,
    .${R} th.dt-num {
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

/**
 * Thermal (80mm) delivery ticket. Mirrors the POS receipt look (logo header,
 * dashed dividers) and adds the driver-facing block: rider, zone, address.
 * No signature lines — drivers don't sign on the slip.
 */
export default function DeliveryTicketPrint({ order, settings }) {
  const sale = order?.sale || {};
  const client = sale.client || {};
  const items = Array.isArray(sale.items) ? sale.items : [];
  const rider = sale.deliveryMan?.name;
  const zone = sale.deliveryZone?.name;
  const addr = sale.deliveryAddress;

  const companyName =
    settings?.companyName || sale.branch?.name || "BerryModa";
  const companyTaxNumber = settings?.taxNumber || "";

  const subtotal = Number(sale.subtotal || 0);
  const taxAmount = Number(sale.taxAmount || 0);
  const fee = Number(sale.deliveryFee || 0);
  const discount = Number(sale.discountAmount || 0);
  // Sale.total already includes delivery fee on save (see POSPage handleCompleteSale).
  const total = Number(sale.total || subtotal + fee - discount);

  const orderDate = order?.dispatchedAt || order?.createdAt || sale?.createdAt;
  const dateText = orderDate
    ? new Date(orderDate).toLocaleString("ar-EG")
    : "—";

  return (
    <div className={R} dir="rtl">
      <style>{PRINT_STYLES}</style>

      {/* Header — same shape as the POS receipt */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img src="/assets/berrymoda-logo.svg" alt="Logo" />
        <h2 style={{ fontSize: 14, fontWeight: "bold", margin: "2px 0" }}>
          {companyName}
        </h2>
        <p style={{ fontSize: 10, margin: "1px 0" }}>{dateText}</p>
        {companyTaxNumber && (
          <p style={{ fontSize: 10, margin: "1px 0" }}>
            الرقم الضريبي: {companyTaxNumber}
          </p>
        )}
        <p style={{ fontSize: 11, margin: "2px 0", fontWeight: "bold" }}>
          تذكرة توصيل
        </p>
      </div>

      <div className="dt-divider-dashed" />

      {/* Invoice meta */}
      <div style={{ fontSize: 10, marginBottom: 3 }}>
        <div className="dt-row">
          <span>رقم الطلب:</span>
          <span style={{ fontWeight: "bold" }}>
            {sale.saleNumber || `#${order?.id}`}
          </span>
        </div>
        <div className="dt-row">
          <span>العميل:</span>
          <span>{client.name || "عميل نقدي"}</span>
        </div>
        {client.phoneNumber && (
          <div className="dt-row">
            <span>الهاتف:</span>
            <span style={{ direction: "ltr" }}>{client.phoneNumber}</span>
          </div>
        )}
      </div>

      {/* Delivery info — what the driver actually needs */}
      <div className="dt-divider-dashed" />
      <div style={{ fontSize: 10 }}>
        <div style={{ fontWeight: "bold", marginBottom: 2 }}>
          معلومات التوصيل
        </div>
        {rider && (
          <div className="dt-row">
            <span>الطيار:</span>
            <span style={{ fontWeight: "bold" }}>{rider}</span>
          </div>
        )}
        {zone && (
          <div className="dt-row">
            <span>المنطقة:</span>
            <span>{zone}</span>
          </div>
        )}
        {addr && (
          <div style={{ marginTop: 2 }}>
            <span style={{ fontWeight: "bold" }}>العنوان: </span>
            <span>{addr}</span>
          </div>
        )}
      </div>

      <div className="dt-divider-solid" />

      {/* Items */}
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>الصنف</th>
            <th className="dt-num" style={{ textAlign: "center" }}>كمية</th>
            <th className="dt-num" style={{ textAlign: "left" }}>سعر</th>
          </tr>
        </thead>
        <tbody>
          {items.map((si, i) => {
            const name = si.item?.name || si.bom?.name || si.name || `بند ${i + 1}`;
            const qty = Number(si.quantity || 0);
            const line = Number(
              si.totalPrice ?? si.total ?? Number(si.unitPrice || 0) * qty,
            );
            return (
              <tr key={si.id || i}>
                <td style={{ textAlign: "right" }}>{name}</td>
                <td className="dt-num" style={{ textAlign: "center" }}>{qty}</td>
                <td className="dt-num" style={{ textAlign: "left" }}>{fmt(line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sub-totals */}
      <div style={{ marginTop: 4, fontSize: 10 }}>
        <div className="dt-row">
          <span>المجموع الفرعي</span>
          <span className="dt-num">{fmt(subtotal)} ج.م</span>
        </div>
        {discount > 0 && (
          <div className="dt-row">
            <span>خصم</span>
            <span className="dt-num">-{fmt(discount)} ج.م</span>
          </div>
        )}
        <div className="dt-row">
          <span>ضريبة</span>
          <span className="dt-num">{fmt(taxAmount)} ج.م</span>
        </div>
        {fee > 0 && (
          <div className="dt-row">
            <span>رسوم التوصيل</span>
            <span className="dt-num">{fmt(fee)} ج.م</span>
          </div>
        )}
        <div className="dt-row">
          <span>الدفع</span>
          <span>{paymentLabelAr(sale.paymentMethod)}</span>
        </div>
      </div>

      <div className="dt-divider-solid" />

      {/* Grand total */}
      <div className="dt-row" style={{ fontSize: 13, margin: "3px 0" }}>
        <span>الإجمالي المستحق</span>
        <span className="dt-num">{fmt(total)} ج.م</span>
      </div>

      <div className="dt-divider-dashed" />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>
        <p style={{ fontWeight: "bold", margin: "1px 0" }}>
          شكراً لتعاملكم معنا
        </p>
        <p style={{ margin: "1px 0" }}>{companyName}</p>
      </div>
    </div>
  );
}
