import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryAdjustmentService } from "../../services/inventoryAdjustmentService";
import { warehouseService } from "../../services/warehouseService";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

const REASON_LABELS = {
  DAMAGE: "تلف",
  THEFT: "سرقة",
  CORRECTION: "تصحيح",
  RETURN: "مرتجع",
  COUNT_VARIANCE: "فرق جرد",
  OTHER: "أخرى",
};

const DIRECTION_LABELS = {
  IN: { label: "إضافة", color: "bg-green-100 text-green-800 border-green-200", icon: "add_circle" },
  OUT: { label: "خصم", color: "bg-red-100 text-red-800 border-red-200", icon: "remove_circle" },
};

const InventoryAdjustmentsListPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryAdjustmentService.getAll({
        warehouseId: warehouseId || undefined,
        reason: reason || undefined,
        direction: direction || undefined,
        q: search || undefined,
        page,
        limit: LIMIT,
      });
      setData(res.data);
      setTotal(res.total);
    } catch {
      toast.error("فشل تحميل التسويات");
    } finally {
      setLoading(false);
    }
  }, [warehouseId, reason, direction, search, page]);

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
            <Icon name="tune" className="text-primary" />
            تسويات المخزون
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total > 0 ? `${total} تسوية` : "لا توجد تسويات"}
          </p>
        </div>
        <button
          onClick={() => navigate("/inventory-adjustments/new")}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm">
          <Icon name="add" className="text-lg" />
          تسوية جديدة
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <Icon name="search" className="text-gray-400 text-[18px]" />
            </span>
            <input
              type="text"
              placeholder="رقم التسوية أو ملاحظات..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل المخازن</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل الأسباب</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل الاتجاهات</option>
            <option value="IN">إضافة</option>
            <option value="OUT">خصم</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">رقم التسوية</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">المخزن</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الاتجاه</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">السبب</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">عدد الأصناف</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">المستخدم</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">التاريخ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">
                  <Icon name="sync" className="animate-spin text-primary text-3xl" />
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">
                  <Icon name="tune" className="text-4xl mb-2 block" />
                  لا توجد تسويات
                </td></tr>
              ) : data.map((adj) => {
                const dir = DIRECTION_LABELS[adj.direction] || {};
                return (
                  <tr key={adj.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{adj.adjustmentNumber}</td>
                    <td className="px-4 py-3">{adj.warehouse?.name || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${dir.color}`}>
                        <Icon name={dir.icon} size={14} />
                        {dir.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{REASON_LABELS[adj.reasonCode] || adj.reasonCode}</td>
                    <td className="px-4 py-3 text-center font-bold">{adj.items?.length || 0}</td>
                    <td className="px-4 py-3">{adj.user?.name || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">
                      {new Date(adj.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => navigate(`/inventory-adjustments/${adj.id}`)}
                        className="text-primary hover:text-primary/70 transition-colors">
                        <Icon name="visibility" className="text-[18px]" />
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

export default InventoryAdjustmentsListPage;
