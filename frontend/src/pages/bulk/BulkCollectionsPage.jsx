import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";
import SummaryCard from "../../components/bulk/SummaryCard";
import StatusChip from "../../components/bulk/StatusChip";

export default function BulkCollectionsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("CONFIRMED,PARTIALLY_PAID");

  const load = async () => {
    setLoading(true);
    try {
      if (statusFilter) {
        const allResults = await Promise.all(
          statusFilter.split(",").map((s) => bulkService.listOrders({ status: s.trim() }))
        );
        const merged = allResults.flat();
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(merged);
      } else {
        const data = await bulkService.listOrders({});
        setOrders(data);
      }
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const totalBalanceDue = orders.reduce((s, o) => s + Number(o.balanceDue || 0), 0);

  return (
    <div className="p-3 sm:p-4" dir="rtl">
      {/* Page header */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">الجملة</h1>
        <div className="h-1 w-16 bg-primary rounded-full mt-1 mb-3 opacity-80" />
        <BulkSectionTabs />
      </div>

      {/* Sub-header row */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-text-light/60 dark:text-text-dark/60">الطلبات المعلقة التحصيل</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="CONFIRMED,PARTIALLY_PAID">معلق التحصيل</option>
            <option value="CONFIRMED">مؤكد (لم يُدفع)</option>
            <option value="PARTIALLY_PAID">مدفوع جزئيًا</option>
            <option value="">الكل</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      {!loading && orders.length > 0 && (
        <div className="mb-4 max-w-xs">
          <SummaryCard label="إجمالي المتبقي" value={formatEGP(totalBalanceDue)} tone="danger" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 dark:bg-primary/10">
            <tr>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الطلب</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">العميل</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الإجمالي</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المدفوع</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المتبقي</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-text-light/60 dark:text-text-dark/60">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-text-light/40 dark:text-text-dark/40">
                  لا يوجد طلبات معلقة.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors duration-150">
                <td className="p-3">
                  <Link to={`/bulk/orders/${o.id}`} className="text-primary hover:text-primary-hover font-semibold transition-colors">
                    {o.orderNumber || `#${o.id}`}
                  </Link>
                </td>
                <td className="p-3 text-text-light dark:text-text-dark">{o.customer?.companyName || "—"}</td>
                <td className="p-3 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                  {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                </td>
                <td className="p-3 text-text-light dark:text-text-dark">{formatEGP(o.total)}</td>
                <td className="p-3 text-emerald-700 dark:text-emerald-400 font-medium">{formatEGP(o.paidAmount)}</td>
                <td className="p-3 text-red-700 dark:text-red-400 font-bold">{formatEGP(o.balanceDue)}</td>
                <td className="p-3">
                  <StatusChip status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
