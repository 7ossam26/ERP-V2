import Icon from "../../../components/ui/Icon";
import React from "react";

const StockTransferDetailsModal = ({ isOpen, onClose, transfer }) => {
  if (!transfer) return null;

  const getStatusBadge = (status) => {
    const styles = {
      COMPLETED:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      PENDING:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      APPROVED:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
    const labels = {
      COMPLETED: "مكتمل",
      PENDING: "قيد الانتظار",
      REJECTED: "مرفوض",
      APPROVED: "تمت الموافقة",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-bold ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}>
        {labels[status] || status}
      </span>
    );
  };

  const totalItems = transfer.items?.length || 0;
  const totalQuantity =
    transfer.items?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;

  const translateUnit = (unit) => {
    if (!unit) return "-";
    const units = {
      piece: "قطعة",
      kg: "كيلو",
      gram: "جرام",
    };
    return units[unit.toLowerCase()] || unit;
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true">
          <div
            className="fixed inset-0 bg-background-dark/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
            aria-hidden="true"></div>
          <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-[75%] transform transition-all flex flex-col max-h-[90vh] border border-white/10 dark:border-border-dark animate-fade-in-up">
            <div className="px-6 py-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-accent/5 dark:bg-primary/5 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-white p-2 rounded-lg shadow-sm">
                  <Icon name="move_down" className="text-xl" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-primary dark:text-text-dark flex items-center gap-2">
                    تفاصيل التحويل #{transfer.transferNumber || ""}
                  </h3>
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(transfer.createdAt).toLocaleString("en-GB")}
                  </span>
                </div>
                <div className="mr-4">
                  {getStatusBadge(transfer.status || "COMPLETED")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center">
                  <Icon name="close" className="text-2xl" />
                </button>
              </div>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
                    <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
                      من مخزن
                    </label>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                      {transfer.fromWarehouse?.name}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
                    <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
                      إلى مخزن
                    </label>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                      {transfer.toWarehouse?.name}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
                    <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
                      بواسطة
                    </label>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                      {transfer.user?.name}
                    </p>
                  </div>
                </div>

                {transfer.notes && (
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <label className="text-sm font-bold text-blue-600 dark:text-blue-400 block mb-1">
                      ملاحظات
                    </label>
                    <p className="text-gray-800 dark:text-gray-200">
                      {transfer.notes}
                    </p>
                  </div>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex flex-col items-center justify-center">
                    <span className="text-sm text-primary font-bold">
                      عدد الأصناف
                    </span>
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {totalItems}
                    </span>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex flex-col items-center justify-center">
                    <span className="text-sm text-green-600 dark:text-green-400 font-bold">
                      إجمالي الكمية
                    </span>
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {totalQuantity}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Icon name="inventory_2" className="text-primary" />
                    الأصناف المحولة
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                    <table className="w-full text-center">
                      <thead className="bg-gray-100 dark:bg-zinc-800">
                        <tr>
                          <th className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 text-right">
                            الصنف
                          </th>
                          <th className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                            الوحدة
                          </th>
                          <th className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                            الكمية
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                        {transfer.items?.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 font-medium text-right">
                              {item.item?.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {translateUnit(item.item?.unit)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-primary">
                              {Number(item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StockTransferDetailsModal;
