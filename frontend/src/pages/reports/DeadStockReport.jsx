import React, { useState, useEffect, useCallback } from "react";
import { reportService } from "../../services/reportService";
import ReportFilterBar from "../../components/reports/ReportFilterBar";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

export default function DeadStockReport() {
  const [filters, setFilters] = useState({ days: "90" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await reportService.getDeadStock(filters); setData(res); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await reportService.exportDeadStock(filters); }
    catch (e) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  const totalValue = data?.reduce((s, r) => s + r.stockValue, 0) || 0;

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Icon name="inventory" className="text-amber-600 text-xl" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">المخزون الراكد</h1>
      </div>
      <ReportFilterBar filters={filters} onChange={setFilters} showDays onExport={handleExport} exporting={exporting} showDateRange={false} />
      {loading ? (
        <div className="flex items-center justify-center h-64"><Icon name="autorenew" className="animate-spin text-4xl text-primary" /></div>
      ) : data ? (
        <>
          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex-1">
              <p className="text-xs text-slate-500 mb-1">عدد الأصناف الراكدة</p>
              <p className="text-2xl font-bold text-amber-600">{data.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex-1">
              <p className="text-xs text-slate-500 mb-1">إجمالي قيمة المخزون الراكد</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م</p>
            </div>
          </div>
          {data.length === 0 ? (
            <div className="text-center py-12 text-green-600 font-medium">لا يوجد مخزون راكد خلال الفترة المحددة</div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الصنف</th>
                    <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الكمية</th>
                    <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">الوحدة</th>
                    <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">المستودع</th>
                    <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">أيام بلا بيع</th>
                    <th className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">القيمة (ج.م)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{row.itemName}</td>
                      <td className="px-4 py-2 font-mono">{row.quantity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-slate-500">{row.unit}</td>
                      <td className="px-4 py-2 text-slate-500">{row.warehouseName}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${row.daysSinceLastSale === null ? "bg-slate-100 text-slate-500" : row.daysSinceLastSale > 180 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>{row.daysSinceLastSale ?? "لم تُباع من قبل"}</span></td>
                      <td className="px-4 py-2 font-mono">{row.stockValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
