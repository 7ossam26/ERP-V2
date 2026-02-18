import React, { useState, useEffect } from "react";
import AuthService from "../../../services/authService";
import { settingsService } from "../../../services/domainServices";

const PurchaseDetailsModal = ({ isOpen, onClose, purchase }) => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsService.get();
        setSettings(data);
      } catch (error) {
        console.error("Failed to fetch settings for invoice print", error);
      }
    };
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

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
        <>
          {/* Print Only Section */}
          <div
            className="hidden print:block print:w-full p-8 bg-white text-black"
            dir="rtl">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-6">
              {/* Company Info (Right Side in RTL) */}
              <div className="flex items-center gap-4">
                <img
                  src="/assets/logo.png"
                  alt="Company Logo"
                  className="h-24 w-auto object-contain"
                  onError={(e) => (e.target.style.display = "none")}
                />
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {settings?.companyName || "اسم الشركة"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {/* Placeholder for Address if available in future */}
                    تقرير تفصيلي
                  </p>
                </div>
              </div>

              {/* Invoice Info (Left Side in RTL) */}
              <div className="text-left">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  فاتورة مشتريات
                </h1>
                <div className="text-sm space-y-1 text-gray-600 font-medium">
                  <p>
                    <span className="font-bold text-gray-900">
                      رقم الفاتورة:
                    </span>{" "}
                    #{purchase.id}
                  </p>
                  <p>
                    <span className="font-bold text-gray-900">التاريخ:</span>{" "}
                    {new Date(purchase.createdAt).toLocaleString("ar-EG")}
                  </p>
                  <p>
                    <span className="font-bold text-gray-900">طبع بواسطة:</span>{" "}
                    {AuthService.getCurrentUser()?.name || "مسؤول النظام"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm border-b-2 border-black pb-4">
              <div>
                <p>
                  <strong>المورد:</strong> {purchase.supplier?.name || "-"}
                </p>
                <p>
                  <strong>المخزن:</strong> {purchase.warehouse?.name || "-"}
                </p>
              </div>
              <div className="text-left">
                {purchase.supplierInvoiceNo && (
                  <p>
                    <strong>رقم فاتورة المورد:</strong>{" "}
                    {purchase.supplierInvoiceNo}
                  </p>
                )}
                <p>
                  <strong>طريقة الدفع:</strong>{" "}
                  {getPaymentMethodLabel(purchase.paymentMethod)}
                </p>
              </div>
            </div>

            <table className="w-full text-right border-collapse text-sm mb-6">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 px-2 font-bold w-[5%]">#</th>
                  <th className="py-2 px-2 font-bold w-[40%]">الصنف</th>
                  <th className="py-2 px-2 font-bold w-[15%] text-center">
                    الكمية
                  </th>
                  <th className="py-2 px-2 font-bold w-[20%] text-center">
                    السعر
                  </th>
                  <th className="py-2 px-2 font-bold w-[20%] text-left">
                    الإجمالي
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 px-2">{index + 1}</td>
                    <td className="py-2 px-2">
                      {item.name || item.item?.name}
                    </td>
                    <td className="py-2 px-2 text-center font-numbers">
                      {Number(item.quantity).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center font-numbers">
                      {Number(item.purchasePrice).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-left font-bold font-numbers">
                      {Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-1/3 border-t-2 border-black pt-2 text-sm text-left">
                <div className="flex justify-between mb-1">
                  <span>المجموع الفرعي:</span>
                  <span className="font-numbers">
                    {Number(purchase.subtotal).toFixed(2)}
                  </span>
                </div>
                {purchase.discountAmount > 0 && (
                  <div className="flex justify-between mb-1 text-red-600">
                    <span>الخصم:</span>
                    <span className="font-numbers">
                      -{Number(purchase.discountAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-1 mt-1">
                  <span>الصافي:</span>
                  <span className="font-numbers">
                    {Number(purchase.netTotal).toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex justify-between mt-2 text-gray-600">
                  <span>المدفوع:</span>
                  <span className="font-numbers">
                    {Number(purchase.paidAmount).toFixed(2)}
                  </span>
                </div>
                {Number(purchase.remaining) > 0 && (
                  <div className="flex justify-between mt-1 text-red-600 font-bold">
                    <span>المتبقي:</span>
                    <span className="font-numbers">
                      {Number(purchase.remaining).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center text-sm text-gray-500 border-t border-gray-300 pt-4">
              <p>تم استخراج هذه الفاتورة من النظام تلقائياً</p>
            </div>
          </div>

          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden"
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
                                  {Number(purchaseItem.quantity || 0).toFixed(
                                    2,
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                  {Number(
                                    purchaseItem.purchasePrice || 0,
                                  ).toFixed(2)}{" "}
                                  ج.م
                                </td>
                                <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-medium">
                                  {Number(purchaseItem.sellPrice || 0).toFixed(
                                    2,
                                  )}{" "}
                                  ج.م
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                                  {Number(purchaseItem.total || 0).toFixed(2)}{" "}
                                  ج.م
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
                          - {Number(purchase.discountAmount || 0).toFixed(2)}{" "}
                          ج.م
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
                          className={`text-lg font-bold ${
                            Number(purchase.remaining || 0) > 0
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
        </>
      )}
    </>
  );
};

export default PurchaseDetailsModal;
