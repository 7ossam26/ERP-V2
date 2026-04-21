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

const BranchesSalesPage = () => {
  const { activeBranchId } = useBranch();

  const initialRange = computePresetRange("today");
  const [filter, setFilter] = useState({ preset: "today", ...initialRange });

  const [branches, setBranches] = useState([]);
  const [mainTreasury, setMainTreasury] = useState(null);
  const [visaTreasury, setVisaTreasury] = useState(null);
  const [instapayTreasury, setInstapayTreasury] = useState(null);
  const [branchesTotalBalance, setBranchesTotalBalance] = useState(0);
  const [percentageChange, setPercentageChange] = useState(0);
  const [isPositive, setIsPositive] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingHeader, setLoadingHeader] = useState(true);

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
    } catch (error) {
      console.error("Failed to fetch header data", error);
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
    } catch (error) {
      console.error("Failed to fetch branch balances", error);
      toast.error("فشل تحميل أرصدة الفروع");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    fetchHeader();
  }, [fetchHeader, activeBranchId]);

  useEffect(() => {
    fetchRows(filter.from, filter.to);
  }, [fetchRows, filter.from, filter.to, activeBranchId]);

  const refreshAll = () => {
    fetchHeader();
    fetchRows(filter.from, filter.to);
  };

  const totals = branches.reduce(
    (acc, b) => ({
      cash: acc.cash + Number(b.cashBalance || 0),
      visa: acc.visa + Number(b.visa || b.visaToday || 0),
      instapay: acc.instapay + Number(b.instapay || b.instapayToday || 0),
      total: acc.total + Number(b.total || 0),
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
              className="flex items-center gap-2 h-10 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  loadingRows || loadingHeader ? "animate-spin" : ""
                }`}>
                sync
              </span>
              تحديث البيانات
            </button>
          </div>

          {/* Header cards */}
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

          {/* Branch rows */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  store
                </span>
                تفصيل الفروع
              </h3>
              <div className="h-[1px] flex-1 bg-border-light dark:bg-border-dark mx-4" />
              <span className="text-sm text-primary/70 dark:text-accent">
                {branches.length} فرع
              </span>
            </div>

            {loadingRows ? (
              <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-surface-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-5xl mb-3 block">
                  business
                </span>
                لا توجد فروع متاحة
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-card-dark shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background-light dark:bg-background-dark/60 text-text-secondary dark:text-gray-400">
                      <tr>
                        <th className="text-right font-bold px-5 py-3">الفرع</th>
                        <th className="text-right font-bold px-5 py-3 text-green-700 dark:text-green-400">
                          نقدي
                        </th>
                        <th className="text-right font-bold px-5 py-3 text-blue-700 dark:text-blue-400">
                          فيزا
                        </th>
                        <th className="text-right font-bold px-5 py-3 text-purple-700 dark:text-purple-400">
                          انستاباي
                        </th>
                        <th className="text-right font-bold px-5 py-3">
                          الإجمالي
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((b) => {
                        const visa = Number(b.visa ?? b.visaToday ?? 0);
                        const instapay = Number(
                          b.instapay ?? b.instapayToday ?? 0,
                        );
                        const cash = Number(b.cashBalance || 0);
                        const total = Number(b.total ?? cash + visa + instapay);
                        return (
                          <tr
                            key={b.id}
                            className="border-t border-border-light dark:border-border-dark hover:bg-background-light/60 dark:hover:bg-background-dark/40 transition-colors">
                            <td className="px-5 py-3 font-bold text-text-light dark:text-text-dark">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[20px]">
                                  storefront
                                </span>
                                {b.name}
                              </div>
                            </td>
                            <td className="px-5 py-3 font-bold text-green-700 dark:text-green-300 dir-ltr text-right">
                              {fmt(cash)}{" "}
                              <span className="text-xs font-medium">ج.م</span>
                            </td>
                            <td className="px-5 py-3 font-bold text-blue-700 dark:text-blue-300 dir-ltr text-right">
                              {fmt(visa)}{" "}
                              <span className="text-xs font-medium">ج.م</span>
                            </td>
                            <td className="px-5 py-3 font-bold text-purple-700 dark:text-purple-300 dir-ltr text-right">
                              {fmt(instapay)}{" "}
                              <span className="text-xs font-medium">ج.م</span>
                            </td>
                            <td className="px-5 py-3 font-black text-text-light dark:text-text-dark dir-ltr text-right">
                              {fmt(total)}{" "}
                              <span className="text-xs font-medium">ج.م</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-background-light dark:bg-background-dark/60 font-black">
                      <tr className="border-t-2 border-border-light dark:border-border-dark">
                        <td className="px-5 py-3 text-text-light dark:text-text-dark">
                          الإجمالي الكلي
                        </td>
                        <td className="px-5 py-3 text-green-700 dark:text-green-300 dir-ltr text-right">
                          {fmt(totals.cash)}{" "}
                          <span className="text-xs font-medium">ج.م</span>
                        </td>
                        <td className="px-5 py-3 text-blue-700 dark:text-blue-300 dir-ltr text-right">
                          {fmt(totals.visa)}{" "}
                          <span className="text-xs font-medium">ج.م</span>
                        </td>
                        <td className="px-5 py-3 text-purple-700 dark:text-purple-300 dir-ltr text-right">
                          {fmt(totals.instapay)}{" "}
                          <span className="text-xs font-medium">ج.م</span>
                        </td>
                        <td className="px-5 py-3 text-text-light dark:text-text-dark dir-ltr text-right">
                          {fmt(totals.total)}{" "}
                          <span className="text-xs font-medium">ج.م</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchesSalesPage;
