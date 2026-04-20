import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";

const STATUS_LABELS = {
  DRAFT: "مسودة",
  QUOTED: "عرض سعر",
  CONFIRMED: "مؤكد",
  PARTIALLY_PAID: "مدفوع جزئيًا",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
};

const STATUS_COLORS = {
  DRAFT: "bg-gray-200 text-gray-800",
  QUOTED: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-purple-100 text-purple-800",
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">طلبات الجملة</h1>
        <div className="flex gap-2">
          <select
            className="border rounded-md p-2 bg-white dark:bg-gray-800"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">كل الحالات</option>
            {Object.keys(STATUS_LABELS).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <Link
            to="/bulk/pos"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            فاتورة جديدة
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-right p-3">الرقم</th>
              <th className="text-right p-3">العميل</th>
              <th className="text-right p-3">المخزن</th>
              <th className="text-right p-3">التاريخ</th>
              <th className="text-right p-3">الإجمالي</th>
              <th className="text-right p-3">المتبقي</th>
              <th className="text-right p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">لا يوجد طلبات.</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="p-3">
                  <Link to={`/bulk/orders/${o.id}`} className="text-blue-600 hover:underline font-medium">
                    {o.orderNumber || `#${o.id} (مسودة)`}
                  </Link>
                </td>
                <td className="p-3">{o.customer?.companyName || "—"}</td>
                <td className="p-3">{o.warehouse?.name || "—"}</td>
                <td className="p-3 ltr-numbers">{new Date(o.createdAt).toLocaleString("ar-EG")}</td>
                <td className="p-3">{formatEGP(o.total)}</td>
                <td className="p-3">{formatEGP(o.balanceDue)}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[o.status] || ""}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
