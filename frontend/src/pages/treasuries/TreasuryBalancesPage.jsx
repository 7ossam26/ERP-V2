import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

// Visual identity per treasury scope — keeps global treasuries visually
// distinct from branch drawers without hardcoding treasury names.
const SCOPE_META = {
  MAIN: {
    label: "الخزينة الرئيسية",
    icon: "account_balance",
    gradient: "from-amber-600 to-amber-500",
  },
  GLOBAL_VISA: {
    label: "خزينة فيزا",
    icon: "credit_card",
    gradient: "from-blue-600 to-blue-500",
  },
  GLOBAL_INSTAPAY: {
    label: "خزينة انستاباي",
    icon: "account_balance_wallet",
    gradient: "from-purple-600 to-purple-500",
  },
};

const TreasuryBalancesPage = () => {
  const [data, setData] = useState({ treasuries: [], totalBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/treasuries/balances");
      setData(res || { treasuries: [], totalBalance: 0 });
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to load treasury balances:", error);
      toast.error(error.message || "فشل تحميل أرصدة الخزائن");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) =>
    Number(n).toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const globals = data.treasuries.filter((t) => t.scope !== "BRANCH_CASH");
  const branchDrawers = data.treasuries.filter(
    (t) => t.scope === "BRANCH_CASH",
  );
  const branchTotal = branchDrawers.reduce(
    (s, t) => s + Number(t.balance || 0),
    0,
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-gray-500">
              arrow_forward
            </span>
          </button>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full">
            <span className="material-symbols-outlined text-2xl text-emerald-600">
              savings
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              أرصدة الخزائن
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              آخر تحديث:{" "}
              {lastRefresh.toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-colors">
          <span
            className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>
            refresh
          </span>
          تحديث
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : data.treasuries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">
            savings
          </span>
          لا توجد خزائن متاحة
        </div>
      ) : (
        <>
          {/* Grand total */}
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-5 text-white shadow-md mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <span className="material-symbols-outlined text-2xl">
                    savings
                  </span>
                </div>
                <div>
                  <p className="text-sm opacity-80 font-medium">
                    إجمالي أرصدة الخزائن
                  </p>
                  <p className="text-xs opacity-60 mt-0.5">
                    جميع الخزائن · {data.treasuries.length} خزينة
                  </p>
                </div>
              </div>
              <p className="text-3xl font-bold">{fmt(data.totalBalance)} ج.م</p>
            </div>
          </div>

          {/* Global treasuries (Main / Visa / InstaPay) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {globals.map((t) => {
              const meta = SCOPE_META[t.scope] || {
                label: t.name,
                icon: "savings",
                gradient: "from-gray-600 to-gray-500",
              };
              return (
                <div
                  key={t.id}
                  className={`bg-gradient-to-r ${meta.gradient} rounded-2xl p-5 text-white shadow-md`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                      <span className="material-symbols-outlined text-2xl">
                        {meta.icon}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{t.name}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{fmt(t.balance)} ج.م</p>
                </div>
              );
            })}
          </div>

          {/* Branch cash drawers */}
          {branchDrawers.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600">
                    payments
                  </span>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                    خزائن الفروع
                  </h2>
                </div>
                <span className="text-sm font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800">
                  الإجمالي: {fmt(branchTotal)} ج.م
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchDrawers.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl">
                        <span className="material-symbols-outlined text-green-600 text-xl">
                          store
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-800 dark:text-white truncate">
                          {t.branch?.name || t.name}
                        </h3>
                        <p className="text-xs text-gray-400 truncate">
                          {t.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        الرصيد
                      </span>
                      <span className="font-bold text-green-800 dark:text-green-300 text-lg">
                        {fmt(t.balance)} ج.م
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TreasuryBalancesPage;
