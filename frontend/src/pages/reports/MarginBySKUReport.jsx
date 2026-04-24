import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import ArabicBarChart from "../../components/reports/ArabicBarChart";
import toast from "react-hot-toast";

const today = new Date().toISOString().split("T")[0];
const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

export default function MarginBySKUReport() {
  const [filters, setFilters] = useState({ from: thirtyAgo, to: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getMarginBySKU(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      setData(res);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportMarginBySKU(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-xl">trending_up</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">هامش الربح بالصنف</h1>
        <p className="text-xs text-slate-400">
          {"\u0627\u0644\u062a\u0643\u0644\u0641\u0629 = \u0622\u062e\u0631 \u0633\u0639\u0631 \u0634\u0631\u0627\u0621 \u00d7 \u0627\u0644\u0643\u0645\u064a\u0629"}
        </p>
      </div>

      <ReportFilterBar filters={filters} onChange={setFilters} onExport={handleExport} exporting={exporting} />

      {loading ? (
        <div className="flex items-center justify-center h-64"><span className="material-icons-round animate-spin text-4xl text-primary">autorenew</span></div>
      ) : data?.items?.length ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" style={{ height: 320 }}>
            <ArabicBarChart
              labels={data.items.slice(0, 15).map((i) => i.itemName)}
              datasets={[{ label: "نسبة الهامش %", data: data.items.slice(0, 15).map((i) => i.marginPct) }]}
            />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الصنف</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الإيراد</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">التكلفة</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الهامش</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.itemName} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{item.itemName}</td>
                    <td className="px-4 py-2 font-mono">{item.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 font-mono">{item.cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className={`px-4 py-2 font-mono font-semibold ${item.margin >= 0 ? "text-green-600" : "text-red-500"}`}>{item.margin.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-slate-600">{item.marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : data ? <div className="text-center py-12 text-slate-400">لا توجد بيانات للفترة المحددة</div> : null}
    </div>
  );
}
