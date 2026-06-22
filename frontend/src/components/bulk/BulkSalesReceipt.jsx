import React, { useEffect, useRef } from "react";
import { formatEGP, formatNumber } from "../../utils/bulkMoney";

const R = "bulk-sales-receipt-80mm-root";

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
      font-family: "Cairo", "Tajawal", sans-serif;
      font-size: 10px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
      color: #000 !important;
    }

    .${R}, .${R} * {
      color: #000 !important;
      font-weight: 700 !important;
    }

    .${R} .br-meta {
      font-weight: 500 !important;
      font-style: italic;
    }

    .${R} .br-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .${R} .br-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .${R} .br-divider-dashed {
      border-top: 1.5px dashed #000;
      margin: 3px 0;
    }

    .${R} .br-divider-solid {
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

    .${R} td.br-num,
    .${R} th.br-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  }
`;

// 80mm thermal sales-receipt for Bulk POS. Triggers window.print() once mounted,
// then calls onDone so the parent can unmount it.
export default function BulkSalesReceipt({ order, onDone }) {
  const printedRef = useRef(false);
  useEffect(() => {
    if (!order || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => {
      window.print();
      if (typeof onDone === "function") onDone();
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  if (!order) return null;
  const receipt = order.documents?.find((d) => d.type === "SALES_RECEIPT");
  const taxPct = (Number(order.taxRate) || 0) * 100;

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div className={R}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 13, margin: "2px 0" }}>إيصال بيع</div>
          <div style={{ fontSize: 11, margin: "1px 0" }}>
            رقم الطلب: {order.orderNumber || `#${order.id}`}
          </div>
          {receipt && (
            <div className="br-meta" style={{ fontSize: 9, margin: "1px 0" }}>
              رقم الإيصال: {receipt.documentNumber}
            </div>
          )}
          <div className="br-meta" style={{ fontSize: 9, margin: "1px 0" }}>
            {new Date(order.createdAt).toLocaleString("ar-EG")}
          </div>
        </div>

        <div className="br-divider-solid" />

        {/* Customer */}
        <div style={{ fontSize: 10 }}>
          <div className="br-row">
            <span>العميل:</span>
            <span>{order.customer?.companyName || "—"}</span>
          </div>
          {order.customer?.taxNumber && (
            <div className="br-row">
              <span>الر. الضريبي:</span>
              <span>{order.customer.taxNumber}</span>
            </div>
          )}
          {order.customer?.primaryContactPhone && (
            <div className="br-row">
              <span>الهاتف:</span>
              <span>{order.customer.primaryContactPhone}</span>
            </div>
          )}
          <div className="br-row">
            <span>المخزن:</span>
            <span>{order.warehouse?.name || "—"}</span>
          </div>
        </div>

        <div className="br-divider-solid" />

        {/* Items */}
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "right" }}>الصنف</th>
              <th className="br-num" style={{ textAlign: "center" }}>الكمية</th>
              <th className="br-num" style={{ textAlign: "left" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((l) => (
              <tr key={l.id}>
                <td style={{ textAlign: "right" }}>{l.item?.name || "—"}</td>
                <td className="br-num" style={{ textAlign: "center" }}>
                  {formatNumber(l.quantity)}
                  {l.item?.unit ? ` ${l.item.unit}` : ""}
                </td>
                <td className="br-num" style={{ textAlign: "left" }}>
                  {formatEGP(l.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ marginTop: 4, fontSize: 10 }}>
          <div className="br-row">
            <span>الصافي قبل الضريبة</span>
            <span className="br-num">{formatEGP(order.netAmount)}</span>
          </div>
          <div className="br-row">
            <span>الضريبة ({taxPct.toFixed(0)}%)</span>
            <span className="br-num">{formatEGP(order.taxAmount)}</span>
          </div>
          <div
            className="br-row"
            style={{
              fontSize: 12,
              marginTop: 2,
              paddingTop: 2,
              borderTop: "1.5px solid #000",
            }}>
            <span>الإجمالي شامل الضريبة</span>
            <span className="br-num">{formatEGP(order.total)}</span>
          </div>
          <div className="br-row">
            <span>المدفوع</span>
            <span className="br-num">{formatEGP(order.paidAmount)}</span>
          </div>
          <div className="br-row" style={{ fontSize: 12 }}>
            <span>المتبقي</span>
            <span className="br-num">{formatEGP(order.balanceDue)}</span>
          </div>
        </div>

        <div className="br-divider-dashed" />

        <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>
          شكراً لتعاملكم معنا
        </div>
      </div>
    </>
  );
}
