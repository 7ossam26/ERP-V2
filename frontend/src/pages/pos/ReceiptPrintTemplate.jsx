import React from "react";

const ReceiptPrintTemplate = React.forwardRef(({ data }, ref) => {
  if (!data) return null;

  const {
    companyName,
    companyNameEnglish,
    taxNumber,
    address,
    phone,
    logoUrl,
    taxEnabledOnSales,
    branchName,
    branchAddress,
    saleNumber,
    date,
    cashierName,
    clientName,
    clientTier,
    items,
    subtotal,
    taxRate,
    taxAmount,
    total,
    paymentMethod,
    paidAmount,
    changeAmount,
  } = data;

  const paymentMethodAr = {
    CASH: "نقدي",
    INSTAPAY: "InstaPay",
    VISA: "فيزا",
    CARD: "بطاقة",
  };

  const tierBadge = clientTier === "WHOLESALE" ? " (جملة)" : "";

  const fmt = (d) => {
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const num = (n) => {
    const v = parseFloat(n);
    return isNaN(v) ? "0.00" : v.toFixed(2);
  };

  const S = {
    wrapper: {
      width: "80mm",
      fontFamily: '"Cairo", Tahoma, sans-serif',
      fontSize: "12px",
      lineHeight: "1.5",
      padding: "4mm",
      color: "#000",
      direction: "rtl",
    },
    center: { textAlign: "center" },
    divider: { borderTop: "1px dashed #000", margin: "2mm 0" },
    row: { display: "flex", justifyContent: "space-between", fontSize: "11px" },
    bold: { fontWeight: "bold" },
    small: { fontSize: "10px", color: "#555" },
    tiny: { fontSize: "9px", color: "#666", paddingRight: "4mm" },
  };

  return (
    <div ref={ref} style={S.wrapper}>
      {/* Header */}
      <div style={{ ...S.center, marginBottom: "4mm" }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            style={{ maxWidth: "34mm", maxHeight: "18mm", margin: "0 auto 3mm auto" }}
          />
        ) : null}
        <div style={{ fontSize: "16px", ...S.bold }}>{companyName}</div>
        {companyNameEnglish ? (
          <div style={{ fontSize: "10px", letterSpacing: "0.08em" }}>
            {companyNameEnglish}
          </div>
        ) : null}
        <div style={{ fontSize: "11px" }}>{branchName}</div>
        {branchAddress && <div style={S.small}>{branchAddress}</div>}
        {address && <div style={S.small}>{address}</div>}
        {phone && <div style={S.small}>الهاتف: {phone}</div>}
        {taxNumber && <div style={S.small}>الرقم الضريبي: {taxNumber}</div>}
      </div>

      <div style={S.divider} />

      {/* Sale info */}
      <div style={{ fontSize: "11px" }}>
        <div>
          فاتورة: <span style={S.bold}>{saleNumber}</span>
        </div>
        <div>التاريخ: {fmt(date)}</div>
        <div>الكاشير: {cashierName}</div>
        <div>
          العميل: {clientName}
          {tierBadge && (
            <span style={{ color: "#7c3aed" }}>{tierBadge}</span>
          )}
        </div>
      </div>

      <div style={S.divider} />

      {/* Items */}
      <div>
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: "2mm" }}>
            <div style={{ ...S.bold, fontSize: "11px" }}>{item.name}</div>
            <div style={{ ...S.row, paddingRight: "2mm" }}>
              <span>
                {num(item.quantity)}{" \u00d7 "}{num(item.unitPrice)}
              </span>
              <span>{num(item.total)}</span>
            </div>
            {item.rollCuts?.length > 0 &&
              item.rollCuts.map((rc, j) => (
                <div key={j} style={S.tiny}>
                  من لفة {rc.rollNumber} ({num(rc.length)} م)
                </div>
              ))}
          </div>
        ))}
      </div>

      <div style={S.divider} />

      {/* Totals */}
      <div style={{ fontSize: "11px" }}>
        <div style={S.row}>
          <span>المجموع:</span>
          <span>{num(subtotal)}</span>
        </div>

        {taxEnabledOnSales && parseFloat(taxAmount) > 0 && (
          <div style={S.row}>
            <span>الضريبة ({(parseFloat(taxRate) * 100).toFixed(0)}%):</span>
            <span>{num(taxAmount)}</span>
          </div>
        )}

        <div
          style={{
            ...S.row,
            ...S.bold,
            fontSize: "13px",
            marginTop: "1mm",
          }}
        >
          <span>الإجمالي:</span>
          <span>{num(total)}</span>
        </div>

        <div style={S.row}>
          <span>
            الدفع ({paymentMethodAr[paymentMethod] || paymentMethod}):
          </span>
          <span>{num(paidAmount)}</span>
        </div>

        {paymentMethod === "CASH" && parseFloat(changeAmount) > 0 && (
          <div style={S.row}>
            <span>الباقي:</span>
            <span>{num(changeAmount)}</span>
          </div>
        )}
      </div>

      <div style={{ ...S.divider, margin: "3mm 0" }} />

      {/* Footer */}
      <div style={{ ...S.center, fontSize: "11px" }}>شكرًا لتعاملكم</div>
    </div>
  );
});

ReceiptPrintTemplate.displayName = "ReceiptPrintTemplate";

export default ReceiptPrintTemplate;
