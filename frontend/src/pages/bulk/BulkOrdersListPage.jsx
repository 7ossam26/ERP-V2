import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";
import StatusChip from "../../components/bulk/StatusChip";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";
import BulkPaymentModal from "../../components/bulk/BulkPaymentModal";

const ERROR_LABELS = {
  INSUFFICIENT_STOCK: "الكمية غير متاحة في المخزون",
  CREDIT_LIMIT_EXCEEDED: "تم تجاوز حد الائتمان",
  TAX_INVOICE_NOT_AVAILABLE_IN_PHASE_1: "الفوترة الضريبية غير متاحة حاليًا",
  "Order not found": "الطلب غير موجود",
};

function translateError(code) {
  if (!code) return null;
  return ERROR_LABELS[code] || code;
}

function formatConfirmError(err) {
  const code = err?.data?.error;
  if (code === "INSUFFICIENT_STOCK" && Array.isArray(err?.data?.details)) {
    const lines = err.data.details
      .map((d) => `• ${d.itemName}: مطلوب ${d.requested}، متاح ${d.available}`)
      .join("\n");
    return `الكمية غير متاحة في المخزون:\n${lines}`;
  }
  if (code === "CREDIT_LIMIT_EXCEEDED") {
    return `تم تجاوز حد الائتمان (مفتوح: ${formatEGP(err.data?.open)}، الحد: ${formatEGP(err.data?.limit)})`;
  }
  return translateError(code) || "تعذر التأكيد";
}

const STATUS_LABELS = {
  DRAFT: "مسودة",
  QUOTED: "عرض سعر",
  CONFIRMED: "مؤكد",
  PARTIALLY_PAID: "مدفوع جزئيًا",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
};

export default function BulkOrdersListPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(null); // order id being acted on
  const [payTarget, setPayTarget] = useState(null); // order for payment modal

  const load = async () => {
    setLoading(true);
    try {
      const data = await bulkService.listOrders({ status: status || undefined });
      setOrders(data);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleConfirm = async (o) => {
    if (!window.confirm(`تأكيد الطلب ${o.orderNumber || `#${o.id}`} كآجل؟`)) return;
    setWorking(o.id);
    try {
      const updated = await bulkService.confirmOrder(o.id, { paidAmount: 0 });
      toast.success(`تم التأكيد ${updated.orderNumber || ""}`);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...updated } : x)));
    } catch (err) {
      toast.error(formatConfirmError(err), { duration: 6000, style: { whiteSpace: "pre-line", textAlign: "right", maxWidth: "420px" } });
    } finally {
      setWorking(null);
    }
  };

  const handleCancel = async (o) => {
    const reason = window.prompt(`سبب إلغاء الطلب ${o.orderNumber || `#${o.id}`}:`);
    if (!reason?.trim()) return;
    setWorking(o.id);
    try {
      const updated = await bulkService.cancelOrder(o.id, reason.trim());
      toast.success("تم الإلغاء");
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...updated } : x)));
    } catch (err) {
      toast.error(translateError(err?.data?.error) || "تعذر الإلغاء");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      {payTarget && (
        <BulkPaymentModal
          order={payTarget}
          onSuccess={() => { setPayTarget(null); load(); }}
          onClose={() => setPayTarget(null)}
        />
      )}

      <div className="mb-3">
        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">الجملة</h1>
        <div className="h-1 w-16 bg-primary rounded-full mt-1 mb-3 opacity-80" />
        <BulkSectionTabs />
      </div>

      <div className="flex items-center justify-end mb-4">
        <select
          className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">كل الحالات</option>
          {Object.keys(STATUS_LABELS).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 dark:bg-primary/10">
            <tr>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الرقم</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">العميل</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المخزن</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الإجمالي</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المتبقي</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الحالة</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-text-light/60 dark:text-text-dark/60">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-text-light/40 dark:text-text-dark/40">
                  لا يوجد طلبات.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const isWorking = working === o.id;
              const canConfirm = o.status === "DRAFT" || o.status === "QUOTED";
              const canCancel = o.status === "DRAFT" || o.status === "QUOTED";
              const canPay = o.status === "CONFIRMED" || o.status === "PARTIALLY_PAID";

              return (
                <tr key={o.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors duration-150">
                  <td className="p-3">
                    <Link to={`/bulk/orders/${o.id}`} className="text-primary hover:text-primary-hover font-semibold transition-colors">
                      {o.orderNumber || `#${o.id} (مسودة)`}
                    </Link>
                  </td>
                  <td className="p-3 text-text-light dark:text-text-dark">{o.customer?.companyName || "—"}</td>
                  <td className="p-3 text-text-light dark:text-text-dark">{o.warehouse?.name || "—"}</td>
                  <td className="p-3 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                    {new Date(o.createdAt).toLocaleString("ar-EG")}
                  </td>
                  <td className="p-3 text-text-light dark:text-text-dark">{formatEGP(o.total)}</td>
                  <td className={`p-3 font-medium ${Number(o.balanceDue) > 0 ? "text-red-600 dark:text-red-400" : "text-text-light/40 dark:text-text-dark/40"}`}>
                    {formatEGP(o.balanceDue)}
                  </td>
                  <td className="p-3">
                    <StatusChip status={o.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {canConfirm && (
                        <button
                          disabled={isWorking}
                          onClick={() => handleConfirm(o)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                        >
                          تأكيد
                        </button>
                      )}
                      {canPay && (
                        <button
                          onClick={() => setPayTarget(o)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
                        >
                          دفع
                        </button>
                      )}
                      {canCancel && (
                        <button
                          disabled={isWorking}
                          onClick={() => handleCancel(o)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        >
                          إلغاء
                        </button>
                      )}
                      <Link
                        to={`/bulk/orders/${o.id}`}
                        className="px-2.5 py-1 text-xs rounded-lg bg-accent/40 hover:bg-accent/70 dark:bg-primary/10 dark:hover:bg-primary/20 text-text-light dark:text-text-dark transition-colors"
                      >
                        عرض
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
