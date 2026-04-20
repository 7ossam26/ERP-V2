import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP, formatNumber } from "../../utils/bulkMoney";
import BulkSalesReceipt from "../../components/bulk/BulkSalesReceipt";

const STATUS_LABELS = {
  DRAFT: "مسودة",
  QUOTED: "عرض سعر",
  CONFIRMED: "مؤكد",
  PARTIALLY_PAID: "مدفوع جزئيًا",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
};

export default function BulkOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setOrder(await bulkService.getOrder(id));
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل الطلب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onConfirmCash = async () => {
    if (!order) return;
    if (!window.confirm("تأكيد الطلب وخصم المخزون نقدًا؟")) return;
    setWorking(true);
    try {
      const updated = await bulkService.confirmOrder(order.id, {
        paidAmount: Number(order.total),
      });
      toast.success(`تم التأكيد ${updated.orderNumber || ""}`);
      setOrder(updated);
    } catch (err) {
      const detail = err?.data?.details
        ? err.data.details.map((d) => `${d.itemName} (طلب ${d.requested}, متاح ${d.available})`).join(", ")
        : "";
      toast.error(`${err?.data?.error || "تعذر التأكيد"}${detail ? `: ${detail}` : ""}`);
    } finally {
      setWorking(false);
    }
  };

  const onCancel = async () => {
    if (!order) return;
    const reason = window.prompt("سبب الإلغاء:");
    if (!reason || !reason.trim()) return;
    setWorking(true);
    try {
      const updated = await bulkService.cancelOrder(order.id, reason.trim());
      toast.success("تم الإلغاء");
      setOrder(updated);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الإلغاء");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-6 text-center">جارٍ التحميل...</div>;
  if (!order) return <div className="p-6 text-center">الطلب غير موجود.</div>;

  const canConfirm = order.status === "DRAFT" || order.status === "QUOTED";
  const canCancel = order.status === "DRAFT" || order.status === "QUOTED";
  const receipt = order.documents?.find((d) => d.type === "SALES_RECEIPT");

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      {printing && (
        <BulkSalesReceipt order={order} onDone={() => setPrinting(false)} />
      )}

      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <Link to="/bulk/orders" className="text-blue-600 hover:underline text-sm">
            ← الرجوع للقائمة
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {order.orderNumber || `طلب #${order.id}`}
          </h1>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {STATUS_LABELS[order.status] || order.status} ·{" "}
            {new Date(order.createdAt).toLocaleString("ar-EG")}
          </div>
        </div>
        <div className="flex gap-2">
          {canCancel && (
            <button
              disabled={working}
              onClick={onCancel}
              className="border text-red-700 border-red-200 hover:bg-red-50 px-3 py-2 rounded-md disabled:opacity-50"
            >
              إلغاء الطلب
            </button>
          )}
          {canConfirm && (
            <button
              disabled={working}
              onClick={onConfirmCash}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
            >
              {working ? "..." : "تأكيد نقدي"}
            </button>
          )}
          {receipt && (
            <button
              onClick={() => setPrinting(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              طباعة الإيصال
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 no-print">
        <Card title="العميل">
          <div className="font-semibold">{order.customer?.companyName}</div>
          <div className="text-xs text-gray-500">
            {order.customer?.taxNumber ? `رقم ضريبي ${order.customer.taxNumber}` : "بدون رقم ضريبي"}
          </div>
        </Card>
        <Card title="المخزن">{order.warehouse?.name}</Card>
        <Card title="أنشأ بواسطة">{order.createdBy?.name}</Card>
      </div>

      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 mb-4 no-print">
        <h3 className="font-bold mb-2">السطور</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-right p-2">الصنف</th>
              <th className="text-right p-2">الكمية</th>
              <th className="text-right p-2">السعر</th>
              <th className="text-right p-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">{l.item?.name}</td>
                <td className="p-2 ltr-numbers">{formatNumber(l.quantity)} {l.item?.unit || ""}</td>
                <td className="p-2">{formatEGP(l.unitPrice)}</td>
                <td className="p-2">{formatEGP(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 mb-4 no-print">
        <h3 className="font-bold mb-2">الإجماليات</h3>
        <div className="space-y-1 text-sm">
          <Row label="الصافي قبل الضريبة" value={formatEGP(order.netAmount)} />
          <Row label={`الضريبة (${(Number(order.taxRate) * 100).toFixed(0)}%)`} value={formatEGP(order.taxAmount)} />
          <Row label="الإجمالي شامل الضريبة" value={formatEGP(order.total)} bold />
          <Row label="المدفوع" value={formatEGP(order.paidAmount)} />
          <Row label="المتبقي" value={formatEGP(order.balanceDue)} bold />
        </div>
      </div>

      {order.documents?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 no-print">
          <h3 className="font-bold mb-2">المستندات</h3>
          <ul className="text-sm space-y-1">
            {order.documents.map((d) => (
              <li key={d.id}>
                <span className="text-gray-500">{d.type}:</span>{" "}
                <span className="font-medium">{d.documentNumber}</span>{" "}
                <span className="text-xs text-gray-400">
                  ({new Date(d.issuedAt).toLocaleString("ar-EG")})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
