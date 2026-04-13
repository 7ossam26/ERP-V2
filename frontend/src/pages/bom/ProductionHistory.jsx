import React, { useState, useEffect } from "react";
import { bomService } from "../../services/domainServices";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const ProductionHistory = () => {
  const { activeBranchId } = useBranch();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [cancelingOrder, setCancelingOrder] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, [activeBranchId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await bomService.getProductionOrders();
      setOrders(data);
    } catch (error) {
      toast.error(error.message || "فشل في تحميل سجل الإنتاج");
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders.filter(
    (o) => !search || o.bom?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleStartEdit = (order) => {
    setEditingId(order.id);
    setEditForm({
      targetOutputQty: parseFloat(order.targetOutputQty).toFixed(4),
      actualOutputQty: parseFloat(order.actualOutputQty).toFixed(4),
      outputWasteQty: parseFloat(order.outputWasteQty || 0).toFixed(4),
      notes: order.notes || "",
    });
    setExpandedId(order.id); // ensure card is expanded
  };

  const handleSaveEdit = async (orderId) => {
    setSaving(true);
    try {
      const updated = await bomService.updateProductionOrder(orderId, editForm);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...updated } : o)),
      );
      setEditingId(null);
      toast.success("تم تعديل أمر الإنتاج بنجاح");
      // Refetch to get fresh data with relations
      fetchOrders();
    } catch (error) {
      toast.error(error.message || "فشل تعديل أمر الإنتاج");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelingOrder) return;
    setCanceling(true);
    try {
      await bomService.cancelProductionOrder(cancelingOrder.id);
      toast.success("تم إلغاء أمر الإنتاج وإعادة المواد للمخزون");
      setCancelingOrder(null);
      fetchOrders();
    } catch (error) {
      toast.error(error.message || "فشل إلغاء أمر الإنتاج");
    } finally {
      setCanceling(false);
    }
  };

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
                  <div className="flex items-center gap-3 flex-shrink-0">
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
                    {order.status === "CANCELLED" && (
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-bold border border-red-200 dark:border-red-700">
                        ملغي
                      </span>
                    )}
                    {order.status === "RETURNED" && (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full font-bold border border-orange-200 dark:border-orange-700">
                        مُرجَع
                      </span>
                    )}
                    {order.status === "COMPLETED" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(order);
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="تعديل">
                          <span className="material-icons-round text-lg">edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelingOrder(order);
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="إلغاء/رجوع">
                          <span className="material-icons-round text-lg">undo</span>
                        </button>
                      </>
                    )}
                    <span
                      className={`material-icons-round text-gray-400 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30">

                    {/* Edit form (shown when in edit mode for this order) */}
                    {editingId === order.id && (
                      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                        <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                          <span className="material-icons-round text-lg">edit</span>
                          تعديل الكميات
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                              الكمية المستهدفة
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              value={editForm.targetOutputQty}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, targetOutputQty: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                              الكمية الفعلية
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={editForm.actualOutputQty}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, actualOutputQty: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                              الهالك
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={editForm.outputWasteQty}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, outputWasteQty: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                            ملاحظات
                          </label>
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, notes: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(order.id)}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-1">
                            <span className="material-icons-round text-base">save</span>
                            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm transition-colors">
                            إلغاء
                          </button>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                          <span className="material-icons-round text-sm">warning</span>
                          سيتم حذف أمر الإنتاج الحالي وإنشاء أمر جديد بالكميات المعدّلة
                        </p>
                      </div>
                    )}

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
                    {(order.status === "CANCELLED" || order.status === "RETURNED") && order.cancelledBy && (
                      <div className="mt-3 flex items-start gap-2 text-sm bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800">
                        <span className="material-icons-round text-red-400 text-sm mt-0.5">
                          person
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          {order.status === "CANCELLED" ? "تم الإلغاء بواسطة" : "تم الإرجاع بواسطة"}:{" "}
                          <b>{order.cancelledBy.name}</b>
                          {order.cancelledAt && (
                            <span className="mr-2 text-gray-400">
                              — {new Date(order.cancelledAt).toLocaleDateString("ar-EG")}{" "}
                              {new Date(order.cancelledAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl border border-border-light dark:border-border-dark w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-700">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl">
                <span className="material-icons-round text-xl text-red-600">undo</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-text-light dark:text-text-dark">
                  تأكيد إلغاء أمر الإنتاج
                </h3>
                <p className="text-sm text-gray-500">{cancelingOrder.bom?.name}</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                سيتم إلغاء هذا الأمر وإعادة المواد الخام التالية إلى مستودع{" "}
                <b className="text-text-light dark:text-text-dark">{cancelingOrder.sourceWarehouse?.name}</b>:
              </p>

              {/* Ingredients table */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-right py-2 px-3 font-semibold text-gray-500 text-xs">المادة الخام</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-500 text-xs">الكمية المُعادة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelingOrder.items?.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-3 font-medium text-text-light dark:text-text-dark">
                          {item.item?.name}
                        </td>
                        <td className="py-2 px-3 text-center text-green-600 font-bold">
                          +{parseFloat(item.quantityUsed).toFixed(4)}{" "}
                          <span className="text-xs text-gray-400">{item.item?.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {cancelingOrder.destWarehouse && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg">
                  <span className="material-icons-round text-sm mt-0.5">warning</span>
                  سيتم أيضاً خصم{" "}
                  <b>{fmt(cancelingOrder.actualOutputQty)}</b>{" "}
                  من المنتج النهائي في مستودع{" "}
                  <b>{cancelingOrder.destWarehouse.name}</b>
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={handleCancelOrder}
                disabled={canceling}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <span className="material-icons-round text-base">undo</span>
                {canceling ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
              <button
                onClick={() => setCancelingOrder(null)}
                disabled={canceling}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm transition-colors">
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionHistory;
