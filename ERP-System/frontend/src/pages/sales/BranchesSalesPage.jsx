import React, { useState, useEffect } from "react";
import {
  branchService,
  settingsService,
  treasuryService,
} from "../../services/domainServices";

const BranchesSalesPage = () => {
  const [branches, setBranches] = useState([]);
  const [mainTreasury, setMainTreasury] = useState(null);
  const [bankTreasury, setBankTreasury] = useState(null);
  const [percentageChange, setPercentageChange] = useState(0);
  const [isPositive, setIsPositive] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch System Configuration
        const settings = await settingsService.get();

        // Fetch Main Treasury if configured
        if (settings.mainTreasuryId) {
          const mainTreasuryData = await treasuryService.getById(
            settings.mainTreasuryId
          );
          setMainTreasury(mainTreasuryData);
        }

        // Fetch Bank Treasury if configured
        if (settings.bankTreasuryId) {
          const bankTreasuryData = await treasuryService.getById(
            settings.bankTreasuryId
          );
          setBankTreasury(bankTreasuryData);
        }

        // Fetch All Branches
        const branchesData = await branchService.getAll();
        const branchesWithBalance = branchesData.map((branch) => ({
          ...branch,
          balance: branch.treasury?.balance || 0,
        }));
        setBranches(branchesWithBalance);

        // Fetch Financial Summary for percentage change
        const summaryData = await branchService.getSummary();
        const pct = parseFloat(summaryData.percentageChange);
        setPercentageChange(Math.abs(pct));
        setIsPositive(pct >= 0);
      } catch (error) {
        console.error("Failed to fetch branch data", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-text-light dark:text-text-dark text-3xl font-black leading-tight tracking-tight">
                مبيعات الفروع
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
                    {mainTreasury?.name || "الخزينة الرئيسية"}
                  </span>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1">
                    الرصيد الإجمالي الحالي
                  </p>
                  <h2 className="text-5xl md:text-6xl font-black tracking-tight text-white">
                    {mainTreasury
                      ? Number(mainTreasury.balance).toLocaleString()
                      : "0"}{" "}
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

          {/* Bank Treasury Card */}
          {bankTreasury && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-white p-6 md:p-8 shadow-lg">
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
                      {bankTreasury.name}
                    </span>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm mb-1">
                      الرصيد البنكي الحالي
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                      {Number(bankTreasury.balance).toLocaleString()} جنيه مصري
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

            <div className="grid grid-cols-1 gap-4">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="group bg-surface-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="size-12 rounded-full bg-accent/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-2xl">
                        storefront
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-text-light dark:text-text-dark">
                        {branch.name}
                      </h4>
                    </div>
                  </div>
                  <div className="text-left space-y-1">
                    <p className="text-sm text-primary/70 dark:text-accent/70">
                      النقدية في الفرع
                    </p>
                    <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                      {branch.balance.toLocaleString()} جنيه مصري
                    </p>
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
