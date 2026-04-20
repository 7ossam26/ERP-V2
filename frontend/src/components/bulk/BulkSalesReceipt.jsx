import React, { useEffect, useRef } from "react";
import { formatEGP, formatNumber } from "../../utils/bulkMoney";

// A4 portrait sales receipt for Bulk POS — matches design doc §4.8 / §5.7.
// Triggers window.print() once mounted, then calls onDone so the parent can
// unmount it. Tax invoice variant arrives in Phase 2.

export default function BulkSalesReceipt({ order, onDone }) {
  const printedRef = useRef(false);
  useEffect(() => {
    if (!order || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => {
      window.print();
      if (typeof onDone === "function") onDone();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  if (!order) return null;
  const receipt = order.documents?.find((d) => d.type === "SALES_RECEIPT");

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden !important; }
          .bulk-receipt, .bulk-receipt * { visibility: visible !important; }
          .bulk-receipt {
            position: absolute; top: 0; right: 0; left: 0;
            font-family: 'Cairo', 'Tajawal', sans-serif;
            direction: rtl;
            color: #000;
          }
          .no-print { display: none !important; }
        }
        .bulk-receipt { font-family: inherit; direction: rtl; padding: 16px; }
      `}</style>
      <div className="bulk-receipt">
        <div className="text-center mb-4">
          <div className="text-xl font-bold">إيصال بيع</div>
          <div className="text-sm">رقم الطلب: {order.orderNumber || `#${order.id}`}</div>
          {receipt && <div className="text-xs">رقم الإيصال: {receipt.documentNumber}</div>}
          <div className="text-xs">{new Date(order.createdAt).toLocaleString("ar-EG")}</div>
        </div>

        <div className="mb-3 border-t border-b py-2 text-sm">
          <div><strong>العميل:</strong> {order.customer?.companyName}</div>
          {order.customer?.taxNumber && (
            <div><strong>الرقم الضريبي:</strong> {order.customer.taxNumber}</div>
          )}
          <div><strong>الهاتف:</strong> {order.customer?.primaryContactPhone}</div>
          <div><strong>المخزن:</strong> {order.warehouse?.name}</div>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-right p-1">الصنف</th>
              <th className="text-right p-1">الكمية</th>
              <th className="text-right p-1">سعر الوحدة</th>
              <th className="text-right p-1">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="p-1">{l.item?.name}</td>
                <td className="p-1">{formatNumber(l.quantity)} {l.item?.unit || ""}</td>
                <td className="p-1">{formatEGP(l.unitPrice)}</td>
                <td className="p-1">{formatEGP(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 text-sm w-1/2 ms-auto">
          <Row label="الصافي قبل الضريبة" value={formatEGP(order.netAmount)} />
          <Row label={`الضريبة (${(Number(order.taxRate) * 100).toFixed(0)}%)`} value={formatEGP(order.taxAmount)} />
          <Row label="الإجمالي شامل الضريبة" value={formatEGP(order.total)} bold />
          <Row label="المدفوع" value={formatEGP(order.paidAmount)} />
          <Row label="المتبقي" value={formatEGP(order.balanceDue)} bold />
        </div>

        <div className="mt-6 text-xs text-center">
          شكرًا لتعاملكم معنا.
        </div>
      </div>
    </>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between border-b py-1 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
