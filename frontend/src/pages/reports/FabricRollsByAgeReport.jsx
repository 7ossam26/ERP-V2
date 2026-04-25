import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import ArabicPieChart from "../../components/reports/ArabicPieChart";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

export default function FabricRollsByAgeReport() {
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await reportService.getFabricRollsByAge(filters); setData(res); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportFabricRollsByAge(filters); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon name="schedule" className="text-primary text-xl" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">لفات الأقمشة حسب العمر</h1>
      </div>
      <ReportFilterBar filters={filters} onChange={setFilters} showDateRange={false} onExport={handleExport} exporting={exporting} />
      {loading ? (
        <div className="flex items-center justify-center h-64"><Icon name="autorenew" className="animate-spin text-4xl text-primary" /></div>
      ) : data?.buckets ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            {data.buckets.map((b) => (
              <div key={b.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">{b.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{b.count}</p>
                <p className="text-xs text-slate-400">{b.totalMeters.toLocaleString("en-US", { minimumFractionDigits: 2 })} م</p>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" style={{ height: 300 }}>
            <ArabicPieChart labels={data.buckets.map((b) => b.label)} data={data.buckets.map((b) => b.count)} />
          </div>
        </>
      ) : null}
    </div>
  );
}
