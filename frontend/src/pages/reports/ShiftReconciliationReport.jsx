import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

const today = new Date().toISOString().split("T")[0];
const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

export default function ShiftReconciliationReport() {
  const [filters, setFilters] = useState({ from: thirtyAgo, to: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await reportService.getShiftReconciliation(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))); setData(res); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportShiftReconciliation(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon name="account_balance_wallet" className="text-primary text-xl" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">تسوية الورديات</h1>
      </div>
      <ReportFilterBar filters={filters} onChange={setFilters} onExport={handleExport} exporting={exporting} />
      {loading ? (
        <div className="flex items-center justify-center h-64"><Icon name="autorenew" className="animate-spin text-4xl text-primary" /></div>
      ) : data?.shifts?.length ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">#</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">الفرع</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">الكاشير</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">النوع</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">التاريخ</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">البداية</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">المتوقع</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">الفعلي</th>
                <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">العجز</th>
              </tr>
            </thead>
            <tbody>
              {data.shifts.map((s) => (
                <tr key={s.shiftId} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2 text-slate-400">{s.shiftId}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{s.branchName}</td>
                  <td className="px-3 py-2 text-slate-500">{s.cashierName}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${s.type === "MORNING" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{s.type === "MORNING" ? "صباحي" : "مسائي"}</span></td>
                  <td className="px-3 py-2 text-slate-500">{s.date}</td>
                  <td className="px-3 py-2 font-mono">{s.startCash?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 font-mono">{s.systemExpectedCash?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{s.actualCash?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}</td>
                  <td className={`px-3 py-2 font-mono font-semibold ${s.shortage && s.shortage > 0 ? "text-red-500" : "text-green-600"}`}>{s.shortage != null ? s.shortage.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data ? <div className="text-center py-12 text-slate-400">لا توجد ورديات مغلقة في هذه الفترة</div> : null}
    </div>
  );
}
