import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useBranch } from "../../contexts/BranchContext";
import { useReactToPrint } from "react-to-print";
import { deliveryService } from "../../services/deliveryService";
import { salesService } from "../../services/salesService";
import { settingsService } from "../../services/settingsService";
import AuthService from "../../services/authService";
import printThermalReceipt from "../../utils/printThermalReceipt";
import SettlementReceipt from "./components/SettlementReceipt";
import ManagerVerificationModal from "../../components/shared/ManagerVerificationModal";
import { toast } from "react-hot-toast";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayIso = () => new Date().toISOString().split("T")[0];

// ─── driver row in sidebar ───────────────────────────────────────────────────
function DriverRow({ driver, isChecked, isFocused, onToggle, onFocus }) {
  const wallet = Number(driver.walletBalance || 0);
  const cash = Number(driver.pendingCash || 0);
  const dues = Number(driver.dues || 0);
  // walletBalance should net to (cash − dues); a larger gap is legacy drift.
  const drift = Math.abs(wallet - (cash - dues)) > 0.01;

  return (
    <div
      className={`flex items-stretch border-b border-gray-100 dark:border-gray-800 transition-colors ${
        isFocused ? "bg-emerald-50 dark:bg-emerald-900/15" : isChecked ? "bg-blue-50/60 dark:bg-blue-900/15" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
    >
      <label className="flex items-center px-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(driver)}
          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={() => onFocus(driver)}
        className="flex-1 flex items-center gap-3 py-3 pl-4 text-right min-w-0"
      >
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-purple-500/30">
          <span className="material-symbols-outlined text-white text-[20px]">two_wheeler</span>
          {driver.pendingOrders > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[16px] h-[16px] bg-white text-purple-700 dark:bg-gray-900 dark:text-purple-300 text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none border border-purple-500">
              {driver.pendingOrders}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-gray-900 dark:text-gray-50 truncate">{driver.name}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {driver.phone && <span dir="ltr" className="tabular-nums">{driver.phone}</span>}
            {driver.branch?.name && <span>· {driver.branch.name}</span>}
          </div>
        </div>
        <div className="text-left flex-shrink-0 space-y-0.5">
          {cash > 0 && (
            <div>
              <p className="font-black text-sm text-rose-600 dark:text-rose-400 tabular-nums leading-none">{fmt(cash)}</p>
              <p className="text-[9px] text-gray-400 leading-tight">نقدي مستحق</p>
            </div>
          )}
          {dues > 0 && (
            <div>
              <p className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{fmt(dues)}</p>
              <p className="text-[9px] text-emerald-500/80 leading-tight">مستحق للطيار</p>
            </div>
          )}
          {cash <= 0 && dues <= 0 && (
            <p className="font-black text-sm text-gray-400 tabular-nums">{fmt(0)}</p>
          )}
          {drift && (
            <span title={`محفظة ${fmt(wallet)} · نقدية ${fmt(cash)} · مستحق ${fmt(dues)}`} className="inline-block mt-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-1">
              فرق
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

// ─── empty state ─────────────────────────────────────────────────────────────
function EmptyPanel({ icon, title, desc }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span className="material-symbols-outlined text-[32px] text-gray-400">{icon}</span>
      </div>
      <p className="text-sm font-black text-gray-700 dark:text-gray-200">{title}</p>
      {desc && <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{desc}</p>}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────
const DeliverySettlementPage = () => {
  const { activeBranchId } = useBranch();
  const [viewMode, setViewMode] = useState("settlement"); // 'settlement' | 'report'
  const [showDriverList, setShowDriverList] = useState(true); // mobile

  const [drivers, setDrivers] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [focusedDriver, setFocusedDriver] = useState(null);
  const [history, setHistory] = useState({ salesByDate: [], payments: [] });
  const [selectedSales, setSelectedSales] = useState([]);
  const [notes, setNotes] = useState("");

  // InstaPay conversions performed during the current focused-driver session,
  // accumulated so the single combined settlement receipt can list them.
  const [convertedThisSession, setConvertedThisSession] = useState([]);
  const [payDuesNow, setPayDuesNow] = useState(false);
  const [rowBusy, setRowBusy] = useState(null); // saleId currently being acted on

  const [dailyReport, setDailyReport] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settling, setSettling] = useState(false);

  const [showManagerVerification, setShowManagerVerification] = useState(false);
  const [settlementType, setSettlementType] = useState(null);

  const receiptRef = useRef();
  const [printData, setPrintData] = useState(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    onAfterPrint: () => setPrintData(null),
  });

  // ─── fetchers ──────────────────────────────────────────────────────────────
  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      const params = activeBranchId ? { branchId: activeBranchId } : {};
      const data = await deliveryService.getWithDebt(params);
      setDrivers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch indebted drivers", error);
      toast.error("فشل تحميل قائمة الطيارين المديونيين");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  const fetchDailyReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      const data = await deliveryService.getDailyReport(params);
      setDailyReport(data || []);
    } catch (error) {
      console.error("Failed to fetch daily report", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end]);

  const refreshHistory = useCallback(
    async (driverId, range) => {
      if (!driverId) return;
      try {
        setHistoryLoading(true);
        const params = {};
        if (range?.start) params.startDate = range.start;
        if (range?.end) params.endDate = range.end;
        const data = await deliveryService.getHistory(driverId, params);
        setHistory(data || { salesByDate: [], payments: [] });
      } catch (error) {
        console.error("Failed to fetch history", error);
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);
  useEffect(() => {
    if (viewMode === "report") fetchDailyReport();
  }, [viewMode, fetchDailyReport]);

  // ─── filtering ─────────────────────────────────────────────────────────────
  const filteredDrivers = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return drivers;
    return drivers.filter((d) => d.name?.includes(q) || d.phone?.includes(q));
  }, [drivers, searchQuery]);

  const totalSelectedDebt = useMemo(
    () => selectedDrivers.reduce((sum, d) => sum + Number(d.effectiveDebt ?? d.walletBalance ?? 0), 0),
    [selectedDrivers],
  );

  const grandTotalDebt = useMemo(
    () => drivers.reduce((sum, d) => sum + Number(d.effectiveDebt ?? d.walletBalance ?? 0), 0),
    [drivers],
  );

  // Always read the focused driver's live pendingCash/dues from the refreshed
  // list (fetchDrivers runs after each conversion/payout), not the stale
  // snapshot captured at focus time.
  const focusedLive = useMemo(
    () => drivers.find((d) => d.id === focusedDriver?.id) || focusedDriver,
    [drivers, focusedDriver],
  );
  const focusedDues = Number(focusedLive?.dues || 0);

  // ─── selection ─────────────────────────────────────────────────────────────
  const handleFocusDriver = async (driver) => {
    setFocusedDriver(driver);
    setSelectedSales([]);
    setNotes("");
    setConvertedThisSession([]);
    setPayDuesNow(false);
    setShowDriverList(false);
    await refreshHistory(driver.id, dateRange);
  };

  // ─── reprint invoice + convert to InstaPay ───────────────────────────────────
  const handleReprintInvoice = async (order) => {
    try {
      setRowBusy(order.id);
      const sale = await salesService.getById(order.id);
      const cfg = await settingsService.get().catch(() => ({}));
      printThermalReceipt(sale, cfg || {});
    } catch (error) {
      console.error("Reprint failed", error);
      toast.error("تعذّرت إعادة طباعة الفاتورة");
    } finally {
      setRowBusy(null);
    }
  };

  const handleConvertToInstapay = async (order) => {
    const ok = window.confirm(
      `تحويل طلب #${order.saleNumber} إلى دفع أنستاباي؟\n` +
        `سيُسجّل كامل المبلغ في خزينة أنستاباي وتُحتسب حصة الطيار كمستحق له.`,
    );
    if (!ok) return;
    try {
      setRowBusy(order.id);
      const user = AuthService.getCurrentUser();
      const res = await deliveryService.convertSaleToInstapay(order.id, {
        userId: user?.id,
      });
      setConvertedThisSession((prev) => [
        ...prev,
        {
          saleNumber: res?.saleNumber ?? order.saleNumber,
          total: Number(res?.total ?? order.total ?? 0),
          share: Number(res?.share ?? order.deliveryDriverShare ?? 0),
        },
      ]);
      setSelectedSales((prev) => prev.filter((id) => id !== order.id));
      toast.success(`تم تحويل الطلب #${order.saleNumber} إلى أنستاباي`);
      await refreshHistory(focusedDriver.id, dateRange);
      fetchDrivers();
    } catch (error) {
      console.error("Convert to InstaPay failed", error);
      const msg = error?.data?.error || error?.data?.message;
      const code = error?.data?.code;
      toast.error(msg || "فشل تحويل الطلب إلى أنستاباي");
      if (code === "NOT_CONVERTIBLE") {
        await refreshHistory(focusedDriver.id, dateRange);
        fetchDrivers();
      }
    } finally {
      setRowBusy(null);
    }
  };

  const toggleDriverSelection = (driver) => {
    setSelectedDrivers((prev) =>
      prev.find((d) => d.id === driver.id)
        ? prev.filter((d) => d.id !== driver.id)
        : [...prev, driver],
    );
  };

  const toggleSelectAll = () => {
    if (selectedDrivers.length === filteredDrivers.length) setSelectedDrivers([]);
    else setSelectedDrivers([...filteredDrivers]);
  };

  const toggleDaySelection = (day) => {
    const ids = day.orders.filter((o) => o.deliveryStatus === "OUT_FOR_DELIVERY").map((o) => o.id);
    const allSelected = ids.every((id) => selectedSales.includes(id));
    if (allSelected) setSelectedSales((prev) => prev.filter((id) => !ids.includes(id)));
    else setSelectedSales((prev) => [...new Set([...prev, ...ids])]);
  };

  const toggleSaleSelection = (saleId) => {
    setSelectedSales((prev) =>
      prev.includes(saleId) ? prev.filter((id) => id !== saleId) : [...prev, saleId],
    );
  };

  const calculateSelectedTotal = () => {
    let total = 0;
    history.salesByDate.forEach((day) => {
      day.orders.forEach((order) => {
        if (selectedSales.includes(order.id)) total += parseFloat(order.netDebt || 0);
      });
    });
    return total;
  };

  // ─── settle ────────────────────────────────────────────────────────────────
  const handleSettle = async () => {
    if (selectedDrivers.length > 1) {
      setSettlementType("bulk");
      await handleBulkSettle({});
    } else if (
      focusedDriver &&
      (selectedSales.length > 0 ||
        convertedThisSession.length > 0 ||
        (payDuesNow && focusedDues > 0))
    ) {
      setSettlementType("single");
      await handleSingleSettle();
    }
  };

  const handleManagerVerify = async (credentials) => {
    if (settlementType === "bulk") await handleBulkSettle(credentials);
    else if (settlementType === "single") await handleSingleSettle(credentials);
  };

  const handleSingleSettle = async () => {
    const settledIdsSnapshot = [...selectedSales];
    const hasCash = settledIdsSnapshot.length > 0;
    const conversions = [...convertedThisSession];
    const duesOutstanding = focusedDues;
    const willPayDues = payDuesNow && duesOutstanding > 0;

    if (!hasCash && conversions.length === 0 && !willPayDues) return;

    const cashAmount = calculateSelectedTotal();
    try {
      setSettling(true);
      const user = AuthService.getCurrentUser();

      // 1. Settle selected CASH orders into the branch treasury (if any).
      let trustedCashAmount = 0;
      const settledOrders = [];
      if (hasCash) {
        const res = await deliveryService.settleDeliveryMan({
          deliveryManId: focusedDriver.id,
          amount: cashAmount,
          userId: user?.id,
          notes,
          saleIds: settledIdsSnapshot,
        });
        // Server is the source of truth for the actual settled amount.
        trustedCashAmount = Number(res?.amount ?? cashAmount);
        history.salesByDate.forEach((day) => {
          day.orders.forEach((order) => {
            if (settledIdsSnapshot.includes(order.id)) settledOrders.push(order);
          });
        });
      }

      // 2. Pay the rider's online dues from branch cash (if requested).
      let duesPaid = 0;
      if (willPayDues) {
        const dres = await deliveryService.payDues(focusedDriver.id, {
          userId: user?.id,
          notes,
        });
        duesPaid = Number(dres?.amountPaid ?? 0);
      }

      // 3. One combined settlement receipt documenting the whole session.
      setPrintData({
        driverName: focusedDriver.name,
        settlementId: Date.now(),
        date: new Date(),
        user,
        notes,
        treasury: { name: `خزنة فرع ${focusedDriver.branch?.name || "الفرع"}` },
        cashOrders: settledOrders,
        cashTotal: trustedCashAmount,
        instapayOrders: conversions,
        dues: { total: duesOutstanding, paidNow: duesPaid },
      });

      // Clear so nothing can be re-submitted.
      setSelectedSales([]);
      setNotes("");
      setPayDuesNow(false);
      setConvertedThisSession([]);

      setTimeout(() => {
        handlePrint();
        fetchDrivers();
        if (focusedDriver) refreshHistory(focusedDriver.id, dateRange);
      }, 500);

      setShowManagerVerification(false);
      toast.success("تمت التسوية بنجاح");
    } catch (error) {
      console.error("Settlement failed", error);
      const code = error?.data?.code;
      if (code === "NOTHING_TO_SETTLE") {
        toast.error(error.data.error || "هذه الطلبات مسوّاة بالفعل");
        // Resync so the UI reflects reality.
        if (focusedDriver) refreshHistory(focusedDriver.id, dateRange);
        fetchDrivers();
        setSelectedSales([]);
      } else {
        toast.error(error?.data?.message || error?.data?.error || "فشلت عملية التسوية");
      }
    } finally {
      setSettling(false);
    }
  };

  const handleBulkSettle = async (credentials) => {
    try {
      setSettling(true);
      const user = AuthService.getCurrentUser();
      const deliveryMen = selectedDrivers.map((d) => ({
        id: d.id,
        amount: Number(d.effectiveDebt ?? d.walletBalance ?? 0),
        saleIds: [],
      }));
      const result = await deliveryService.settleBulk({
        deliveryMen,
        userId: user?.id,
        notes: notes || "Bulk Settlement",
        ...credentials,
      });
      toast.success(
        `تمت تسوية ${result.driversSettled} طيار بنجاح\nالإجمالي: ${fmt(result.totalAmount)} ج.م`,
      );
      fetchDrivers();
      setSelectedDrivers([]);
      setSelectedSales([]);
      setNotes("");
      setFocusedDriver(null);
      setShowManagerVerification(false);
    } catch (error) {
      console.error("Bulk settlement failed", error);
      toast.error(error.data?.message || "فشلت عملية التسوية الجماعية");
    } finally {
      setSettling(false);
    }
  };

  // Aggregate totals across the displayed history — drives the three summary
  // cards above the day list. Includes only OUT_FOR_DELIVERY (still owed).
  const historyTotals = useMemo(() => {
    let orderValue = 0;
    let driverShare = 0;
    let netToTreasury = 0;
    let orderCount = 0;
    history.salesByDate.forEach((day) => {
      day.orders.forEach((order) => {
        if (order.deliveryStatus !== "OUT_FOR_DELIVERY") return;
        const total = parseFloat(order.total) || 0;
        const share = parseFloat(order.deliveryDriverShare) || 0;
        orderValue += total;
        driverShare += share;
        netToTreasury += total - share;
        orderCount += 1;
      });
    });
    return { orderValue, driverShare, netToTreasury, orderCount };
  }, [history.salesByDate]);

  const settleAmount = selectedDrivers.length > 1 ? totalSelectedDebt : calculateSelectedTotal();
  const canSettle =
    !settling &&
    ((selectedDrivers.length > 1 && totalSelectedDebt > 0) ||
      (focusedDriver &&
        (selectedSales.length > 0 ||
          convertedThisSession.length > 0 ||
          (payDuesNow && focusedDues > 0))));

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`${showDriverList ? "flex" : "hidden"} lg:flex w-full lg:w-[360px] xl:w-[400px] flex-col bg-white dark:bg-gray-900 border-b lg:border-b-0 lg:border-l border-gray-100 dark:border-gray-800`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm shadow-rose-500/30">
              <span className="material-symbols-outlined text-white text-[20px]">account_balance_wallet</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-[15px] text-gray-900 dark:text-gray-50 leading-tight">تسوية الطيارين</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">المديونون فقط — موحّد المصدر</p>
            </div>
            <button
              onClick={fetchDrivers}
              disabled={loading}
              title="تحديث"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>refresh</span>
            </button>
          </div>

          {/* Summary strip */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">طيار مديون</p>
              <p className="font-black text-base text-gray-900 dark:text-gray-50 tabular-nums">{drivers.length}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-l from-rose-50 to-transparent dark:from-rose-900/20 p-2 text-center">
              <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">إجمالي المديونية</p>
              <p className="font-black text-base text-rose-600 dark:text-rose-400 tabular-nums">{fmt(grandTotalDebt)}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
            <input
              type="text"
              placeholder="ابحث بالاسم أو الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pr-10 pl-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Bulk-select strip */}
          {filteredDrivers.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDrivers.length === filteredDrivers.length && filteredDrivers.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">تحديد الكل</span>
              </label>
              {selectedDrivers.length > 0 && (
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-black">
                  {selectedDrivers.length} محدد · {fmt(totalSelectedDebt)} ج.م
                </span>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && drivers.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredDrivers.length === 0 ? (
            <EmptyPanel
              icon={searchQuery ? "search_off" : "verified"}
              title={searchQuery ? "لا توجد نتائج" : "كل الطيارين مسددين"}
              desc={searchQuery ? "جرّب اسماً آخر أو رقم جوال" : "ما من ديون معلقة حالياً"}
            />
          ) : (
            filteredDrivers.map((d) => (
              <DriverRow
                key={d.id}
                driver={d}
                isChecked={!!selectedDrivers.find((x) => x.id === d.id)}
                isFocused={focusedDriver?.id === d.id}
                onToggle={toggleDriverSelection}
                onFocus={handleFocusDriver}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className={`${showDriverList ? "hidden" : "flex"} lg:flex flex-1 flex-col h-full overflow-hidden`}>
        {/* Top bar */}
        <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDriverList(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              title="رجوع للقائمة"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
              <button
                onClick={() => setViewMode("settlement")}
                className={`h-8 px-3 rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 ${
                  viewMode === "settlement" ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">payments</span>
                التسوية
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`h-8 px-3 rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 ${
                  viewMode === "report" ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">summarize</span>
                التقرير اليومي
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:mr-auto items-center">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
              className="h-8 px-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
              max={todayIso()}
            />
            <span className="text-gray-400 text-xs">إلى</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
              className="h-8 px-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
              max={todayIso()}
            />
          </div>
        </div>

        {/* Settlement view */}
        {viewMode === "settlement" && (
          focusedDriver || selectedDrivers.length > 0 ? (
            <>
              {/* Action header */}
              <div className="px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-black text-base text-gray-900 dark:text-gray-50 truncate">
                    {selectedDrivers.length > 1
                      ? `تسوية جماعية — ${selectedDrivers.length} طيار`
                      : focusedDriver?.name || "—"}
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedDrivers.length > 1
                      ? "ستتم تسوية كل المديونيات المعلقة لهؤلاء الطيارين"
                      : "حدّد الطلبات المراد تسويتها، أو حوّل طلباً لأنستاباي"}
                  </p>
                  {selectedDrivers.length <= 1 && focusedLive && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-black rounded-md px-1.5 py-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 tabular-nums">
                        نقدي مستحق: {fmt(focusedLive.pendingCash || 0)}
                      </span>
                      {focusedDues > 0 && (
                        <span className="text-[10px] font-black rounded-md px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 tabular-nums">
                          مستحق للطيار: {fmt(focusedDues)}
                        </span>
                      )}
                      {convertedThisSession.length > 0 && (
                        <span className="text-[10px] font-black rounded-md px-1.5 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
                          حُوِّل لأنستاباي: {convertedThisSession.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">المبلغ المحدد</p>
                    <p className="font-black text-xl text-blue-600 dark:text-blue-400 tabular-nums">
                      {fmt(settleAmount)}
                      <span className="text-[10px] font-normal text-gray-400 mr-1">ج.م</span>
                    </p>
                  </div>
                  <button
                    onClick={handleSettle}
                    disabled={!canSettle}
                    className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-black transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                  >
                    <span className="material-symbols-outlined text-[16px]">{settling ? "sync" : "task_alt"}</span>
                    {settling ? "جاري التسوية..." : "تأكيد التسوية"}
                  </button>
                </div>
              </div>

              {/* Body */}
              {selectedDrivers.length > 1 ? (
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30">
                      <p className="text-xs font-black text-gray-700 dark:text-gray-200">الطيارين المحددين</p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedDrivers.map((d) => (
                        <div key={d.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-purple-500">two_wheeler</span>
                            <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{d.name}</span>
                            {d.pendingOrders > 0 && (
                              <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-1.5 py-0.5">
                                {d.pendingOrders} طلب
                              </span>
                            )}
                          </div>
                          <span className="font-black text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                            {fmt(d.effectiveDebt ?? d.walletBalance)} ج.م
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 bg-gradient-to-l from-rose-50 to-transparent dark:from-rose-900/20 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-black text-rose-700 dark:text-rose-400">الإجمالي</span>
                      <span className="font-black text-lg text-rose-600 dark:text-rose-400 tabular-nums">{fmt(totalSelectedDebt)} ج.م</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : history.salesByDate.length === 0 ? (
                    <EmptyPanel icon="inbox" title="لا يوجد سجل" desc="لم يتم إيجاد طلبات لهذا الطيار في الفترة المحددة" />
                  ) : (
                    <>
                      {/* Totals across the displayed pending history */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">receipt_long</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">قيمة الطلبات</p>
                          </div>
                          <p className="font-black text-xl text-gray-900 dark:text-gray-50 tabular-nums">
                            {fmt(historyTotals.orderValue)}
                            <span className="text-[10px] font-normal text-gray-400 mr-1">ج.م</span>
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{historyTotals.orderCount} طلب معلق</p>
                        </div>

                        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[18px]">two_wheeler</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">حصة الطيار</p>
                          </div>
                          <p className="font-black text-xl text-purple-600 dark:text-purple-400 tabular-nums">
                            {fmt(historyTotals.driverShare)}
                            <span className="text-[10px] font-normal text-gray-400 mr-1">ج.م</span>
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {historyTotals.orderValue > 0
                              ? `${((historyTotals.driverShare / historyTotals.orderValue) * 100).toFixed(1)}% من القيمة`
                              : "لا يوجد عمولة"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-gradient-to-l from-emerald-50 to-transparent dark:from-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-[18px]">savings</span>
                            </div>
                            <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">صافي للخزينة</p>
                          </div>
                          <p className="font-black text-xl text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {fmt(historyTotals.netToTreasury)}
                            <span className="text-[10px] font-normal text-emerald-700/60 dark:text-emerald-400/60 mr-1">ج.م</span>
                          </p>
                          <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">المستحق التحصيل من الطيار</p>
                        </div>
                      </div>

                      {history.salesByDate.map((day) => {
                      const allDaySaleIds = day.orders
                        .filter((o) => o.deliveryStatus === "OUT_FOR_DELIVERY")
                        .map((o) => o.id);
                      const allDaySelected = allDaySaleIds.length > 0 && allDaySaleIds.every((id) => selectedSales.includes(id));
                      return (
                        <div key={day.date} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                checked={allDaySelected}
                                onChange={() => toggleDaySelection(day)}
                                disabled={day.status === "Settled" || allDaySaleIds.length === 0}
                              />
                              <span className="font-black text-sm text-gray-800 dark:text-gray-100">{day.date}</span>
                              <span
                                className={`text-[10px] font-black rounded-full px-2 py-0.5 ${
                                  day.status === "Settled"
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                {day.status === "Settled" ? "مسوّى" : "معلق"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              مديونية اليوم: <span className="font-black text-gray-900 dark:text-gray-50 tabular-nums">{fmt(day.totalNetDebt)} ج.م</span>
                            </p>
                          </div>
                          <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {day.orders.map((order) => {
                              const total = parseFloat(order.total) || 0;
                              const fee = parseFloat(order.deliveryFee) || 0;
                              const share = parseFloat(order.deliveryDriverShare) || 0;
                              const netDebt = total - share;
                              const settled = order.deliveryStatus === "DELIVERED";
                              const isInstapay = order.paymentMethod === "INSTAPAY";
                              const canConvert =
                                !settled && (order.paymentMethod || "CASH") === "CASH";
                              const busy = rowBusy === order.id;
                              return (
                                <div
                                  key={order.id}
                                  onClick={() => !settled && toggleSaleSelection(order.id)}
                                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                    settled ? "opacity-60" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                                  } ${selectedSales.includes(order.id) ? "bg-blue-50/60 dark:bg-blue-900/15" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedSales.includes(order.id)}
                                    onChange={() => {}}
                                    disabled={settled}
                                    className="w-4 h-4 rounded text-blue-600"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-black text-sm text-gray-800 dark:text-gray-100">طلب #{order.saleNumber}</p>
                                      {isInstapay && (
                                        <span className="text-[9px] font-black rounded px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">أنستاباي</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                                      <span>المبلغ {fmt(total)}</span>
                                      <span className="text-emerald-600 dark:text-emerald-400">+{fmt(fee)} رسوم</span>
                                      <span className="text-rose-600 dark:text-rose-400">-{fmt(share)} حصة</span>
                                    </div>
                                  </div>
                                  {/* Per-order actions — don't toggle row selection */}
                                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleReprintInvoice(order)}
                                      disabled={busy}
                                      title="إعادة طباعة الفاتورة"
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">print</span>
                                    </button>
                                    {canConvert && (
                                      <button
                                        type="button"
                                        onClick={() => handleConvertToInstapay(order)}
                                        disabled={busy}
                                        title="تحويل الدفع إلى أنستاباي"
                                        className="h-8 px-2 flex items-center gap-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 disabled:opacity-50"
                                      >
                                        <span className={`material-symbols-outlined text-[16px] ${busy ? "animate-spin" : ""}`}>{busy ? "sync" : "swap_horiz"}</span>
                                        <span className="text-[10px] font-black">أنستاباي</span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-left flex-shrink-0 w-14">
                                    <p className="font-black text-base text-gray-900 dark:text-gray-50 tabular-nums">{fmt(netDebt)}</p>
                                    <p className="text-[10px] text-gray-400">صافي الدين</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    </>
                  )}
                </div>
              )}

              {/* Notes footer */}
              <div className="px-5 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 space-y-3">
                {/* Rider online dues — pay now (from InstaPay conversions) */}
                {selectedDrivers.length <= 1 && focusedDues > 0 && (
                  <label className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2 cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={payDuesNow}
                        onChange={(e) => setPayDuesNow(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">صرف المستحق للطيار الآن</p>
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">حصص أونلاين — تُصرف من خزنة الفرع</p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-emerald-700 dark:text-emerald-300 tabular-nums flex-shrink-0">{fmt(focusedDues)} ج.م</span>
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-[11px] font-black text-gray-700 dark:text-gray-200 mb-1.5">
                  <span className="material-symbols-outlined text-[14px] text-gray-500">edit_note</span>
                  ملاحظات التسوية
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظة اختيارية..."
                  rows={2}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </>
          ) : (
            <EmptyPanel
              icon="two_wheeler"
              title="اختر طياراً لبدء التسوية"
              desc="من القائمة على اليمين، اضغط على طيار لعرض سجل طلباته، أو حدد عدة طيارين للتسوية الجماعية"
            />
          )
        )}

        {/* Daily report view */}
        {viewMode === "report" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : dailyReport.length === 0 ? (
              <EmptyPanel icon="event_busy" title="لا توجد بيانات" desc="جرب تغيير الفترة الزمنية أعلاه" />
            ) : (
              dailyReport.map((day) => (
                <div key={day.date} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-l from-blue-50 to-transparent dark:from-blue-900/20 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="font-black text-base text-gray-900 dark:text-gray-50">{day.date}</h3>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجمالي اليوم</p>
                      <p className="font-black text-xl text-blue-600 dark:text-blue-400 tabular-nums">{fmt(day.totalDebt)} <span className="text-[10px] font-normal text-gray-400">ج.م</span></p>
                      <p className="text-[10px] text-gray-400">{day.totalOrders} طلب</p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {day.drivers.map((driver) => (
                      <div key={driver.id} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-purple-500">two_wheeler</span>
                            <p className="font-black text-sm text-gray-800 dark:text-gray-100">{driver.name}</p>
                          </div>
                          <p className="font-black text-sm text-rose-600 dark:text-rose-400 tabular-nums">{fmt(driver.totalDebt)} ج.م</p>
                        </div>
                        <div className="space-y-1">
                          {driver.orders.map((order) => {
                            const total = order.total || 0;
                            const fee = order.deliveryFee || 0;
                            const share = order.deliveryDriverShare || 0;
                            const netDebt = total - share;
                            return (
                              <div
                                key={order.id}
                                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 rounded-md px-2.5 py-1.5"
                              >
                                <span className="font-mono text-gray-500 dark:text-gray-400">#{order.saleNumber}</span>
                                <div className="flex gap-3 tabular-nums">
                                  <span className="text-gray-600 dark:text-gray-300">{fmt(total)}</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">+{fmt(fee)}</span>
                                  <span className="text-rose-600 dark:text-rose-400">-{fmt(share)}</span>
                                  <span className="font-black text-gray-900 dark:text-gray-50">= {fmt(netDebt)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Hidden receipt */}
      <div style={{ display: "none" }}>
        <SettlementReceipt ref={receiptRef} data={printData} />
      </div>

      {/* Manager verification (kept for safety; cashier-direct flow bypasses it) */}
      <ManagerVerificationModal
        isOpen={showManagerVerification}
        onClose={() => setShowManagerVerification(false)}
        onVerify={handleManagerVerify}
        title="تأكيد التسوية"
        description={
          settlementType === "bulk"
            ? `أنت على وشك تسوية مديونية ${selectedDrivers.length} طيار بإجمالي ${fmt(totalSelectedDebt)} ج.م`
            : `أنت على وشك تسوية مديونية ${focusedDriver?.name} بمبلغ ${fmt(calculateSelectedTotal())} ج.م`
        }
        loading={settling}
        zIndex="z-[70]"
      />
    </div>
  );
};

export default DeliverySettlementPage;
