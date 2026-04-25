import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import ArabicLineChart from "../../components/reports/ArabicLineChart";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

const today = new Date().toISOString().split("T")[0];
const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

export default function DailySalesReport() {
  const [filters, setFilters] = useState({ from: thirtyAgo, to: today, groupBy: "day" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getDailySales(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      setData(res);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportDailySales(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon name="show_chart" className="text-primary text-xl" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">المبيعات اليومية</h1>
      </div>

      <ReportFilterBar filters={filters} onChange={setFilters} showGroupBy onExport={handleExport} exporting={exporting} />

      {loading ? (
        <div className="flex items-center justify-center h-64"><Icon name="autorenew" className="animate-spin text-4xl text-primary" /></div>
      ) : data ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 mb-1">إجمالي الفترة</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{data.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-lg font-normal text-slate-500">ج.م</span></p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" style={{ height: 320 }}>
            <ArabicLineChart labels={data.labels} datasets={[{ label: "المبيعات", data: data.data }]} />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">التاريخ</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الإجمالي (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {data.labels.map((l, i) => (
                  <tr key={l} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{l}</td>
                    <td className="px-4 py-2 text-slate-900 dark:text-white font-mono">{(data.data[i] || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
