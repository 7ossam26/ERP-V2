import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  branchService,
  treasuryService,
} from "../../services/domainServices";
import DateFilterBar from "../../components/branches/DateFilterBar";
import { computePresetRange } from "../../utils/dateRange";
import TreasuryHeaderCards from "../../components/branches/TreasuryHeaderCards";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── branch card ─────────────────────────────────────────────────────────────

function BranchCard({ branch, windowLabel }) {
  // Four flow stats (paid sales in window) so the breakdown adds up to the
  // "مبيعات {windowLabel}" header. The branch's current cash balance (stock)
  // is shown separately in the header strip — it doesn't belong in the flow row.
  const visa          = Number(branch.visa || 0);
  const instapay      = Number(branch.instapay || 0);
  const cashSales     = Number(branch.cashSales || 0);
  const bulkSales     = Number(branch.bulkSales || 0);
  const totalExpenses = Number(branch.totalExpenses || 0);
  const cashNow       = Number(branch.currentCashBalance || 0);
  // Window-only total (flow). The header cash card carries the stock.
  const windowTotal = Number(branch.total ?? (cashSales + visa + instapay + bulkSales));

  const salesCount = Number(branch.salesCount || 0);

  return (
    <div className="bg-surface-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-[20px]">storefront</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-base text-text-light dark:text-text-dark truncate">{branch.name}</p>
          <p className="text-xs text-text-light/50 dark:text-text-dark/40">
            {salesCount > 0 ? `${salesCount} فاتورة · ${windowLabel}` : "فرع نشط"}
          </p>
        </div>
        <div className="text-left flex-shrink-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 mb-0.5">
            مبيعات {windowLabel}
          </p>
          <p className="font-black text-lg text-text-light dark:text-text-dark tabular-nums">
            {fmt(windowTotal)}
            <span className="text-xs font-medium text-text-light/50 dark:text-text-dark/40 mr-1">ج.م</span>
          </p>
        </div>
      </div>

      {/* Current cash banner — stock figure, lives outside the flow row so it
          can't be confused with window sales. */}
      <div className="mx-5 mb-3 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-l from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5 border border-emerald-500/30 dark:border-emerald-500/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">payments</span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/70">
              النقدية الحالية
            </p>
            <p className="text-[10px] text-emerald-700/60 dark:text-emerald-400/60">رصيد الخزينة الآن</p>
          </div>
        </div>
        <p className="font-black text-xl text-emerald-700 dark:text-emerald-300 tabular-nums">
          {fmt(cashNow)}
          <span className="text-xs font-medium text-emerald-700/60 dark:text-emerald-400/60 mr-1">ج.م</span>
        </p>
      </div>

      {/* Stats row — captioned with time domain */}
      <div className="grid grid-cols-5 divide-x divide-x-reverse divide-border-light dark:divide-border-dark px-0 py-0 flex-1">
        <div className="flex flex-col items-center gap-0.5 py-4 px-2">
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">نقدي</p>
          </div>
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/60">{windowLabel}</p>
          <p className="font-black text-sm text-emerald-700 dark:text-emerald-300 tabular-nums text-center leading-tight mt-0.5">
            {fmt(cashSales)}
            <span className="text-[10px] font-normal block text-emerald-700/60 dark:text-emerald-400/60">ج.م</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-4 px-2">
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">فيزا</p>
          </div>
          <p className="text-[9px] font-black uppercase tracking-wider text-blue-700/60 dark:text-blue-400/60">{windowLabel}</p>
          <p className="font-black text-sm text-blue-700 dark:text-blue-300 tabular-nums text-center leading-tight mt-0.5">
            {fmt(visa)}
            <span className="text-[10px] font-normal block text-blue-700/60 dark:text-blue-400/60">ج.م</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-4 px-2">
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400">انستاباي</p>
          </div>
          <p className="text-[9px] font-black uppercase tracking-wider text-purple-700/60 dark:text-purple-400/60">{windowLabel}</p>
          <p className="font-black text-sm text-purple-700 dark:text-purple-300 tabular-nums text-center leading-tight mt-0.5">
            {fmt(instapay)}
            <span className="text-[10px] font-normal block text-purple-700/60 dark:text-purple-400/60">ج.م</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-4 px-2">
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">جملة</p>
          </div>
          {/* Wholesale is counted when the customer pays (BulkPayment.receivedAt),
              not when the order is raised — captioned so it can't be read as
              order value. */}
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-700/60 dark:text-amber-400/60">محصّل · {windowLabel}</p>
          <p className="font-black text-sm text-amber-700 dark:text-amber-300 tabular-nums text-center leading-tight mt-0.5">
            {fmt(bulkSales)}
            <span className="text-[10px] font-normal block text-amber-700/60 dark:text-amber-400/60">ج.م</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-4 px-2">
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">مصروفات</p>
          </div>
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-700/60 dark:text-rose-400/60">{windowLabel}</p>
          <p className="font-black text-sm text-rose-700 dark:text-rose-300 tabular-nums text-center leading-tight mt-0.5">
            {fmt(totalExpenses)}
            <span className="text-[10px] font-normal block text-rose-700/60 dark:text-rose-400/60">ج.م</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── totals summary card ──────────────────────────────────────────────────────

function TotalsCard({ totals, count, windowLabel }) {
  return (
    <div className="bg-gradient-to-l from-primary/5 to-transparent dark:from-primary/10 rounded-2xl border border-primary/20 dark:border-primary/30 p-5 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[22px]">summarize</span>
        <div>
          <p className="text-[11px] font-black text-text-light/60 dark:text-text-dark/50 uppercase tracking-wider">
            إجمالي {count} فرع · {totals.salesCount} فاتورة · مبيعات {windowLabel}
          </p>
          <p className="font-black text-xl text-text-light dark:text-text-dark tabular-nums">
            {fmt(totals.windowTotal)}
            <span className="text-xs font-normal text-text-light/50 dark:text-text-dark/40 mr-1">ج.م</span>
          </p>
        </div>
      </div>
      <div className="flex gap-6 flex-wrap">
        <Stat label="نقدي" caption={windowLabel} value={fmt(totals.cashSales)} color="text-emerald-700 dark:text-emerald-400" />
        <Stat label="فيزا" caption={windowLabel} value={fmt(totals.visa)} color="text-blue-700 dark:text-blue-400" />
        <Stat label="انستاباي" caption={windowLabel} value={fmt(totals.instapay)} color="text-purple-700 dark:text-purple-400" />
        <Stat label="جملة" caption={`محصّل · ${windowLabel}`} value={fmt(totals.bulkSales)} color="text-amber-700 dark:text-amber-400" />
        <Stat label="مصروفات" caption={windowLabel} value={fmt(totals.totalExpenses)} color="text-rose-700 dark:text-rose-400" />
      </div>
    </div>
  );
}

function Stat({ label, caption, value, color }) {
  return (
    <div>
      <p className={`text-[11px] font-bold ${color} mb-0.5`}>
        {label}
        {caption && (
          <span className="text-[9px] font-black uppercase tracking-wider opacity-60 mr-1.5">· {caption}</span>
        )}
      </p>
      <p className={`font-black text-sm tabular-nums ${color}`}>
        {value}
        <span className="text-[10px] font-normal opacity-60 mr-1">ج.م</span>
      </p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const BranchesSalesPage = () => {
  const initialRange = computePresetRange("today");
  const [filter, setFilter] = useState({ preset: "today", ...initialRange });

  const [branches, setBranches]               = useState([]);
  const [mainTreasury, setMainTreasury]       = useState(null);
  const [branchesTotalBalance, setBranchesTotalBalance] = useState(0);
  const [loadingRows, setLoadingRows]         = useState(true);
  const [loadingHeader, setLoadingHeader]     = useState(true);

  const fetchHeader = useCallback(async () => {
    setLoadingHeader(true);
    try {
      const [globals, summary] = await Promise.all([
        treasuryService.getGlobalBalances(),
        branchService.getSummary(),
      ]);
      // We only need the main (HQ) treasury for the context strip now —
      // visa/instapay running balances were replaced by windowed sales totals.
      setMainTreasury(globals?.mainTreasury || null);
      setBranchesTotalBalance(Number(summary.totalBalance || 0));
    } catch {
      toast.error("فشل تحميل أرصدة الخزائن العامة");
    } finally {
      setLoadingHeader(false);
    }
  }, []);

  // Monotonic request id: rapid preset clicks can make responses land out of
  // order, so only the latest request is allowed to write state.
  const fetchSeq = useRef(0);

  const fetchRows = useCallback(async (from, to) => {
    const seq = ++fetchSeq.current;
    setLoadingRows(true);
    try {
      const rows = await branchService.getBalances({ from, to });
      if (seq !== fetchSeq.current) return; // a newer request superseded us
      setBranches(rows || []);
    } catch {
      if (seq !== fetchSeq.current) return;
      toast.error("فشل تحميل مبيعات الفروع");
    } finally {
      if (seq === fetchSeq.current) setLoadingRows(false);
    }
  }, []);

  // Page is intentionally chain-wide ("نظرة عامة... جميع الفروع") — drop the
  // activeBranchId dep that was forcing redundant refetches without affecting
  // the result.
  useEffect(() => { fetchHeader(); }, [fetchHeader]);
  useEffect(() => { fetchRows(filter.from, filter.to); }, [fetchRows, filter.from, filter.to]);

  const refreshAll = () => {
    fetchHeader();
    fetchRows(filter.from, filter.to);
  };

  // Mixed-domain aggregate. cashNow is stock (treasury balance, ignores
  // window). visa/instapay/cashSales are flow (paid sales in window).
  const totals = branches.reduce(
    (acc, b) => ({
      cashNow:       acc.cashNow       + Number(b.currentCashBalance || 0),
      cashSales:     acc.cashSales     + Number(b.cashSales || 0),
      visa:          acc.visa          + Number(b.visa || 0),
      instapay:      acc.instapay      + Number(b.instapay || 0),
      bulkSales:     acc.bulkSales     + Number(b.bulkSales || 0),
      totalExpenses: acc.totalExpenses + Number(b.totalExpenses || 0),
      windowTotal:   acc.windowTotal   + Number(b.total || 0),
      prevTotal:     acc.prevTotal     + Number(b.prevTotal || 0),
      salesCount:    acc.salesCount    + Number(b.salesCount || 0),
    }),
    { cashNow: 0, cashSales: 0, visa: 0, instapay: 0, bulkSales: 0, totalExpenses: 0, windowTotal: 0, prevTotal: 0, salesCount: 0 },
  );

  // Trend follows the selected window: current total vs the equal-length
  // window right before it (computed by the backend per branch).
  const trendPct = totals.prevTotal > 0
    ? ((totals.windowTotal - totals.prevTotal) / totals.prevTotal) * 100
    : totals.windowTotal > 0
      ? 100
      : 0;
  const trendIsPositive = trendPct >= 0;

  // Sales page: rank branches by what they sold in the window, best first.
  const rankedBranches = [...branches].sort(
    (a, b) => Number(b.total || 0) - Number(a.total || 0),
  );

  // Short label that captions every "للفترة" slot. /summary's totalBalance is
  // already a stock figure unaffected by filter so we don't wire it here.
  const windowLabel = (() => {
    switch (filter.preset) {
      case "today":     return "اليوم";
      case "yesterday": return "أمس";
      case "last7":     return "آخر 7 أيام";
      default:          return "الفترة المحددة";
    }
  })();

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[1280px] mx-auto flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">
                مبيعات الفروع
              </h1>
              <p className="text-primary/80 dark:text-accent/80 text-sm md:text-base">
                المُحصَّل فعليًا في الخزينة لكل فرع حسب الفترة المحددة
              </p>
              {/* This page and التقرير العام differ on purpose: delivery cash
                  still on the road isn't collected yet, and wholesale counts
                  when the customer pays, not when the order is raised. */}
              <p className="text-xs text-text-light/50 dark:text-text-dark/40">
                لا يشمل نقدية الطلبات التي لم تُسلَّم بعد. للمبيعات بالفوترة
                راجع التقرير العام.
              </p>
            </div>
            <button
              onClick={refreshAll}
              disabled={loadingRows || loadingHeader}
              className="flex items-center gap-2 h-10 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${loadingRows || loadingHeader ? "animate-spin" : ""}`}>
                sync
              </span>
              تحديث البيانات
            </button>
          </div>

          {/* HQ context strip + 3-up scoreboard.
              branchesTotalBalance is the chain-wide stock from /summary;
              cashNow from rows.reduce should match it but we trust /summary
              when both are present (single source of truth). */}
          <TreasuryHeaderCards
            mainTreasury={mainTreasury}
            branchesCashTotal={branchesTotalBalance || totals.cashNow}
            windowVisaSales={totals.visa}
            windowInstapaySales={totals.instapay}
            windowLabel={windowLabel}
            percentageChange={Math.abs(trendPct).toFixed(1)}
            isPositive={trendIsPositive}
            trendCaption={`${windowLabel} vs الفترة السابقة`}
            loading={loadingHeader || loadingRows}
          />

          {/* Date filter */}
          <DateFilterBar value={filter} onChange={setFilter} />

          {/* Branch cards section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">store</span>
              <h3 className="text-lg font-black">تفصيل الفروع</h3>
              <div className="h-px flex-1 bg-border-light dark:bg-border-dark" />
              <span className="text-xs font-bold text-primary/70 dark:text-accent bg-primary/10 dark:bg-primary/15 px-3 py-1 rounded-full">
                {branches.length} فرع
              </span>
            </div>

            {loadingRows ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-surface-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-5xl mb-3 block">business</span>
                لا توجد فروع متاحة
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rankedBranches.map((b) => (
                    <BranchCard key={b.id} branch={b} windowLabel={windowLabel} />
                  ))}
                </div>

                {branches.length > 1 && (
                  <TotalsCard totals={totals} count={branches.length} windowLabel={windowLabel} />
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default BranchesSalesPage;
