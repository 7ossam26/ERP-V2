// components/orders/IncomingOrderTray.jsx
// Floating cashier tray inside POS — shows live call-center orders at the
// current branch. Consumes the realtime notifications context for wake-ups,
// fetches the authoritative queue from the backend, and drives the state
// machine (NEW -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../ui/Modal";
import OrderStatusBadge from "./OrderStatusBadge";
import PrintTicket from "./PrintTicket";
import CancelOrderDialog, { reasonLabel } from "./CancelOrderDialog";
import orderService from "../../services/orderService";
import { useRealtimeNotifications } from "../../contexts/RealtimeNotificationsContext";
import eventStream from "../../services/eventStreamService";

const IncomingOrderTray = ({ branchId, deliveryMen = [] }) => {
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [deliveryManId, setDeliveryManId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const { dismissForOrder } = useRealtimeNotifications();

  const refresh = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await orderService.getQueue(branchId);
      setQueue(res.data || []);
    } catch (err) {
      console.warn("[IncomingOrderTray] queue fetch failed", err?.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  // Reload when branch changes.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe directly to the SSE stream so status changes from other cashiers
  // refresh the tray even when they don't bump the notifications list (the
  // ORDER_STATUS_CHANGED rows are filtered out of the bell history).
  useEffect(() => {
    if (!branchId) return;
    const off = eventStream.subscribe((event) => {
      if (event?.payload?.branchId !== branchId) return;
      if (
        event.type === "NEW_CALL_CENTER_ORDER" ||
        event.type === "ORDER_STATUS_CHANGED"
      ) {
        refresh();
      }
    });
    return off;
  }, [branchId, refresh]);

  const newCount = useMemo(
    () => queue.filter((o) => o.status === "NEW").length,
    [queue],
  );

  const openDetail = async (order) => {
    try {
      const full = await orderService.get(order.id);
      setDetail(full);
      setDeliveryManId(full.sale?.deliveryManId ? String(full.sale.deliveryManId) : "");
      setDetailOpen(true);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل تفاصيل الطلب");
    }
  };

  const transition = async (nextStatus, extra = {}) => {
    if (!detail) return;
    try {
      const res = await orderService.setStatus(detail.id, {
        status: nextStatus,
        ...extra,
      });
      toast.success("تم التحديث");
      setDetail((d) => (d ? { ...d, ...res.order } : d));
      if (nextStatus === "PREPARING") {
        await dismissForOrder(detail.id);
      }
      refresh();
      if (nextStatus === "DELIVERED" || nextStatus === "CANCELLED") {
        setDetailOpen(false);
      }
    } catch (err) {
      toast.error(err?.data?.error || err?.message || "تعذر تحديث الحالة");
    }
  };

  const handleStart = () => transition("PREPARING");
  const handleReady = () => transition("READY");
  const handleDispatch = () => {
    if (!deliveryManId) {
      toast.error("اختر طيار للتوصيل");
      return;
    }
    transition("OUT_FOR_DELIVERY", { deliveryManId: parseInt(deliveryManId) });
  };
  const handleDeliver = () => transition("DELIVERED");
  const handleCancelConfirm = async ({ reason, note }) => {
    if (!detail) return;
    setCancelSubmitting(true);
    try {
      await transition("CANCELLED", { reason, note });
      setCancelOpen(false);
    } finally {
      setCancelSubmitting(false);
    }
  };

  if (!branchId) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="الطلبات الواردة"
        className="fixed bottom-4 left-4 z-40 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 shadow-lg flex items-center gap-2 print:hidden"
        dir="rtl">
        <span className="material-symbols-outlined">support_agent</span>
        <span className="hidden md:inline font-bold">الطلبات</span>
        {newCount > 0 && (
          <span className="bg-white text-red-700 rounded-full text-xs font-bold px-2 py-0.5">
            {newCount}
          </span>
        )}
      </button>

      {/* Tray panel */}
      {open && (
        <div
          className="fixed bottom-20 left-4 z-40 w-[360px] max-h-[60vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col print:hidden"
          dir="rtl">
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-bold">الطلبات الواردة</span>
              <span className="text-xs text-gray-500">({queue.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={refresh}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                title="تحديث">
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                title="إغلاق">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">جارٍ التحميل...</div>
            ) : queue.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">لا توجد طلبات</div>
            ) : (
              queue.map((o) => (
                <button
                  key={o.id}
                  onClick={() => openDetail(o)}
                  className="w-full text-right p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 block">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">#{o.sale?.saleNumber}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {o.sale?.client?.name || "-"} — {o.sale?.client?.phoneNumber || "-"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center justify-between">
                    <span>{new Date(o.createdAt).toLocaleTimeString("ar-EG")}</span>
                    <span>{Number(o.sale?.total || 0).toFixed(2)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Detail / action modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail ? `طلب #${detail.sale?.saleNumber || detail.id}` : "طلب"}>
        {detail && (
          <div className="space-y-3" dir="rtl">
            <div className="flex items-center justify-between">
              <OrderStatusBadge status={detail.status} />
              <button
                onClick={() => setPrinting(detail)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                طباعة التذكرة
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">العميل: </span>
                <span>{detail.sale?.client?.name || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">الهاتف: </span>
                <span>{detail.sale?.client?.phoneNumber || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">العنوان: </span>
                <span>{detail.sale?.deliveryAddress || "-"}</span>
              </div>
              {detail.sale?.deliveryZone && (
                <div>
                  <span className="text-gray-500">المنطقة: </span>
                  <span>{detail.sale.deliveryZone.name}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">الفرع: </span>
                <span>{detail.branch?.name || "-"}</span>
              </div>
              {detail.status === "CANCELLED" && (
                <div className="col-span-2 text-red-600">
                  أُلغيت بواسطة {detail.cancelledBy?.name || "-"} —{" "}
                  {reasonLabel(detail.cancellationReason)}
                  {detail.cancellationNote ? ` (${detail.cancellationNote})` : ""}
                </div>
              )}
            </div>
            <div className="border-t pt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-right">الصنف</th>
                    <th className="text-center">الكمية</th>
                    <th className="text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.sale?.items || []).map((it) => (
                    <tr key={it.id}>
                      <td className="text-right">{it.item?.name || it.bom?.name || "-"}</td>
                      <td className="text-center">{Number(it.quantity)}</td>
                      <td className="text-left">{Number(it.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-sm flex justify-between border-t mt-2 pt-1">
                <span>الإجمالي</span>
                <span className="font-bold">{Number(detail.sale?.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Actions gated by current status */}
            <div className="pt-2 border-t flex flex-wrap gap-2 justify-end">
              {detail.status === "NEW" && (
                <>
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                    إلغاء
                  </button>
                  <button
                    onClick={handleStart}
                    className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                    بدء التجهيز
                  </button>
                </>
              )}
              {detail.status === "PREPARING" && (
                <button
                  onClick={handleReady}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                  جاهز للتوصيل
                </button>
              )}
              {detail.status === "READY" && (
                <>
                  <select
                    className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
                    value={deliveryManId}
                    onChange={(e) => setDeliveryManId(e.target.value)}>
                    <option value="">اختر طيار...</option>
                    {deliveryMen.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleDispatch}
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                    إرسال للتوصيل
                  </button>
                </>
              )}
              {detail.status === "OUT_FOR_DELIVERY" && (
                <button
                  onClick={handleDeliver}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                  تم التسليم
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Print portal: renders invisibly and triggers window.print on mount */}
      {printing && (
        <PrintTicket order={printing} onDone={() => setPrinting(null)} />
      )}

      <CancelOrderDialog
        isOpen={cancelOpen}
        onClose={() => (cancelSubmitting ? null : setCancelOpen(false))}
        onConfirm={handleCancelConfirm}
        submitting={cancelSubmitting}
      />
    </>
  );
};

export default IncomingOrderTray;
