import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import orderService from "../../services/orderService";
import eventStream from "../../services/eventStreamService";
import printDeliveryTicket from "../../utils/printDeliveryTicket";

// ─── Stages ──────────────────────────────────────────────────────────────────
// Only three active stages live in the prep room: new → preparing → ready.
// Dispatched (OUT_FOR_DELIVERY) orders belong to the rider screen — they leave
// this modal the moment the cashier prints the ticket.
const STAGES = [
  {
    key: "NEW",
    label: "جديد",
    icon: "fiber_new",
    dot: "bg-rose-500",
    tabActive: "bg-rose-600 text-white border-rose-600 shadow-rose-500/20 shadow-lg",
    tabIdle:   "text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-900/10",
    strip: "bg-gradient-to-l from-rose-500 to-rose-400",
    empty: "ما في طلبات جديدة",
  },
  {
    key: "PREPARING",
    label: "تجهيز",
    icon: "soup_kitchen",
    dot: "bg-amber-500",
    tabActive: "bg-amber-500 text-white border-amber-500 shadow-amber-500/20 shadow-lg",
    tabIdle:   "text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-900/10",
    strip: "bg-gradient-to-l from-amber-500 to-amber-400",
    empty: "ما في طلبات في التجهيز",
  },
  {
    key: "READY",
    label: "جاهز",
    icon: "check_circle",
    dot: "bg-emerald-500",
    tabActive: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20 shadow-lg",
    tabIdle:   "text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/10",
    strip: "bg-gradient-to-l from-emerald-500 to-emerald-400",
    empty: "ما في طلبات جاهزة للإرسال",
  },
];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s]));

const ACTION = {
  NEW:       { label: "بدء التجهيز",  next: "PREPARING", icon: "play_arrow",      cls: "bg-amber-500 hover:bg-amber-600" },
  PREPARING: { label: "جاهز للتوصيل", next: "READY",     icon: "restaurant_menu", cls: "bg-emerald-600 hover:bg-emerald-700" },
  READY:     { label: "إرسال الطلب",  next: "OUT_FOR_DELIVERY", icon: "local_shipping", cls: "bg-purple-600 hover:bg-purple-700", needsRider: true },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function timeSince(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1)  return "الآن";
  if (diff < 60) return `${diff} د`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m ? `${h} س ${m} د` : `${h} س`;
}

function ageTier(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins >= 30) return "text-rose-600 dark:text-rose-400 font-black";
  if (mins >= 15) return "text-amber-600 dark:text-amber-400 font-bold";
  return "text-gray-400 dark:text-gray-500";
}

// ─── Order card ──────────────────────────────────────────────────────────────

function OrderCard({ order, deliveryMen, onTransition, onPrint, onView, busy }) {
  const [riderId, setRiderId] = useState("");
  const action = ACTION[order.status];
  const stage  = STAGE_MAP[order.status];
  if (!action || !stage) return null;

  const handleAction = () => {
    if (action.needsRider && !riderId) {
      toast.error("اختر طيار للإرسال");
      return;
    }
    onTransition(order.id, action.next, action.needsRider ? parseInt(riderId) : undefined, riderId ? deliveryMen.find((d) => d.id === parseInt(riderId)) : null);
  };

  const itemsCount = order.sale?.items?.length || 0;
  const addrText   = [order.sale?.deliveryZone?.name, order.sale?.deliveryAddress].filter(Boolean).join(" — ");

  return (
    <div className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-700 transition-all">
      {/* Stage strip */}
      <div className={`h-1 w-full ${stage.strip}`} />

      <div className="p-4 flex flex-col gap-3">
        {/* Row 1: number + age · total */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md px-1.5 py-0.5">
                #{order.sale?.saleNumber || order.id}
              </span>
              <span className={`text-[11px] tabular-nums ${ageTier(order.createdAt)}`}>
                <span className="material-symbols-outlined text-[11px] align-middle -mt-0.5">schedule</span>
                <span className="align-middle mr-0.5">{timeSince(order.createdAt)}</span>
              </span>
            </div>
            <p className="font-black text-[15px] text-gray-900 dark:text-gray-50 truncate mt-1.5">
              {order.sale?.client?.name || "عميل نقدي"}
            </p>
            {order.sale?.client?.phoneNumber && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums" dir="ltr">
                {order.sale.client.phoneNumber}
              </p>
            )}
          </div>
          <div className="text-left flex-shrink-0">
            <p className="font-black text-lg text-gray-900 dark:text-gray-50 tabular-nums leading-none">
              {fmt(order.sale?.total)}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">ج.م</p>
          </div>
        </div>

        {/* Row 2: address */}
        {addrText && (
          <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-orange-50/70 dark:bg-orange-900/10 rounded-lg px-2.5 py-1.5">
            <span className="material-symbols-outlined text-[15px] text-orange-500 mt-0.5 flex-shrink-0">location_on</span>
            <span className="line-clamp-2 leading-snug">{addrText}</span>
          </div>
        )}

        {/* Row 3: items summary badge */}
        {itemsCount > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5 font-bold">
              <span className="material-symbols-outlined text-[13px]">shopping_basket</span>
              {itemsCount} {itemsCount === 1 ? "صنف" : "أصناف"}
            </span>
            <button
              onClick={() => onView(order)}
              className="inline-flex items-center gap-0.5 text-primary hover:underline font-bold">
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              عرض التفاصيل
            </button>
          </div>
        )}

        {/* Row 4: rider select (only in READY stage) */}
        {action.needsRider && (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-purple-500">two_wheeler</span>
            <select
              value={riderId}
              onChange={(e) => setRiderId(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500">
              <option value="">— اختر طيار —</option>
              {deliveryMen.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleAction}
            disabled={busy}
            className={`flex-1 h-9 rounded-lg text-sm font-black text-white transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 ${action.cls}`}>
            {busy ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">{action.icon}</span>
                {action.label}
              </>
            )}
          </button>
          <button
            onClick={() => onPrint(order)}
            disabled={busy}
            title="طباعة تذكرة"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">print</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer (slide-up panel) ──────────────────────────────────────────

function DetailDrawer({ order, onClose, onPrint }) {
  if (!order) return null;
  const sale = order.sale || {};
  const items = sale.items || [];
  const subtotal = Number(sale.subtotal ?? sale.total ?? 0);
  const fee = Number(sale.deliveryFee || 0);
  const discount = Number(sale.discountAmount || 0);
  const total = Number(sale.total || subtotal + fee - discount);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-gray-900" dir="rtl">
      {/* Detail header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
          <div className="min-w-0">
            <p className="font-black text-gray-900 dark:text-gray-50 text-sm">تفاصيل الطلب</p>
            <p className="text-[11px] font-mono text-gray-400">#{sale.saleNumber || order.id}</p>
          </div>
        </div>
        <button
          onClick={() => onPrint(order)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-white text-xs font-black hover:bg-primary-hover transition-colors">
          <span className="material-symbols-outlined text-[15px]">print</span>
          طباعة
        </button>
      </div>

      {/* Detail body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Client card */}
        <section className="rounded-xl bg-gradient-to-l from-primary/5 to-transparent dark:from-primary/10 border border-primary/15 dark:border-primary/25 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] text-primary">person</span>
            <p className="text-xs font-black text-gray-700 dark:text-gray-200">العميل</p>
          </div>
          <p className="font-black text-[15px] text-gray-900 dark:text-gray-50">{sale.client?.name || "عميل نقدي"}</p>
          {sale.client?.phoneNumber && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 tabular-nums" dir="ltr">{sale.client.phoneNumber}</p>
          )}
          {(sale.deliveryZone?.name || sale.deliveryAddress) && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300 mt-2">
              <span className="material-symbols-outlined text-[15px] text-orange-500 mt-0.5">location_on</span>
              <span>
                {sale.deliveryZone?.name}
                {sale.deliveryAddress && ` — ${sale.deliveryAddress}`}
              </span>
            </div>
          )}
        </section>

        {/* Items list */}
        <section>
          <p className="text-xs font-black text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">shopping_basket</span>
            الأصناف ({items.length})
          </p>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {items.length === 0 ? (
              <p className="p-4 text-xs text-center text-gray-400">لا توجد أصناف</p>
            ) : items.map((si, i) => {
              const name = si.item?.name || si.bom?.name || si.name || `بند ${i + 1}`;
              const qty = Number(si.quantity || 0);
              const unit = Number(si.unitPrice || 0);
              const line = Number(si.totalPrice ?? si.total ?? unit * qty);
              return (
                <div key={si.id || i} className="flex items-center justify-between px-3 py-2.5 text-sm bg-white dark:bg-gray-900">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{name}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">{qty} × {fmt(unit)}</p>
                  </div>
                  <p className="font-black text-gray-900 dark:text-gray-50 tabular-nums">{fmt(line)}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Totals */}
        <section className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>الإجمالي الفرعي</span>
            <span className="tabular-nums font-bold">{fmt(subtotal)}</span>
          </div>
          {fee > 0 && (
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>رسوم التوصيل</span>
              <span className="tabular-nums font-bold">{fmt(fee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-red-600 dark:text-red-400">
              <span>خصم</span>
              <span className="tabular-nums font-bold">-{fmt(discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-1 border-t border-gray-200 dark:border-gray-700 text-base font-black text-gray-900 dark:text-gray-50">
            <span>الإجمالي المستحق</span>
            <span className="tabular-nums">{fmt(total)} ج.م</span>
          </div>
          {sale.paymentMethod && (
            <div className="flex justify-between pt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>طريقة الدفع</span>
              <span className="font-bold">{sale.paymentMethod === "CASH" ? "نقدي" : sale.paymentMethod}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

const PreparationQueueModal = ({ isOpen, onClose, deliveryMen = [], branchId }) => {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [busyId, setBusyId]       = useState(null);
  const [activeTab, setActiveTab] = useState("NEW");
  const [detailOrder, setDetailOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const res = await orderService.getQueue(branchId);
      setOrders(res.data || []);
    } catch (err) {
      toast.error(err?.message || "فشل تحميل قائمة الطلبات");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (isOpen) fetchOrders();
  }, [isOpen, fetchOrders]);

  // Live SSE refresh
  useEffect(() => {
    if (!isOpen || !branchId) return;
    const off = eventStream.subscribe((event) => {
      if (
        event?.payload?.branchId !== branchId &&
        event?.payload?.branchId !== Number(branchId)
      ) return;
      if (event.type === "NEW_CALL_CENTER_ORDER" || event.type === "ORDER_STATUS_CHANGED") {
        fetchOrders();
      }
    });
    return off;
  }, [isOpen, branchId, fetchOrders]);

  const loadFullOrder = useCallback(async (orderOrId) => {
    const id = typeof orderOrId === "object" ? orderOrId.id : orderOrId;
    try {
      return await orderService.get(id);
    } catch {
      return null;
    }
  }, []);

  const handleView = useCallback(async (order) => {
    const full = await loadFullOrder(order);
    setDetailOrder(full || order);
  }, [loadFullOrder]);

  const handlePrint = useCallback(async (order) => {
    const full = await loadFullOrder(order);
    printDeliveryTicket(full || order);
  }, [loadFullOrder]);

  const handleTransition = async (orderId, nextStatus, deliveryManId, rider) => {
    setBusyId(orderId);
    try {
      await orderService.setStatus(orderId, { status: nextStatus, deliveryManId });
      toast.success("تم التحديث");

      // Auto-print dispatch ticket when an order is released to a rider.
      if (nextStatus === "OUT_FOR_DELIVERY") {
        const full = await loadFullOrder(orderId);
        // Inject rider name if backend hasn't refreshed yet.
        if (full && rider && !full.sale?.deliveryMan) {
          full.sale = { ...full.sale, deliveryMan: { id: rider.id, name: rider.name } };
        }
        if (full) printDeliveryTicket(full);
      }

      if (nextStatus === "OUT_FOR_DELIVERY" || nextStatus === "DELIVERED" || nextStatus === "CANCELLED") {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
      }
    } catch (err) {
      toast.error(err?.data?.error || err?.message || "تعذر تحديث الحالة");
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = {};
    for (const s of STAGES) c[s.key] = orders.filter((o) => o.status === s.key).length;
    return c;
  }, [orders]);

  const visibleOrders = useMemo(
    () => orders.filter((o) => o.status === activeTab),
    [orders, activeTab],
  );

  if (!isOpen) return null;
  const activeStage = STAGE_MAP[activeTab];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="relative bg-gray-50 dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">kitchen</span>
              {orders.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
                  {orders.length}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-black text-gray-900 dark:text-gray-50 text-[15px] leading-tight">قسم التجهيز</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {orders.length === 0 ? "لا توجد طلبات نشطة" : `${orders.length} طلب نشط · تحديث مباشر`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchOrders}
              disabled={loading}
              title="تحديث"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
              <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>refresh</span>
            </button>
            <button
              onClick={onClose}
              title="إغلاق"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Stage tabs */}
        <div className="flex gap-2 px-4 pt-4 pb-3 overflow-x-auto bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          {STAGES.map((s) => {
            const isActive = activeTab === s.key;
            const n = counts[s.key];
            return (
              <button
                key={s.key}
                onClick={() => setActiveTab(s.key)}
                className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl border-2 text-xs font-black whitespace-nowrap transition-all ${
                  isActive ? s.tabActive : `bg-white dark:bg-gray-900 ${s.tabIdle}`
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : s.dot}`} />
                <span className="material-symbols-outlined text-[15px]">{s.icon}</span>
                {s.label}
                <span className={`text-[10px] font-black tabular-nums rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                  isActive ? "bg-white/25 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                }`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300 dark:text-gray-700">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-gray-400">{activeStage.icon}</span>
              </div>
              <p className="text-sm font-black text-gray-500 dark:text-gray-400">{activeStage.empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  deliveryMen={deliveryMen}
                  onTransition={handleTransition}
                  onPrint={handlePrint}
                  onView={handleView}
                  busy={busyId === o.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail drawer */}
        {detailOrder && (
          <DetailDrawer
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
            onPrint={(o) => printDeliveryTicket(o)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default PreparationQueueModal;
