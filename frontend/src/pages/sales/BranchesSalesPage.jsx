import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  branchService,
  treasuryService,
} from "../../services/domainServices";
import { useBranch } from "../../contexts/BranchContext";
import DateFilterBar, {
  computePresetRange,
} from "../../components/branches/DateFilterBar";
import TreasuryHeaderCards from "../../components/branches/TreasuryHeaderCards";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── branch card ─────────────────────────────────────────────────────────────

function BranchCard({ branch }) {
  const visa     = Number(branch.visa ?? branch.visaToday ?? 0);
  const instapay = Number(branch.instapay ?? branch.instapayToday ?? 0);
  const cash     = Number(branch.cashBalance || 0);
  const total    = Number(branch.total ?? cash + visa + instapay);

  return (
    <div className="bg-surface-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-[20px]">storefront</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-base text-text-light dark:text-text-dark truncate">{branch.name}</p>
          <p className="text-xs text-text-light/50 dark:text-text-dark/40">فرع نشط</p>
        </div>
        <div className="text-left flex-shrink-0">
          <p className="text-xs text-text-light/50 dark:text-text-dark/40 mb-0.5">الإجمالي</p>
          <p className="font-black text-lg text-text-light dark:text-text-dark tabular-nums">
            {fmt(total)}
            <span className="text-xs font-medium text-text-light/50 dark:text-text-dark/40 mr-1">ج.م</span>
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border-light dark:bg-border-dark mx-5" />

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border-light dark:divide-border-dark px-0 py-0 flex-1">
        <div className="flex flex-col items-center gap-1 py-4 px-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mb-0.5" />
          <p className="text-[11px] font-bold text-green-700 dark:text-green-400">نقدي</p>
          <p className="font-black text-sm text-green-700 dark:text-green-300 tabular-nums text-center leading-tight">
            {fmt(cash)}
            <span className="text-[10px] font-normal block text-green-700/60 dark:text-green-400/60">ج.م</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 py-4 px-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 mb-0.5" />
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">فيزا</p>
          <p className="font-black text-sm text-blue-700 dark:text-blue-300 tabular-nums text-center leading-tight">
            {fmt(visa)}
            <span className="text-[10px] font-normal block text-blue-700/60 dark:text-blue-400/60">ج.م</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 py-4 px-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 mb-0.5" />
          <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400">انستاباي</p>
          <p className="font-black text-sm text-purple-700 dark:text-purple-300 tabular-nums text-center leading-tight">
            {fmt(instapay)}
            <span className="text-[10px] font-normal block text-purple-700/60 dark:text-purple-400/60">ج.م</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── totals summary card ──────────────────────────────────────────────────────

function TotalsCard({ totals, count }) {
  return (
    <div className="bg-gradient-to-l from-primary/5 to-transparent dark:from-primary/10 rounded-2xl border border-primary/20 dark:border-primary/30 p-5 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[22px]">summarize</span>
        <div>
          <p className="text-xs font-bold text-text-light/60 dark:text-text-dark/50">إجمالي {count} فرع</p>
          <p className="font-black text-xl text-text-light dark:text-text-dark tabular-nums">
            {fmt(totals.total)}
            <span className="text-xs font-normal text-text-light/50 dark:text-text-dark/40 mr-1">ج.م</span>
          </p>
        </div>
      </div>
      <div className="flex gap-6 flex-wrap">
        <Stat label="نقدي" value={fmt(totals.cash)} color="text-green-700 dark:text-green-400" />
        <Stat label="فيزا" value={fmt(totals.visa)} color="text-blue-700 dark:text-blue-400" />
        <Stat label="انستاباي" value={fmt(totals.instapay)} color="text-purple-700 dark:text-purple-400" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className={`text-[11px] font-bold ${color} mb-0.5`}>{label}</p>
      <p className={`font-black text-sm tabular-nums ${color}`}>
        {value}
        <span className="text-[10px] font-normal opacity-60 mr-1">ج.م</span>
      </p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const BranchesSalesPage = () => {
  const { activeBranchId } = useBranch();

  const initialRange = computePresetRange("today");
  const [filter, setFilter] = useState({ preset: "today", ...initialRange });

  const [branches, setBranches]               = useState([]);
  const [mainTreasury, setMainTreasury]       = useState(null);
  const [visaTreasury, setVisaTreasury]       = useState(null);
  const [instapayTreasury, setInstapayTreasury] = useState(null);
  const [branchesTotalBalance, setBranchesTotalBalance] = useState(0);
  const [percentageChange, setPercentageChange] = useState(0);
  const [isPositive, setIsPositive]           = useState(true);
  const [loadingRows, setLoadingRows]         = useState(true);
  const [loadingHeader, setLoadingHeader]     = useState(true);

  const fetchHeader = useCallback(async () => {
    setLoadingHeader(true);
    try {
      const [globals, summary] = await Promise.all([
        treasuryService.getGlobalBalances(),
        branchService.getSummary(),
      ]);
      setMainTreasury(globals?.mainTreasury || null);
      setVisaTreasury(globals?.visaTreasury || null);
      setInstapayTreasury(globals?.instapayTreasury || null);
      const pct = parseFloat(summary.percentageChange);
      setPercentageChange(Math.abs(pct || 0));
      setIsPositive((pct || 0) >= 0);
      setBranchesTotalBalance(Number(summary.totalBalance || 0));
    } catch {
      toast.error("فشل تحميل أرصدة الخزائن العامة");
    } finally {
      setLoadingHeader(false);
    }
  }, []);

  const fetchRows = useCallback(async (from, to) => {
    setLoadingRows(true);
    try {
      const rows = await branchService.getBalances({ from, to });
      setBranches(rows || []);
    } catch {
      toast.error("فشل تحميل أرصدة الفروع");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => { fetchHeader(); }, [fetchHeader, activeBranchId]);
  useEffect(() => { fetchRows(filter.from, filter.to); }, [fetchRows, filter.from, filter.to, activeBranchId]);

  const refreshAll = () => {
    fetchHeader();
    fetchRows(filter.from, filter.to);
  };

  const totals = branches.reduce(
    (acc, b) => ({
      cash:     acc.cash     + Number(b.cashBalance || 0),
      visa:     acc.visa     + Number(b.visa ?? b.visaToday ?? 0),
      instapay: acc.instapay + Number(b.instapay ?? b.instapayToday ?? 0),
      total:    acc.total    + Number(b.total || 0),
    }),
    { cash: 0, visa: 0, instapay: 0, total: 0 },
  );

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[1280px] mx-auto flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">
                أرصدة الفروع والخزائن
              </h1>
              <p className="text-primary/80 dark:text-accent/80 text-sm md:text-base">
                نظرة عامة على النقدية والمدفوعات الرقمية في جميع الفروع
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

          {/* Treasury header cards */}
          <TreasuryHeaderCards
            mainTreasury={mainTreasury}
            visaTreasury={visaTreasury}
            instapayTreasury={instapayTreasury}
            branchesTotalBalance={branchesTotalBalance}
            percentageChange={percentageChange}
            isPositive={isPositive}
          />

          {/* Date filter */}
          <DateFilterBar value={filter} onChange={setFilter} />

          {/* Branch cards section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">store</span>
              <h3 className="text-lg font-black">تفصيل الفروع</h3>
              <div className="h-px flex-1 bg-border-light dark:bg-border-dark" />
              <span className="text-xs font-bold text-primary/70 dark:text-accent bg-primary/8 dark:bg-primary/15 px-3 py-1 rounded-full">
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
                  {branches.map((b) => (
                    <BranchCard key={b.id} branch={b} />
                  ))}
                </div>

                {branches.length > 1 && (
                  <TotalsCard totals={totals} count={branches.length} />
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
