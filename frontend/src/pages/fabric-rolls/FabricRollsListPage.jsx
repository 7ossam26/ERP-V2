import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fabricRollService } from "../../services/fabricRollService";
import { warehouseService } from "../../services/warehouseService";
import { itemService } from "../../services/itemService";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

const STATUS_LABELS = {
  AVAILABLE:     { label: "متاح",         color: "bg-green-100 text-green-800 border-green-200" },
  PARTIALLY_CUT: { label: "مقطوع جزئياً", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  DEPLETED:      { label: "مستنفذ",       color: "bg-gray-100 text-gray-700 border-gray-300" },
  DAMAGED:       { label: "تالف",          color: "bg-red-100 text-red-800 border-red-200" },
  RESERVED:      { label: "محجوز",         color: "bg-blue-100 text-blue-800 border-blue-200" },
  SOLD:          { label: "مباع",          color: "bg-purple-100 text-purple-800 border-purple-200" },
  RETURNED:      { label: "مرتجع",         color: "bg-orange-100 text-orange-800 border-orange-200" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const FabricRollsListPage = () => {
  const navigate = useNavigate();
  const [rolls, setRolls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);

  // Filters
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fabricRollService.getAll({
        warehouseId: warehouseId || undefined,
        itemId: itemId || undefined,
        status: statusFilter || undefined,
        q: search || undefined,
        page,
        limit: LIMIT,
      });
      setRolls(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error("فشل تحميل اللفات");
    } finally {
      setLoading(false);
    }
  }, [warehouseId, itemId, statusFilter, search, page]);

  useEffect(() => {
    const loadMeta = async () => {
      const [wh, it] = await Promise.all([
        warehouseService.getAll().catch(() => []),
        itemService.getAll ? itemService.getAll({ itemType: "FABRIC" }).catch(() => []) : Promise.resolve([]),
      ]);
      setWarehouses(Array.isArray(wh) ? wh : []);
      setItems(Array.isArray(it) ? it : []);
    };
    loadMeta();
  }, []);

  useEffect(() => {
    fetchRolls();
  }, [fetchRolls]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRolls();
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
            <Icon name="inventory_2" className="text-primary" />
            لفات الأقمشة
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total > 0 ? `${total} لفة` : "لا توجد لفات"}
          </p>
        </div>
        <Link
          to="/fabric-rolls/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm">
          <Icon name="add" className="text-lg" />
          إضافة لفات
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 mb-5 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <Icon name="search" className="text-gray-400 text-[18px]" />
            </span>
            <input
              type="text"
              placeholder="رقم اللفة أو الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {/* Warehouse */}
          <select
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل المخازن</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Item */}
          <select
            value={itemId}
            onChange={(e) => { setItemId(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل الأقمشة</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
            بحث
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">رقم اللفة</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">الصنف</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">المخزن</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الأصلي (م)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">المتبقي (م)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الحالة</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">تاريخ الإضافة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <Icon name="sync" className="animate-spin text-primary text-3xl" />
                  </td>
                </tr>
              ) : rolls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <Icon name="inventory_2" size={36} className="mb-2 block" />
                    لا توجد لفات
                  </td>
                </tr>
              ) : (
                rolls.map((roll) => (
                  <tr
                    key={roll.id}
                    className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-text-main dark:text-text-dark">
                      {roll.rollNumber}
                      {roll.barcode && (
                        <div className="text-xs text-gray-400 font-normal">{roll.barcode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-main dark:text-text-dark">
                      {roll.item?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-text-muted dark:text-gray-400">
                      {roll.warehouse?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-text-main dark:text-text-dark">
                      {Number(roll.originalLength).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${
                        Number(roll.remainingLength) === 0
                          ? "text-gray-400"
                          : Number(roll.remainingLength) < Number(roll.originalLength) * 0.2
                          ? "text-red-600"
                          : "text-green-600"
                      }`}>
                        {Number(roll.remainingLength).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={roll.status} />
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">
                      {new Date(roll.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/fabric-rolls/${roll.id}`)}
                        className="text-primary hover:text-primary/70 transition-colors">
                        <Icon name="visibility" className="text-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-light dark:border-border-dark">
            <span className="text-sm text-gray-500">
              صفحة {page} من {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded-lg border border-border-light dark:border-border-dark text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                السابق
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border border-border-light dark:border-border-dark text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FabricRollsListPage;
