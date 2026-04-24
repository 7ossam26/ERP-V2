import React from "react";

export const DELIVERY_TICKET_ROOT_CLASS = "delivery-ticket-print-root";
const R = DELIVERY_TICKET_ROOT_CLASS;

function buildStyles() {
  return `
    .${R} {
      position: fixed;
      top: 0;
      left: 0;
      width: 80mm;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
      font-family: "Cairo", system-ui, sans-serif;
      color: #000;
      background: #fff;
    }

    @media print {
      @page { size: 80mm auto; margin: 3mm; }
      body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body * { visibility: hidden !important; }
      .${R}, .${R} * { visibility: visible !important; }
      .${R} {
        position: absolute !important;
        inset: 0 auto auto 0 !important;
        opacity: 1 !important;
        z-index: 9999 !important;
        width: 80mm !important;
      }
    }
  `;
}

const row   = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 };
const hr    = { border: "none", borderTop: "1px dashed #000", margin: "4px 0" };
const solid = { border: "none", borderTop: "1px solid #000", margin: "4px 0" };

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Thermal (80mm) delivery ticket for a dispatched call-center order.
 * Printed by printDeliveryTicket() — mounts into a dedicated DOM surface.
 */
export default function DeliveryTicketPrint({ order, settings }) {
  const sale    = order?.sale || {};
  const client  = sale.client || {};
  const items   = Array.isArray(sale.items) ? sale.items : [];
  const rider   = sale.deliveryMan?.name;
  const zone    = sale.deliveryZone?.name;
  const addr    = sale.deliveryAddress;
  const subtotal = Number(sale.subtotal ?? sale.total ?? 0);
  const fee      = Number(sale.deliveryFee || 0);
  const discount = Number(sale.discountAmount || 0);
  const total    = Number(sale.total || subtotal + fee - discount);

  return (
    <div className={R} dir="rtl">
      <style>{buildStyles()}</style>

      {/* Header */}
      <div style={{ textAlign: "center", fontSize: 11 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>
          {settings?.companyName || sale.branch?.name || "تذكرة توصيل"}
        </div>
        <div style={{ fontSize: 10, marginTop: 2 }}>تذكرة توصيل — طلب كول سنتر</div>
      </div>

      <hr style={solid} />

      {/* Meta */}
      <div style={{ fontSize: 11 }}>
        <div style={row}>
          <span>الطلب:</span>
          <span style={{ fontWeight: 900 }}>#{sale.saleNumber || order.id}</span>
        </div>
        <div style={row}>
          <span>التاريخ:</span>
          <span>{new Date(order?.dispatchedAt || order?.createdAt || Date.now()).toLocaleString("ar-EG")}</span>
        </div>
        {rider && (
          <div style={row}>
            <span>الطيار:</span>
            <span style={{ fontWeight: 900 }}>{rider}</span>
          </div>
        )}
      </div>

      <hr style={hr} />

      {/* Client */}
      <div style={{ fontSize: 11 }}>
        <div style={{ fontWeight: 900, marginBottom: 2 }}>العميل</div>
        <div>{client.name || "عميل نقدي"}</div>
        {client.phoneNumber && <div style={{ direction: "ltr", textAlign: "right" }}>{client.phoneNumber}</div>}
        {(zone || addr) && (
          <div style={{ marginTop: 2 }}>
            {zone && <div><strong>المنطقة: </strong>{zone}</div>}
            {addr && <div><strong>العنوان: </strong>{addr}</div>}
          </div>
        )}
      </div>

      <hr style={hr} />

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right", borderBottom: "1px solid #000", padding: "2px 1px" }}>الصنف</th>
            <th style={{ textAlign: "center", borderBottom: "1px solid #000", padding: "2px 1px" }}>كمية</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "2px 1px" }}>سعر</th>
          </tr>
        </thead>
        <tbody>
          {items.map((si, i) => {
            const name = si.item?.name || si.bom?.name || si.name || `بند ${i + 1}`;
            const qty  = Number(si.quantity || 0);
            const line = Number(si.totalPrice ?? si.total ?? (Number(si.unitPrice || 0) * qty));
            return (
              <tr key={si.id || i}>
                <td style={{ textAlign: "right", padding: "2px 1px", borderBottom: "1px dashed #999" }}>{name}</td>
                <td style={{ textAlign: "center", padding: "2px 1px", borderBottom: "1px dashed #999" }}>{qty}</td>
                <td style={{ textAlign: "left", padding: "2px 1px", borderBottom: "1px dashed #999" }}>{fmt(line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <hr style={hr} />

      {/* Totals */}
      <div style={{ fontSize: 11 }}>
        <div style={row}><span>الإجمالي الفرعي</span><span>{fmt(subtotal)}</span></div>
        {fee > 0     && <div style={row}><span>رسوم التوصيل</span><span>{fmt(fee)}</span></div>}
        {discount > 0 && <div style={row}><span>خصم</span><span>-{fmt(discount)}</span></div>}
        <div style={{ ...row, fontSize: 14, fontWeight: 900, marginTop: 4, borderTop: "2px solid #000", paddingTop: 3 }}>
          <span>الإجمالي المستحق</span><span>{fmt(total)} ج.م</span>
        </div>
        {sale.paymentMethod && (
          <div style={{ ...row, marginTop: 3 }}>
            <span>طريقة الدفع</span>
            <span style={{ fontWeight: 900 }}>{sale.paymentMethod === "CASH" ? "نقدي" : sale.paymentMethod}</span>
          </div>
        )}
      </div>

      <hr style={solid} />

      {/* Signatures */}
      <div style={{ fontSize: 10, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
        <div>توقيع الطيار:</div>
        <div style={{ borderBottom: "1px solid #000", flex: 1, marginRight: 6 }} />
      </div>
      <div style={{ fontSize: 10, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
        <div>توقيع العميل:</div>
        <div style={{ borderBottom: "1px solid #000", flex: 1, marginRight: 6 }} />
      </div>

      <div style={{ textAlign: "center", fontSize: 10, marginTop: 8 }}>شكراً لتعاملكم معنا</div>
    </div>
  );
}
