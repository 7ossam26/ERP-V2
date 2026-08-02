import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useBranch } from "../../contexts/BranchContext";

const BranchBalancesPage = () => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const navigate = useNavigate();
  const { activeBranchId } = useBranch();

  useEffect(() => {
    fetchBalances();
  }, [activeBranchId]);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get("/branches/balances");
      setBalances(data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to load branch balances:", error);
      toast.error(error.message || "فشل تحميل أرصدة الفروع");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) =>
    Number(n).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // currentCashBalance = stock (treasury balance): everything the branch holds,
  // drawer and safe together. cashBalance was the legacy alias that actually
  // carried windowed sales.
  const totalCash = balances.reduce(
    (s, b) => s + Number(b.currentCashBalance ?? 0),
    0,
  );
  // Only branches with an open shift can be split, so these two do not have to
  // add up to totalCash — the gap is whatever sits in branches that are closed.
  const totalDrawer = balances.reduce((s, b) => s + Number(b.drawerCash ?? 0), 0);
  const totalSafe = balances.reduce((s, b) => s + Number(b.safeCash ?? 0), 0);
  const splitKnown = balances.some((b) => b.safeCash !== null && b.safeCash !== undefined);
  const totalInstapay = balances.reduce((s, b) => s + Number(b.instapay ?? 0), 0);
  const totalVisa = balances.reduce((s, b) => s + Number(b.visa ?? 0), 0);
  // Global treasury balances are the same for every row — take from first
  const visaTreasuryBalance =
    balances.length > 0 ? balances[0].visaTreasuryBalance || 0 : 0;
  const instapayTreasuryBalance =
    balances.length > 0 ? balances[0].instapayTreasuryBalance || 0 : 0;

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
          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
            <span className="material-symbols-outlined text-2xl text-blue-600">
              account_balance
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              أرصدة الفروع
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

      {/* Summary row */}
      {!loading && balances.length > 0 && (
        <>
          {/* Per-method daily totals */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-100 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-1">
                إجمالي النقدية (جميع الفروع)
              </p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                {fmt(totalCash)} ج.م
              </p>
              {splitKnown && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-500">
                  <span>
                    الأدراج <strong className="font-bold">{fmt(totalDrawer)}</strong>
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    الخزن <strong className="font-bold">{fmt(totalSafe)}</strong>
                  </span>
                </div>
              )}
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mb-1">
                إجمالي فيزا اليوم
              </p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                {fmt(totalVisa)} ج.م
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800">
              <p className="text-sm text-purple-700 dark:text-purple-400 font-medium mb-1">
                إجمالي InstaPay اليوم
              </p>
              <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                {fmt(totalInstapay)} ج.م
              </p>
            </div>
          </div>

          {/* Global Visa + Instapay treasury balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <span className="material-symbols-outlined text-2xl">
                      credit_card
                    </span>
                  </div>
                  <div>
                    <p className="text-sm opacity-80 font-medium">خزينة فيزا</p>
                    <p className="text-xs opacity-60 mt-0.5">الرصيد المتراكم · جميع الفروع</p>
                  </div>
                </div>
                <p className="text-3xl font-bold">{fmt(visaTreasuryBalance)} ج.م</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-2xl p-5 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <span className="material-symbols-outlined text-2xl">
                      account_balance_wallet
                    </span>
                  </div>
                  <div>
                    <p className="text-sm opacity-80 font-medium">خزينة انستاباي</p>
                    <p className="text-xs opacity-60 mt-0.5">الرصيد المتراكم · جميع الفروع</p>
                  </div>
                </div>
                <p className="text-3xl font-bold">{fmt(instapayTreasuryBalance)} ج.م</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Branch cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : balances.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">
            business
          </span>
          لا توجد فروع متاحة
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((branch) => (
            <div
              key={branch.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Branch header */}
              <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-white">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">
                    store
                  </span>
                  <h3 className="font-bold text-lg">{branch.name}</h3>
                </div>
                {branch.address && (
                  <p className="text-xs opacity-80 mt-1">{branch.address}</p>
                )}
              </div>

              {/* Balance cards */}
              <div className="p-4 space-y-3">
                {/* Cash — one balance, two containers. The header total is all
                    the branch holds; the two rows under it say where it is, so
                    a transfer to head office is planned against the safe and
                    not against money sitting in a cashier's till. */}
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <span className="material-symbols-outlined text-lg">
                        payments
                      </span>
                      <span className="text-sm font-medium">نقدي بالفرع</span>
                    </div>
                    <span className="font-bold text-green-800 dark:text-green-300 text-lg">
                      {fmt(branch.currentCashBalance)} ج.م
                    </span>
                  </div>

                  {branch.safeCash !== null && branch.safeCash !== undefined ? (
                    <div className="pt-2 border-t border-green-200 dark:border-green-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-700 dark:text-green-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">
                            point_of_sale
                          </span>
                          الدرج
                          {branch.activeShift && (
                            <span className="opacity-60">
                              (وردية #{branch.activeShift.id})
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-green-800 dark:text-green-300 text-sm">
                          {fmt(branch.drawerCash)} ج.م
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-700 dark:text-green-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">
                            savings
                          </span>
                          خزنة الفرع
                        </span>
                        <span className="font-bold text-green-800 dark:text-green-300 text-sm">
                          {fmt(branch.safeCash)} ج.م
                        </span>
                      </div>
                      <p className="text-[10px] text-green-600 dark:text-green-500 pt-1 leading-relaxed">
                        التحويل للإدارة من خزنة الفرع فقط
                      </p>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-green-200 dark:border-green-800">
                      <p className="text-[11px] text-green-600 dark:text-green-500 leading-relaxed">
                        لا توجد وردية مفتوحة — لا يمكن تحديد ما في الدرج وما في
                        الخزنة إلا بوردية قائمة
                      </p>
                    </div>
                  )}
                </div>

                {/* Visa today */}
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <span className="material-symbols-outlined text-lg">
                      credit_card
                    </span>
                    <span className="text-sm font-medium">فيزا اليوم</span>
                  </div>
                  <span className="font-bold text-blue-800 dark:text-blue-300 text-lg">
                    {fmt(branch.visa)} ج.م
                  </span>
                </div>

                {/* InstaPay today */}
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <span className="material-symbols-outlined text-lg">
                      account_balance_wallet
                    </span>
                    <span className="text-sm font-medium">InstaPay اليوم</span>
                  </div>
                  <span className="font-bold text-purple-800 dark:text-purple-300 text-lg">
                    {fmt(branch.instapay)} ج.م
                  </span>
                </div>

                {/* Digital subtotal (Visa + InstaPay) */}
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    إجمالي رقمي (فيزا + InstaPay)
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                    {fmt(Number(branch.visa || 0) + Number(branch.instapay || 0))} ج.م
                  </span>
                </div>

                {/* Active shift — opening cash is now part of the treasury
                    balance above, so showing it here explains where that
                    balance started rather than duplicating it. */}
                {branch.activeShift && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <span className="material-symbols-outlined text-lg">
                        schedule
                      </span>
                      <span className="text-sm font-medium">
                        {branch.activeShift.status === "PENDING_REVIEW"
                          ? "وردية بانتظار المراجعة"
                          : "وردية مفتوحة"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-600 dark:text-amber-500">
                        عهدة بداية الوردية
                      </span>
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                        {fmt(branch.activeShift.openingCash)} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-600 dark:text-amber-500">
                        مصروفات الوردية
                      </span>
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                        {fmt(branch.activeShift.shiftExpenses)} ج.م
                      </span>
                    </div>
                  </div>
                )}

                {/* Expenses in the selected window. Two figures on purpose:
                    totalExpenses is all cash out of the treasury, while
                    operatingExpenses excludes auto-generated purchase rows. */}
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <span className="material-symbols-outlined text-lg">
                        receipt_long
                      </span>
                      <span className="text-sm font-medium">إجمالي المصروفات</span>
                    </div>
                    <span className="font-bold text-red-800 dark:text-red-300 text-lg">
                      {fmt(branch.totalExpenses)} ج.م
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-600 dark:text-red-500">
                      منها مصروفات تشغيلية
                    </span>
                    <span className="font-bold text-red-700 dark:text-red-400 text-sm">
                      {fmt(branch.operatingExpenses)} ج.م
                    </span>
                  </div>
                </div>

                {/* Grand total */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                    الإجمالي
                  </span>
                  <span className="font-bold text-gray-800 dark:text-white text-lg">
                    {fmt(Number(branch.currentCashBalance || 0) + Number(branch.visa || 0) + Number(branch.instapay || 0))} ج.م
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchBalancesPage;
