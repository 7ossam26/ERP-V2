import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryCountService } from "../../services/inventoryCountService";
import { warehouseService } from "../../services/warehouseService";
import toast from "react-hot-toast";

const STATUS_LABELS = {
  IN_PROGRESS: { label: "مفتوح", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  COMPLETED: { label: "مكتمل", color: "bg-green-100 text-green-800 border-green-200" },
  CANCELLED: { label: "ملغى", color: "bg-gray-100 text-gray-700 border-gray-300" },
};

const InventoryCountListPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryCountService.getAll({
        warehouseId: warehouseId || undefined,
        status: status || undefined,
        page,
        limit: LIMIT,
      });
      setData(res.data);
      setTotal(res.total);
    } catch {
      toast.error("فشل تحميل جلسات الجرد");
    } finally {
      setLoading(false);
    }
  }, [warehouseId, status, page]);

  useEffect(() => {
    warehouseService.getAll().then((w) => setWarehouses(Array.isArray(w) ? w : [])).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
            <span className="material-icons-round text-primary">assignment</span>
            الجرد الفعلي
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total > 0 ? `${total} جلسة جرد` : "لا توجد جلسات جرد"}
          </p>
        </div>
        <button onClick={() => navigate("/inventory-counts/new")}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm">
          <span className="material-icons-round text-lg">add</span>
          جرد جديد
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل المخازن</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">رقم الجرد</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">المخزن</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الحالة</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">عدد الأصناف</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">المستخدم</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">التاريخ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">
                  <span className="material-icons-round animate-spin text-primary text-3xl">sync</span>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">
                  <span className="material-icons-round text-4xl mb-2 block">assignment</span>
                  لا توجد جلسات جرد
                </td></tr>
              ) : data.map((count) => {
                const statusCfg = STATUS_LABELS[count.status] || {};
                return (
                  <tr key={count.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{count.countNumber}</td>
                    <td className="px-4 py-3">{count.warehouse?.name || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{count._count?.items || 0}</td>
                    <td className="px-4 py-3">{count.user?.name || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">
                      {new Date(count.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => navigate(
                        count.status === "IN_PROGRESS" ? `/inventory-counts/${count.id}/session` : `/inventory-counts/${count.id}`
                      )} className="text-primary hover:text-primary/70 transition-colors">
                        <span className="material-icons-round text-[18px]">
                          {count.status === "IN_PROGRESS" ? "edit" : "visibility"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-light dark:border-border-dark">
            <span className="text-sm text-gray-500">صفحة {page} من {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">السابق</button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">التالي</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryCountListPage;
