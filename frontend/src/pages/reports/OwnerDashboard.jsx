import React, { useState, useEffect } from "react";
import { reportService } from "../../services/reportService";
import KPICard from "../../components/reports/KPICard";
import ArabicLineChart from "../../components/reports/ArabicLineChart";
import toast from "react-hot-toast";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportService.getOwnerDashboard()
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <span className="material-icons-round animate-spin text-5xl text-primary">autorenew</span>
    </div>
  );

  if (!data) return null;

  const totalTreasury = data.treasuries?.reduce((s, t) => s + t.balance, 0) || 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-2xl">dashboard_customize</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">لوحة المالك</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">نظرة شاملة على أداء جميع الفروع</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="مبيعات اليوم" value={`${fmt(data.today?.total)} ج.م`} icon="today" color="primary" />
        <KPICard label="مبيعات الشهر" value={`${fmt(data.mtd?.total)} ج.م`} icon="calendar_month" color="green" />
        <KPICard label="إجمالي الخزائن" value={`${fmt(totalTreasury)} ج.م`} icon="account_balance" color="blue" />
        <KPICard label="تنبيهات إعادة الطلب" value={data.reorderAlertCount || 0} icon="warning" color={data.reorderAlertCount > 0 ? "amber" : "green"} />
        <KPICard label="ورديات معلقة" value={data.pendingShiftReviews || 0} icon="pending_actions" color={data.pendingShiftReviews > 0 ? "red" : "green"} />
      </div>

      {/* 30-day Trend Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4">المبيعات — آخر 30 يوم</h2>
        <div style={{ height: 280 }}>
          <ArabicLineChart
            labels={data.trend30d?.labels || []}
            datasets={data.trend30d?.perBranch?.map((b) => ({ label: b.branchName, data: b.data })) || []}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Items */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4">أعلى 5 أصناف (الشهر الحالي)</h2>
          <div className="space-y-3">
            {data.top5Items?.map((item, i) => (
              <div key={item.itemName} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{item.itemName}</p>
                </div>
                <span className="text-sm font-mono text-slate-900 dark:text-white">{fmt(item.revenue)} ج.م</span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-branch mini panels */}
        <div className="space-y-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">مبيعات اليوم — حسب الفرع</h2>
          {data.today?.perBranch?.length ? data.today.perBranch.map((b) => (
            <div key={b.branchId} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">{b.branchName}</p>
                <p className="text-xs text-slate-400">{b.invoiceCount} فاتورة</p>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{fmt(b.total)} ج.م</p>
            </div>
          )) : (
            <div className="text-center py-8 text-slate-400">لا توجد مبيعات اليوم</div>
          )}

          {/* Treasuries */}
          {data.treasuries?.length > 0 && (
            <>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 pt-2">أرصدة الخزائن</h2>
              {data.treasuries.map((t) => (
                <div key={t.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                  <p className="font-medium text-slate-700 dark:text-slate-300">{t.name}</p>
                  <p className="font-bold text-slate-900 dark:text-white">{fmt(t.balance)} ج.م</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
