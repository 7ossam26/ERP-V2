import React, { useEffect, useRef } from "react";
import { reasonLabel } from "../pos/DiscountPanel";

// 80mm thermal-receipt template for call-center orders (D per design §7.3).
// Uses window.print() via an inline <style> with @page {size: 80mm auto}.
// Arabic RTL, single column, compact.

const PrintTicket = ({ order, onDone }) => {
  const printedRef = useRef(false);

  useEffect(() => {
    if (!order || printedRef.current) return;
    printedRef.current = true;
    // Give React a tick to paint, then fire the browser print dialog.
    const t = setTimeout(() => {
      window.print();
      if (typeof onDone === "function") onDone();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  if (!order) return null;
  const sale = order.sale || {};
  const client = sale.client || {};
  const zone = sale.deliveryZone || null;
  const items = sale.items || [];

  return (
    <>
      <style>{`
        @media print {
          @page { size: 78mm auto; margin: 2mm; }
          body * { visibility: hidden !important; }
          .print-ticket, .print-ticket * { visibility: visible !important; }
          .print-ticket {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 74mm;
            font-family: 'Cairo', 'Tajawal', sans-serif;
            font-size: 10px;
            direction: rtl;
          }
          .no-print { display: none !important; }
        }
        .print-ticket { width: 74mm; margin: 0 auto; font-family: inherit; direction: rtl; }
      `}</style>
      <div className="print-ticket p-2 text-right">
        <div className="text-center font-bold text-base mb-1">طلب كول سنتر</div>
        <div className="text-center text-xs mb-2">#{sale.saleNumber || "-"}</div>
        <hr className="border-dashed border-black my-1" />
        <div className="text-xs flex justify-between">
          <span>الفرع:</span>
          <span>{order.branch?.name || "-"}</span>
        </div>
        <div className="text-xs flex justify-between">
          <span>التاريخ:</span>
          <span>{order.createdAt ? new Date(order.createdAt).toLocaleString("ar-EG") : "-"}</span>
        </div>
        <hr className="border-dashed border-black my-1" />
        <div className="text-xs font-bold">بيانات العميل</div>
        <div className="text-xs">الاسم: {client.name || "-"}</div>
        <div className="text-xs">الهاتف: {client.phoneNumber || "-"}</div>
        <div className="text-xs">العنوان: {sale.deliveryAddress || client.address || "-"}</div>
        {zone && <div className="text-xs">المنطقة: {zone.name}</div>}
        <hr className="border-dashed border-black my-1" />
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-right">الصنف</th>
              <th className="text-center">الكمية</th>
              <th className="text-left">السعر</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="text-right">
                  {it.item?.name || it.bom?.name || "-"}
                </td>
                <td className="text-center">{Number(it.quantity)}</td>
                <td className="text-left">{Number(it.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="border-dashed border-black my-1" />
        <div className="text-xs flex justify-between">
          <span>المجموع:</span>
          <span>{Number(sale.subtotal || 0).toFixed(2)}</span>
        </div>
        {Number(sale.discountAmount || 0) > 0 && (
          <div className="text-xs flex justify-between">
            <span>
              الخصم
              {sale.discountType === "PERCENTAGE" && sale.discountValue != null
                ? ` (${Number(sale.discountValue)}%)`
                : ""}
              {sale.discountReason ? ` — ${reasonLabel(sale.discountReason)}` : ""}
              :
            </span>
            <span>-{Number(sale.discountAmount).toFixed(2)}</span>
          </div>
        )}
        {sale.deliveryFee != null && (
          <div className="text-xs flex justify-between">
            <span>رسوم التوصيل:</span>
            <span>{Number(sale.deliveryFee).toFixed(2)}</span>
          </div>
        )}
        <div className="text-sm font-bold flex justify-between mt-1">
          <span>الإجمالي:</span>
          <span>{Number(sale.total || 0).toFixed(2)}</span>
        </div>
        {sale.notes && (
          <>
            <hr className="border-dashed border-black my-1" />
            <div className="text-xs">ملاحظات: {sale.notes}</div>
          </>
        )}
        <div className="text-center text-xs mt-2">الدفع: كاش عند الاستلام</div>
      </div>
    </>
  );
};

export default PrintTicket;
