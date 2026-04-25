import Icon from "../../../components/ui/Icon";
import React from "react";

const SaleDetailsModal = ({ isOpen, onClose, sale }) => {
  if (!sale) return null;

  const getPaymentMethodLabel = (method) => {
    if (!method) return "-";
    const upperMethod = method.toUpperCase();
    const methods = {
      CASH: "نقدي",
      CARD: "بطاقة",
      CREDIT: "آجل",
      MIXED: "متنوع",
    };
    return methods[upperMethod] || method;
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
                  <Icon name="receipt" className="text-xl" />
                </div>
                <h3 className="text-xl font-bold text-primary dark:text-text-dark">
                  تفاصيل فاتورة المبيعات #{sale.saleNumber || sale.id}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
                  <Icon name="print" className="text-lg" />
                  <span className="font-bold">طباعة</span>
                </button>
                <button
                  onClick={onClose}
                  className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center">
                  <Icon name="close" className="text-2xl" />
                </button>
              </div>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-6" dir="rtl">
                {/* Sale Header Info */}
                <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      العميل:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {sale.client?.name || "عميل نقدي"}
                      {sale.client?.phoneNumber &&
                        sale.client.phoneNumber !== "0000000000" && (
                          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                            {sale.client.phoneNumber}
                          </span>
                        )}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      التاريخ:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {sale.createdAt
                        ? new Date(sale.createdAt).toLocaleString("ar-EG")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      الفرع:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {sale.branch?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      الخزينة:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {sale.paymentMethod?.toUpperCase() === "CARD"
                        ? "البنك"
                        : sale.treasury?.name || "-"}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Icon name="shopping_cart" className="text-primary" />
                    الأصناف
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-zinc-800">
                        <tr>
                          <th className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">
                            #
                          </th>
                          <th className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">
                            الصنف
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            الكمية
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            سعر الوحدة
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            الإجمالي
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {sale.items && sale.items.length > 0 ? (
                          sale.items.map((saleItem, index) => (
                            <tr
                              key={index}
                              className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                {index + 1}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                {saleItem.item?.name || "-"}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                {Number(saleItem.quantity || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                {Number(saleItem.unitPrice || 0).toFixed(2)} ج.م
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                                {Number(saleItem.total || 0).toFixed(2)} ج.م
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-4 py-8 text-center text-gray-500">
                              لا توجد أصناف
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculations Summary */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Icon name="calculate" className="text-primary" />
                    ملخص الحسابات
                  </h3>
                  <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-700">
                      <span className="text-gray-600 dark:text-gray-400">
                        المجموع الفرعي:
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {Number(sale.subtotal || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-700">
                      <span className="text-gray-600 dark:text-gray-400">
                        ضريبة ({(sale.taxRate * 100).toFixed(0)}%):
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        + {Number(sale.taxAmount || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b-2 border-gray-300 dark:border-zinc-600">
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        الإجمالي النهائي:
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {Number(sale.total || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">
                        المدفوع:
                      </span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {Number(sale.paidAmount || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300 dark:border-zinc-600">
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        الباقي:
                      </span>
                      <span className="text-lg font-bold text-blue-600">
                        {Number(sale.changeAmount || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Icon name="payment" className="text-lg" />
                        <span>طريقة الدفع:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {getPaymentMethodLabel(sale.paymentMethod)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SaleDetailsModal;
