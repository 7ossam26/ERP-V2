import React from "react";

const PurchaseDetailsModal = ({ isOpen, onClose, purchase }) => {
  if (!purchase) return null;

  const getPaymentMethodLabel = (method) => {
    if (!method) return "-";
    const upperMethod = method.toUpperCase();
    const methods = {
      CASH: "نقدي",
      CREDIT: "بطاقة ائتمان",
      DEFERRED: "آجل",
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
                  <span className="material-icons-round text-xl">
                    shopping_cart
                  </span>
                </div>
                <h3 className="text-xl font-bold text-primary dark:text-text-dark">
                  تفاصيل فاتورة المشتريات #{purchase.id}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
                  <span className="material-icons-round text-lg">print</span>
                  <span className="font-bold">طباعة</span>
                </button>
                <button
                  onClick={onClose}
                  className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center">
                  <span className="material-icons-round text-2xl">close</span>
                </button>
              </div>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-6" dir="rtl">
                {/* Purchase Header Info */}
                <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      المورد:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {purchase.supplier?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      التاريخ:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {purchase.createdAt
                        ? new Date(purchase.createdAt).toLocaleString("ar-EG")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      الخزينة:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {purchase.treasury?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      المخزن:
                    </span>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {purchase.warehouse?.name || "-"}
                    </p>
                  </div>
                  {purchase.supplierInvoiceNo && (
                    <div className="col-span-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        رقم فاتورة المورد:
                      </span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">
                        {purchase.supplierInvoiceNo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                      inventory_2
                    </span>
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
                            سعر الشراء
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            سعر البيع
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            الإجمالي
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {purchase.items && purchase.items.length > 0 ? (
                          purchase.items.map((purchaseItem, index) => (
                            <tr
                              key={index}
                              className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                {index + 1}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                {purchaseItem.name ||
                                  purchaseItem.item?.name ||
                                  "-"}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                {Number(purchaseItem.quantity || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                {Number(
                                  purchaseItem.purchasePrice || 0
                                ).toFixed(2)}{" "}
                                ج.م
                              </td>
                              <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-medium">
                                {Number(purchaseItem.sellPrice || 0).toFixed(2)}{" "}
                                ج.م
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                                {Number(purchaseItem.total || 0).toFixed(2)} ج.م
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="6"
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
                    <span className="material-symbols-outlined text-primary">
                      calculate
                    </span>
                    ملخص الحسابات
                  </h3>
                  <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-700">
                      <span className="text-gray-600 dark:text-gray-400">
                        المجموع الفرعي:
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {Number(purchase.subtotal || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-700">
                      <span className="text-gray-600 dark:text-gray-400">
                        الخصم (
                        {purchase.discountType === "PERCENTAGE"
                          ? `%${purchase.discountValue}`
                          : `${purchase.discountValue} ج.م`}
                        ):
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        - {Number(purchase.discountAmount || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b-2 border-gray-300 dark:border-zinc-600">
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        الصافي:
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {Number(purchase.netTotal || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">
                        المدفوع:
                      </span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {Number(purchase.paidAmount || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300 dark:border-zinc-600">
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        المتبقي:
                      </span>
                      <span
                        className={`text-lg font-bold ${Number(purchase.remaining || 0) > 0
                            ? "text-red-600"
                            : "text-green-600"
                          }`}>
                        {Number(purchase.remaining || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="material-symbols-outlined text-lg">
                          payment
                        </span>
                        <span>طريقة الدفع:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {getPaymentMethodLabel(purchase.paymentMethod)}
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

export default PurchaseDetailsModal;
