import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import ArabicPieChart from "../../components/reports/ArabicPieChart";
import ArabicBarChart from "../../components/reports/ArabicBarChart";
import toast from "react-hot-toast";

const today = new Date().toISOString().split("T")[0];
const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

export default function SalesByDimensionReport() {
  const [filters, setFilters] = useState({ from: thirtyAgo, to: today, dimension: "branch" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getSalesByDimension(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      setData(res);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportSalesByDimension(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  const showPie = ["branch", "tier", "paymentMethod"].includes(filters.dimension);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-xl">pie_chart</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">مبيعات حسب المحور</h1>
      </div>

      <ReportFilterBar filters={filters} onChange={setFilters} showDimension onExport={handleExport} exporting={exporting} />

      {loading ? (
        <div className="flex items-center justify-center h-64"><span className="material-icons-round animate-spin text-4xl text-primary">autorenew</span></div>
      ) : data ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" style={{ height: 320 }}>
            {showPie
              ? <ArabicPieChart labels={data.labels} data={data.data} />
              : <ArabicBarChart labels={data.labels} datasets={[{ label: "الإيراد", data: data.data }]} horizontal />
            }
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">التصنيف</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الإجمالي (ج.م)</th>
                  <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {data.labels.map((l, i) => {
                  const total = data.data.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={l} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{l}</td>
                      <td className="px-4 py-2 text-slate-900 dark:text-white font-mono">{(data.data[i] || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-slate-500">{total > 0 ? `${((data.data[i] / total) * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
