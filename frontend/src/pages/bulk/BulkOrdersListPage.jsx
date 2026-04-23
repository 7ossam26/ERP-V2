import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";
import StatusChip from "../../components/bulk/StatusChip";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";

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

  return (
    <div className="p-4 sm:p-6" dir="rtl">
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
              <th className="p-3 w-12"></th>
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
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors duration-150"
              >
                <td className="p-3">
                  <Link
                    to={`/bulk/orders/${o.id}`}
                    className="text-primary hover:text-primary-hover font-semibold transition-colors"
                  >
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
                <td className="p-3 text-center">
                  <Link
                    to={`/bulk/orders/${o.id}`}
                    title="عرض التفاصيل"
                    className="text-primary hover:text-primary-hover transition-colors inline-flex"
                  >
                    <span className="material-icons-round text-xl">visibility</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
