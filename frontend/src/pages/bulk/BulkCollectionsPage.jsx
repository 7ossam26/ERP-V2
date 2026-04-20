import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";

const METHOD_LABELS = {
  CASH: "نقدي",
  BANK_TRANSFER: "تحويل بنكي",
  CHEQUE: "شيك",
  CREDIT: "آجل",
};

export default function BulkCollectionsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("CONFIRMED,PARTIALLY_PAID");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) {
        // Fetch multiple statuses by calling multiple times or filter client-side
        const allResults = await Promise.all(
          statusFilter.split(",").map((s) => bulkService.listOrders({ status: s.trim() }))
        );
        const merged = allResults.flat();
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(merged);
      } else {
        const data = await bulkService.listOrders(params);
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
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">التحصيلات</h1>
          <div className="text-sm text-gray-500">الطلبات المعلقة التحصيل</div>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="border rounded-md p-2 bg-white dark:bg-gray-800 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="CONFIRMED,PARTIALLY_PAID">معلق التحصيل</option>
            <option value="CONFIRMED">مؤكد (لم يُدفع)</option>
            <option value="PARTIALLY_PAID">مدفوع جزئيًا</option>
            <option value="">الكل</option>
          </select>
          <Link
            to="/bulk/orders"
            className="text-sm text-blue-600 hover:underline"
          >
            كل الطلبات
          </Link>
        </div>
      </div>

      {!loading && orders.length > 0 && (
        <div className="mb-3 text-sm font-medium text-red-700 dark:text-red-400">
          إجمالي المتبقي: {formatEGP(totalBalanceDue)}
        </div>
      )}

      <div className="overflow-x-auto bg-white dark:bg-gray-800 border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-right p-3">الطلب</th>
              <th className="text-right p-3">العميل</th>
              <th className="text-right p-3">التاريخ</th>
              <th className="text-right p-3">الإجمالي</th>
              <th className="text-right p-3">المدفوع</th>
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
                <td colSpan={7} className="p-4 text-center text-gray-500">لا يوجد طلبات معلقة.</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="p-3">
                  <Link to={`/bulk/orders/${o.id}`} className="text-blue-600 hover:underline font-medium">
                    {o.orderNumber || `#${o.id}`}
                  </Link>
                </td>
                <td className="p-3">{o.customer?.companyName || "—"}</td>
                <td className="p-3 ltr-numbers">{new Date(o.createdAt).toLocaleDateString("ar-EG")}</td>
                <td className="p-3">{formatEGP(o.total)}</td>
                <td className="p-3 text-green-700 dark:text-green-400">{formatEGP(o.paidAmount)}</td>
                <td className="p-3 text-red-700 dark:text-red-400 font-medium">{formatEGP(o.balanceDue)}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    o.status === "CONFIRMED"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {o.status === "CONFIRMED" ? "مؤكد" : "مدفوع جزئيًا"}
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
