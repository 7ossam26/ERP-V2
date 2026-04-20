import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import ArabicBarChart from "../../components/reports/ArabicBarChart";
import toast from "react-hot-toast";

export default function FabricRemainingMetersReport() {
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await reportService.getFabricRemainingMeters(filters); setData(res); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportFabricRemainingMeters(filters); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-xl">straighten</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">متبقي الأقمشة</h1>
      </div>
      <ReportFilterBar filters={filters} onChange={setFilters} showDateRange={false} onExport={handleExport} exporting={exporting} />
      {loading ? (
        <div className="flex items-center justify-center h-64"><span className="material-icons-round animate-spin text-4xl text-primary">autorenew</span></div>
      ) : data?.rows?.length ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" style={{ height: 320 }}>
            <ArabicBarChart labels={data.rows.map((r) => r.itemName)} datasets={[{ label: "متبقي (م)", data: data.rows.map((r) => r.totalRemaining) }]} horizontal />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">اسم القماش</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الإجمالي المتبقي (م)</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">عدد اللفات</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.itemName} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{row.itemName}</td>
                    <td className="px-4 py-2 font-mono font-semibold">{row.totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-slate-500">{row.rollCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : data ? <div className="text-center py-12 text-slate-400">لا توجد لفات متاحة</div> : null}
    </div>
  );
}
