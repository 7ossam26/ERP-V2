import React, { useState, useEffect } from "react";
import { bomService } from "../../services/domainServices";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const ProductionHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await bomService.getProductionOrders();
      setOrders(data);
    } catch {
      toast.error("فشل في تحميل سجل الإنتاج");
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders.filter(
    (o) => !search || o.bom?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const fmt = (v) => parseFloat(v || 0).toFixed(3);
  const fmtCost = (v) => parseFloat(v || 0).toFixed(2);
  const fmtDate = (d) => {
    const dt = new Date(d);
    return {
      date: dt.toLocaleDateString("ar-EG"),
      time: dt.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/bom")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <span className="material-icons-round text-gray-500">
              arrow_forward
            </span>
          </button>
          <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
            <span className="material-icons-round text-3xl text-green-600">
              precision_manufacturing
            </span>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark">
              سجل الإنتاج
            </h2>
            <p className="text-sm text-text-light/60 dark:text-text-dark/60">
              تاريخ أوامر تنفيذ الإنتاج
            </p>
          </div>
        </div>
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="بحث باسم الوصفة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-background-dark py-2.5 pr-4 pl-10 text-sm focus:ring-2 focus:ring-primary"
          />
          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
            search
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-12 text-center">
          <span className="material-icons-round text-6xl text-gray-300 dark:text-gray-600 mb-4">
            precision_manufacturing
          </span>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            {search ? "لا توجد نتائج للبحث" : "لا توجد أوامر إنتاج مسجلة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const { date, time } = fmtDate(order.createdAt);
            const isExpanded = expandedId === order.id;
            const wasteQty = parseFloat(order.outputWasteQty || 0);
            return (
              <div
                key={order.id}
                className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden hover:shadow-md transition-all">
                {/* Card Header */}
                <div
                  className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-xl">
                      <span className="material-icons-round text-xl text-green-600">
                        precision_manufacturing
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-text-light dark:text-text-dark">
                        {order.bom?.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <span className="material-icons-round text-sm">
                            output
                          </span>
                          مستهدف:{" "}
                          <b className="text-text-light dark:text-text-dark">
                            {fmt(order.targetOutputQty)}
                          </b>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span className="material-icons-round text-sm text-green-500">
                            check_circle
                          </span>
                          فعلي:{" "}
                          <b className="text-green-600">
                            {fmt(order.actualOutputQty)}
                          </b>
                        </span>
                        {wasteQty > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <span className="material-icons-round text-sm text-red-500">
                                warning
                              </span>
                              هالك:{" "}
                              <b className="text-red-500">{fmt(wasteQty)}</b>
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span className="material-icons-round text-sm">
                            remove_circle_outline
                          </span>
                          {order.sourceWarehouse?.name}
                        </span>
                        {order.destWarehouse && (
                          <>
                            <span>→</span>
                            <span className="flex items-center gap-1">
                              <span className="material-icons-round text-sm">
                                add_circle_outline
                              </span>
                              {order.destWarehouse?.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="font-bold text-sm text-text-light dark:text-text-dark">
                        {fmtCost(order.totalCost)} ج.م
                      </p>
                      <p className="text-xs text-gray-400">
                        {order.createdBy?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {date} {time}
                      </p>
                    </div>
                    <span
                      className={`material-icons-round text-gray-400 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 mb-1">
                          الكمية المستهدفة
                        </p>
                        <p className="font-bold text-lg text-text-light dark:text-text-dark">
                          {fmt(order.targetOutputQty)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-green-100 dark:border-green-800">
                        <p className="text-xs text-gray-500 mb-1">
                          الكمية الفعلية
                        </p>
                        <p className="font-bold text-lg text-green-600">
                          {fmt(order.actualOutputQty)}
                        </p>
                      </div>
                      <div
                        className={`rounded-xl p-3 text-center border ${wasteQty > 0 ? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"}`}>
                        <p className="text-xs text-gray-500 mb-1">الهالك</p>
                        <p
                          className={`font-bold text-lg ${wasteQty > 0 ? "text-red-500" : "text-gray-400"}`}>
                          {wasteQty > 0 ? fmt(wasteQty) : "—"}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 mb-1">
                          تكلفة المواد
                        </p>
                        <p className="font-bold text-lg text-text-light dark:text-text-dark">
                          {fmtCost(order.totalCost)} ج.م
                        </p>
                      </div>
                    </div>

                    {/* Materials breakdown */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="text-right py-2 px-3 font-semibold">
                            #
                          </th>
                          <th className="text-right py-2 px-3 font-semibold">
                            المادة الخام
                          </th>
                          <th className="text-center py-2 px-3 font-semibold">
                            الكمية المستهلكة
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items?.map((item, idx) => (
                          <tr
                            key={item.id}
                            className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="py-2.5 px-3 text-gray-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-text-light dark:text-text-dark">
                              {item.item?.name}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-primary">
                              {parseFloat(item.quantityUsed).toFixed(4)}{" "}
                              <span className="text-xs text-gray-400">
                                {item.item?.unit}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {order.notes && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-gray-500 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg">
                        <span className="material-icons-round text-yellow-500 text-sm mt-0.5">
                          info
                        </span>
                        {order.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductionHistory;
