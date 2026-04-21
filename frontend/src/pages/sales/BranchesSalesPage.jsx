import React, { useState, useEffect } from "react";
import {
  branchService,
  settingsService,
  treasuryService,
} from "../../services/domainServices";
import { useBranch } from "../../contexts/BranchContext";

const BranchesSalesPage = () => {
  const { activeBranchId } = useBranch();
  const [branches, setBranches] = useState([]);
  const [mainTreasury, setMainTreasury] = useState(null);
  const [visaTreasury, setVisaTreasury] = useState(null);
  const [percentageChange, setPercentageChange] = useState(0);
  const [branchesTotalBalance, setBranchesTotalBalance] = useState(0);
  const [isPositive, setIsPositive] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch System Configuration
        const settings = await settingsService.get();

        // Fetch Main Treasury if configured
        if (settings.mainTreasuryId) {
          const mainTreasuryData = await treasuryService.getById(
            settings.mainTreasuryId,
          );
          setMainTreasury(mainTreasuryData);
        }

        // Fetch Visa Treasury if configured (phase 6 will add Instapay card + date filter)
        if (settings.visaTreasuryId) {
          const visaTreasuryData = await treasuryService.getById(
            settings.visaTreasuryId,
          );
          setVisaTreasury(visaTreasuryData);
        }

        // Fetch Branch Balances (includes cash + instapay)
        const balancesData = await branchService.getBalances();
        setBranches(balancesData);

        // Fetch Financial Summary for percentage change and total balance
        const summaryData = await branchService.getSummary();
        const pct = parseFloat(summaryData.percentageChange);
        setPercentageChange(Math.abs(pct));
        setIsPositive(pct >= 0);
        setBranchesTotalBalance(Number(summaryData.totalBalance || 0));
      } catch (error) {
        console.error("Failed to fetch branch data", error);
      }
    };
    fetchData();
  }, [activeBranchId]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-text-light dark:text-text-dark text-3xl font-black leading-tight tracking-tight">
                أرصدة الفروع
              </h1>
              <p className="text-primary/80 dark:text-accent/80 text-sm md:text-base font-normal">
                نظرة عامة على السيولة النقدية في جميع الفروع والخزينة الرئيسية
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 h-10 px-4 bg-primary text-white hover:bg-primary-hover rounded-lg text-sm font-bold shadow-md shadow-primary/20 transition-all">
                <span className="material-symbols-outlined text-[18px]">
                  sync
                </span>
                <span>تحديث البيانات</span>
              </button>
            </div>
          </div>

          {/* Main Treasury Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4A3428] to-[#6F4E37] text-white p-6 md:p-10 shadow-lg">
            <div
              className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(#d7ccc8 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-accent bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[18px]">
                    lock
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                    {mainTreasury?.name || "الخزينة الرئيسية"} + الفروع
                  </span>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1">
                    الرصيد الإجمالي الحالي
                  </p>
                  <h2 className="text-5xl md:text-6xl font-black tracking-tight text-white">
                    {(
                      (mainTreasury ? Number(mainTreasury.balance) : 0) +
                      branchesTotalBalance
                    ).toLocaleString()}{" "}
                    جنيه مصري
                  </h2>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
                <div
                  className={`flex items-center gap-2 ${
                    isPositive
                      ? "text-green-400 bg-green-400/10 border-green-400/20"
                      : "text-red-400 bg-red-400/10 border-red-400/20"
                  } px-3 py-1.5 rounded-lg border`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {isPositive ? "trending_up" : "trending_down"}
                  </span>
                  <span className="text-sm font-bold font-['Inter']">
                    {isPositive ? "+" : "-"}
                    {percentageChange}%
                  </span>
                  <span
                    className={`text-xs ${
                      isPositive ? "text-green-400/80" : "text-red-400/80"
                    }`}>
                    مقارنة بالأمس
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Visa Treasury Card (Instapay card + date filter come in phase 6) */}
          {visaTreasury && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#4c096e] text-white p-6 md:p-8 shadow-lg">
              <div
                className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(#93c5fd 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}></div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-accent bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[18px]">
                      account_balance
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                      خزينة فيزا
                    </span>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm mb-1">
                      الرصيد المتراكم من مدفوعات الفيزا
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                      {Number(visaTreasury.balance).toLocaleString()} جنيه مصري
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branches Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  store
                </span>
                أرصدة الفروع
              </h3>
              <div className="h-[1px] flex-1 bg-border-light dark:bg-border-dark mx-4"></div>
              <span className="text-sm text-primary/70 dark:text-accent">
                {branches.length} فروع نشطة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="group bg-surface-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 flex flex-col gap-4">
                  {/* Branch Header */}
                  <div className="flex gap-3 items-center border-b border-border-light dark:border-border-dark pb-3">
                    <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-xl">
                        storefront
                      </span>
                    </div>
                    <h4 className="font-bold text-lg text-text-light dark:text-text-dark">
                      {branch.name}
                    </h4>
                  </div>
                  {/* Balances */}
                  <div className="flex flex-col gap-3">
                    {/* Cash Balance */}
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/10 rounded-xl px-4 py-3 border border-green-100 dark:border-green-900/30">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-lg">
                          payments
                        </span>
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          النقدية
                        </span>
                      </div>
                      <span className="text-xl font-black text-green-700 dark:text-green-300">
                        {(branch.cashBalance || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                      </span>
                    </div>
                    {/* Visa Balance */}
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 rounded-xl px-4 py-3 border border-blue-100 dark:border-blue-900/30">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-lg">
                          credit_card
                        </span>
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          فيزا اليوم
                        </span>
                      </div>
                      <span className="text-xl font-black text-blue-700 dark:text-blue-300">
                        {(branch.visaToday || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                      </span>
                    </div>
                    {/* InstaPay Balance */}
                    <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/10 rounded-xl px-4 py-3 border border-purple-100 dark:border-purple-900/30">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-lg">
                          phone_iphone
                        </span>
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          انستا باي اليوم
                        </span>
                      </div>
                      <span className="text-xl font-black text-purple-700 dark:text-purple-300">
                        {(branch.instapayToday || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchesSalesPage;
