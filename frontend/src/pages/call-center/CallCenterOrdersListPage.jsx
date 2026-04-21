import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { callCenterService } from "../../services/callCenterService";
import CancelOrderDialog, { reasonLabel } from "../../components/orders/CancelOrderDialog";

const STATUS_LABELS = {
  NEW: "جديد",
  PREPARING: "جارٍ التجهيز",
  READY: "جاهز",
  OUT_FOR_DELIVERY: "خرج للتوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

const STATUS_COLORS = {
  NEW: "bg-red-100 text-red-800",
  PREPARING: "bg-yellow-100 text-yellow-800",
  READY: "bg-blue-100 text-blue-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};

const CallCenterOrdersListPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancelId, setCancelId] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await callCenterService.listOrders({ status: statusFilter || undefined, page });
      setData(res.data);
      setTotalPages(res.pagination.pages || 1);
    } catch (err) {
      console.error(err);
      toast.error("تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const ADVANCE_LABEL = {
    NEW: "ابدأ التجهيز",
    PREPARING: "جاهز",
    READY: "خرج للتوصيل",
    OUT_FOR_DELIVERY: "تم التسليم",
  };
  const ADVANCE_NEXT = {
    NEW: "PREPARING",
    PREPARING: "READY",
    READY: "OUT_FOR_DELIVERY",
    OUT_FOR_DELIVERY: "DELIVERED",
  };

  const handleAdvanceStatus = async (orderId, currentStatus) => {
    const nextStatus = ADVANCE_NEXT[currentStatus];
    if (!nextStatus) return;
    setStatusUpdating(orderId);
    try {
      await callCenterService.updateOrderStatus(orderId, nextStatus);
      toast.success("تم تحديث الحالة");
      load();
    } catch (err) {
      const code = err?.data?.error;
      if (code === "ALREADY_CLAIMED") {
        toast.error("تم تغيير حالة الطلب بواسطة موظف آخر");
      } else if (code === "SHIFT_REQUIRED") {
        toast.error("يجب فتح وردية في هذا الفرع أولاً");
      } else {
        toast.error(err?.data?.message || "تعذر تحديث الحالة");
      }
      load();
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleConfirmCancel = async ({ reason, note }) => {
    if (!cancelId) return;
    setCancelSubmitting(true);
    try {
      await callCenterService.cancelOrder(cancelId, reason, note);
      toast.success("تم إلغاء الطلب");
      setCancelId(null);
      load();
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الإلغاء");
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">طلبات الكول سنتر</h1>
        <select
          className="border rounded-md p-2 bg-white dark:bg-gray-800"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          {Object.keys(STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center p-8 text-gray-500">جارٍ التحميل...</div>
      ) : data.length === 0 ? (
        <div className="text-center p-8 text-gray-500">لا توجد طلبات</div>
      ) : (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="p-2 text-right">الرقم</th>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">العميل</th>
                <th className="p-2 text-right">الفرع</th>
                <th className="p-2 text-right">الإجمالي</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-2">{o.sale?.saleNumber}</td>
                  <td className="p-2">{new Date(o.createdAt).toLocaleString("ar-EG")}</td>
                  <td className="p-2">
                    <div>{o.sale?.client?.name}</div>
                    <div className="text-xs text-gray-500">{o.sale?.client?.phoneNumber}</div>
                  </td>
                  <td className="p-2">{o.branch?.name}</td>
                  <td className="p-2">{Number(o.sale?.total).toFixed(2)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                    {o.claimedBy?.name && o.status !== "CANCELLED" && (
                      <div className="text-xs text-blue-600 mt-1">
                        تم الاستلام بواسطة {o.claimedBy.name}
                      </div>
                    )}
                    {o.status === "CANCELLED" && (
                      <div className="text-xs text-gray-500 mt-1">
                        {o.cancelledBy?.name ? `بواسطة ${o.cancelledBy.name} — ` : ""}
                        {reasonLabel(o.cancellationReason)}
                      </div>
                    )}
                  </td>
                  <td className="p-2 flex flex-col gap-1">
                    {ADVANCE_LABEL[o.status] && (
                      <button
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                        disabled={statusUpdating === o.id}
                        onClick={() => handleAdvanceStatus(o.id, o.status)}
                      >
                        {statusUpdating === o.id ? "..." : ADVANCE_LABEL[o.status]}
                      </button>
                    )}
                    {o.status === "NEW" && (
                      <button
                        className="text-red-500 hover:underline text-xs"
                        disabled={statusUpdating === o.id}
                        onClick={() => setCancelId(o.id)}
                      >
                        إلغاء
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </button>
          <span className="px-3 py-1">
            {page} / {totalPages}
          </span>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </button>
        </div>
      )}

      <CancelOrderDialog
        isOpen={cancelId !== null}
        onClose={() => (cancelSubmitting ? null : setCancelId(null))}
        onConfirm={handleConfirmCancel}
        submitting={cancelSubmitting}
      />
    </div>
  );
};

export default CallCenterOrdersListPage;
