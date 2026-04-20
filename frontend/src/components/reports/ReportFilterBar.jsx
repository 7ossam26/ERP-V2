import React, { useState, useEffect } from "react";
import { reportService } from "../../services/reportService";

export default function ReportFilterBar({
  filters,
  onChange,
  showBranch = true,
  showDateRange = true,
  showGroupBy = false,
  showDimension = false,
  showMetric = false,
  showDays = false,
  onExport,
  exporting = false,
}) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (showBranch) {
      reportService.getBranches().then(setBranches).catch(() => {});
    }
  }, [showBranch]);

  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" dir="rtl">
      <div className="flex flex-wrap gap-3 items-end">
        {showDateRange && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">من</label>
              <input
                type="date"
                value={filters.from || ""}
                onChange={(e) => set("from", e.target.value)}
                className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">إلى</label>
              <input
                type="date"
                value={filters.to || ""}
                onChange={(e) => set("to", e.target.value)}
                className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </>
        )}

        {showBranch && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">الفرع</label>
            <select
              value={filters.branchId || "all"}
              onChange={(e) => set("branchId", e.target.value === "all" ? undefined : e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              <option value="all">جميع الفروع</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {showGroupBy && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">التجميع</label>
            <select
              value={filters.groupBy || "day"}
              onChange={(e) => set("groupBy", e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              <option value="day">يومي</option>
              <option value="week">أسبوعي</option>
              <option value="month">شهري</option>
            </select>
          </div>
        )}

        {showDimension && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">المحور</label>
            <select
              value={filters.dimension || "branch"}
              onChange={(e) => set("dimension", e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              <option value="branch">الفرع</option>
              <option value="tier">شريحة العميل</option>
              <option value="category">التصنيف</option>
              <option value="paymentMethod">طريقة الدفع</option>
              <option value="item">الصنف</option>
            </select>
          </div>
        )}

        {showMetric && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">المقياس</label>
            <select
              value={filters.metric || "revenue"}
              onChange={(e) => set("metric", e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              <option value="revenue">الإيراد</option>
              <option value="quantity">الكمية</option>
            </select>
          </div>
        )}

        {showDays && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">أيام بلا بيع</label>
            <select
              value={filters.days || "90"}
              onChange={(e) => set("days", e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
              <option value="30">30 يوم</option>
              <option value="60">60 يوم</option>
              <option value="90">90 يوم</option>
              <option value="180">180 يوم</option>
            </select>
          </div>
        )}

        {onExport && (
          <button
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mr-auto">
            <span className="material-icons-round text-base">{exporting ? "hourglass_empty" : "download"}</span>
            {exporting ? "جاري التصدير..." : "تصدير Excel"}
          </button>
        )}
      </div>
    </div>
  );
}
