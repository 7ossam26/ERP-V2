import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { deliveryService } from "../../services/deliveryService";
import DeliverySettlementModal from "../../pages/delivery/DeliverySettlementModal";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function timeSince(dateStr) {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1) return "الآن";
  if (diff < 60) return `${diff} د`;
  const h = Math.floor(diff / 60);
  return `${h} س`;
}

const PAYMENT_META = {
  CASH:     { label: "نقدي",    icon: "payments",    cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" },
  VISA:     { label: "فيزا",     icon: "credit_card", cls: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
  INSTAPAY: { label: "انستاباي", icon: "qr_code_2",   cls: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
};

function paymentMeta(method) {
  const key = String(method || "").toUpperCase();
  return PAYMENT_META[key] || { label: method || "—", icon: "payments", cls: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300" };
}

// ─── Order row inside a rider card ──────────────────────────────────────────

function OrderRow({ order }) {
  const pm = paymentMeta(order.paymentMethod);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
      {/* Sale # */}
      <div className="flex-shrink-0 w-20">
        <p className="font-mono text-[11px] text-gray-400 truncate">#{order.saleNumber || order.id}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{timeSince(order.createdAt)}</p>
      </div>

      {/* Client */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
          {order.clientName || "عميل نقدي"}
        </p>
        {(order.zoneName || order.deliveryAddress) && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-[12px] text-orange-400">location_on</span>
            <span className="truncate">{[order.zoneName, order.deliveryAddress].filter(Boolean).join(" — ")}</span>
          </p>
        )}
      </div>

      {/* Items */}
      {order.itemsCount > 0 && (
        <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md px-1.5 py-0.5 font-bold flex-shrink-0">
          <span className="material-symbols-outlined text-[12px]">shopping_basket</span>
          {order.itemsCount}
        </span>
      )}

      {/* Payment method pill */}
      <span className={`hidden md:inline-flex items-center gap-0.5 text-[10px] font-black rounded-md px-1.5 py-0.5 flex-shrink-0 ${pm.cls}`}>
        <span className="material-symbols-outlined text-[12px]">{pm.icon}</span>
        {pm.label}
      </span>

      {/* Total */}
      <div className="flex-shrink-0 text-left">
        <p className="font-black text-sm text-gray-900 dark:text-gray-50 tabular-nums">{fmt(order.total)}</p>
        <p className="text-[9px] text-gray-400">ج.م</p>
      </div>
    </div>
  );
}

// ─── Rider card ──────────────────────────────────────────────────────────────

function RiderCard({ rider, onSettle }) {
  const [expanded, setExpanded] = useState(false);
  const cash  = Number(rider.totalCash || 0);
  const total = Number(rider.totalAmount || 0);
  const nonCash = Math.max(0, total - cash);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-stretch">
        {/* Left: rider identity */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 p-4 text-right hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors min-w-0">
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-purple-500/30">
            <span className="material-symbols-outlined text-white text-[22px]">two_wheeler</span>
            <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-white text-purple-700 dark:bg-gray-900 dark:text-purple-300 text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none border-2 border-purple-500">
              {rider.orderCount}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[15px] text-gray-900 dark:text-gray-50 truncate">{rider.name}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              {rider.phone && <span className="tabular-nums" dir="ltr">{rider.phone}</span>}
              {rider.phone && rider.vehicleType && <span className="text-gray-300">·</span>}
              {rider.vehicleType && <span>{rider.vehicleType}</span>}
            </p>
          </div>
          <span className={`material-symbols-outlined text-[20px] text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </button>

        {/* Right: cash to collect */}
        <div className="flex flex-col items-center justify-center px-5 bg-gradient-to-l from-rose-50 to-transparent dark:from-rose-900/20 border-r border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">عهدة نقدية</p>
          <p className="font-black text-2xl text-rose-600 dark:text-rose-400 tabular-nums leading-none mt-1">{fmt(cash)}</p>
          <p className="text-[10px] text-rose-400 mt-0.5">ج.م</p>
        </div>
      </div>

      {/* Quick stats strip */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">عدد الطلبات</p>
          <p className="font-black text-sm text-gray-800 dark:text-gray-100 tabular-nums mt-0.5">{rider.orderCount}</p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">إجمالي الطلبات</p>
          <p className="font-black text-sm text-gray-800 dark:text-gray-100 tabular-nums mt-0.5">{fmt(total)}</p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">غير نقدي</p>
          <p className="font-black text-sm text-blue-700 dark:text-blue-400 tabular-nums mt-0.5">{fmt(nonCash)}</p>
        </div>
      </div>

      {/* Action */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <button
          onClick={() => onSettle(rider)}
          disabled={cash <= 0}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-black transition-colors">
          <span className="material-symbols-outlined text-[16px]">payments</span>
          تسوية {fmt(cash)} ج.م
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[15px]">{expanded ? "visibility_off" : "visibility"}</span>
          {expanded ? "إخفاء" : "عرض الطلبات"}
        </button>
      </div>

      {/* Expanded order list */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60">
          {rider.orders?.length > 0 ? (
            rider.orders.map((o) => <OrderRow key={o.id} order={o} />)
          ) : (
            <p className="text-center text-xs text-gray-400 py-6">لا توجد طلبات تفصيلية</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

const DeliveryDebtsModal = ({ isOpen, onClose, branchId, currentShiftId }) => {
  const [riderDebts, setRiderDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState(null);
  const reqIdRef = useRef(0);

  const fetchRiderDebts = async () => {
    if (!branchId || branchId === "undefined" || !currentShiftId) {
      setRiderDebts([]);
      setHasLoaded(true);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const data = await deliveryService.getStats({ branchId, shiftId: currentShiftId });
      // Drop the response if a newer request has been issued.
      if (reqId !== reqIdRef.current) return;
      setRiderDebts((data || []).filter((r) => r.orderCount > 0));
    } catch (error) {
      if (reqId !== reqIdRef.current) return;
      toast.error(error?.message || "فشل تحميل ديون الطيارين");
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  };

  // Refetch only when the modal opens or its identity (branch/shift) changes.
  useEffect(() => {
    if (!isOpen) {
      setHasLoaded(false);
      reqIdRef.current++;        // invalidate any in-flight response
      return;
    }
    fetchRiderDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, branchId, currentShiftId]);

  const handleOpenSettlement = (rider) => {
    setSelectedRider({ id: rider.id, name: rider.name, walletBalance: rider.totalCash });
    setIsSettlementOpen(true);
  };

  const handleSettleSubmit = async (data) => {
    await deliveryService.settle(data);
    toast.success("تمت التسوية بنجاح");
    setIsSettlementOpen(false);
    fetchRiderDebts();
  };

  const totals = useMemo(() => {
    return riderDebts.reduce(
      (acc, r) => ({
        cash:   acc.cash   + Number(r.totalCash || 0),
        amount: acc.amount + Number(r.totalAmount || 0),
        orders: acc.orders + Number(r.orderCount || 0),
      }),
      { cash: 0, amount: 0, orders: 0 },
    );
  }, [riderDebts]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return riderDebts;
    return riderDebts.filter((r) =>
      r.name?.includes(q) || r.phone?.includes(q),
    );
  }, [riderDebts, search]);

  if (!isOpen) return null;

  const emptyState = !branchId ? {
    icon: "store",
    title: "الحساب غير مرتبط بفرع",
    desc: "لا يمكن عرض ديون الطيارين بدون فرع محدد",
  } : !currentShiftId ? {
    icon: "warning",
    title: "لا توجد وردية نشطة",
    desc: "افتح وردية جديدة لعرض ديون الطيارين",
  } : {
    icon: "verified",
    title: "كل الطيارين مسددين",
    desc: "ما في ديون معلقة في هذه الوردية",
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
        <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm shadow-rose-500/30">
                <span className="material-symbols-outlined text-white text-[22px]">account_balance_wallet</span>
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-gray-50 leading-tight">ديون الطيارين</h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  متابعة وتسوية العهد النقدية للوردية الحالية
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchRiderDebts}
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

          {/* Summary strip */}
          {riderDebts.length > 0 && (
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
              <div className="px-5 py-3 text-center">
                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">طيار نشط</p>
                <p className="font-black text-xl text-gray-900 dark:text-gray-50 tabular-nums mt-0.5">{riderDebts.length}</p>
              </div>
              <div className="px-5 py-3 text-center">
                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">طلب معلق</p>
                <p className="font-black text-xl text-gray-900 dark:text-gray-50 tabular-nums mt-0.5">{totals.orders}</p>
              </div>
              <div className="px-5 py-3 text-center">
                <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">إجمالي العهدة</p>
                <p className="font-black text-xl text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                  {fmt(totals.cash)}
                  <span className="text-[10px] font-normal text-rose-400 mr-1">ج.م</span>
                </p>
              </div>
            </div>
          )}

          {/* Search bar */}
          {riderDebts.length > 0 && (
            <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الجوال..."
                  className="w-full h-9 pr-10 pl-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading && !hasLoaded ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filtered.map((r) => (
                  <RiderCard key={r.id} rider={r} onSettle={handleOpenSettlement} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px] text-gray-400">{emptyState.icon}</span>
                </div>
                <p className="text-sm font-black text-gray-700 dark:text-gray-200">{emptyState.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{emptyState.desc}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSettlementOpen && (
        <DeliverySettlementModal
          deliveryMan={selectedRider}
          onClose={() => setIsSettlementOpen(false)}
          onSettle={handleSettleSubmit}
        />
      )}
    </>,
    document.body,
  );
};

export default DeliveryDebtsModal;
