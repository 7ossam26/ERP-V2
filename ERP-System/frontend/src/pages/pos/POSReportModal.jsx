import React from "react";

const POSReportModal = ({
  isOpen,
  onClose,
  onConfirm,
  totalSales = "5,420.00",
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}></div>

        {/* Centering trick */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true">
          ​
        </span>

        {/* Modal Content */}
        <div
          className="inline-block align-bottom bg-white dark:bg-card-dark rounded-lg text-right overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-gray-200 dark:border-zinc-700 font-sans"
          dir="rtl">
          <div className="bg-white dark:bg-card-dark px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:mr-0 sm:text-right w-full">
                <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-zinc-700 pb-3">
                  <h3
                    className="text-xl leading-6 font-bold text-gray-900 dark:text-white flex items-center gap-2"
                    id="modal-title">
                    <span className="material-symbols-outlined text-primary">
                      summarize
                    </span>
                    تقرير نهاية الوردية
                  </h3>
                  <button
                    onClick={onClose}
                    className="bg-white dark:bg-zinc-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                    type="button">
                    <span className="sr-only">إغلاق</span>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-700">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        اسم الموظف
                      </span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        أحمد محمد
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        التاريخ
                      </span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        2023-10-27
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        الوردية
                      </span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        صباحية
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-900">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        إجمالي المبيعات
                      </p>
                      <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">
                        {totalSales} ج.م
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        النقد المستلم
                      </p>
                      <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">
                        3,150.00 ج.م
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-900">
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        مدفوعات البطاقة
                      </p>
                      <p className="mt-1 text-2xl font-bold text-purple-900 dark:text-purple-100">
                        2,270.00 ج.م
                      </p>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-zinc-700 mb-6">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                      <thead className="bg-gray-50 dark:bg-zinc-800">
                        <tr>
                          <th
                            className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                            scope="col">
                            النوع
                          </th>
                          <th
                            className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                            scope="col">
                            عدد القطع المباعة
                          </th>
                          <th
                            className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                            scope="col">
                            الإجمالي
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-card-dark divide-y divide-gray-200 dark:divide-zinc-700">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            مشروبات ساخنة
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            45
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold">
                            2,150.00 ج.م
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            مشروبات باردة
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            22
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold">
                            1,870.00 ج.م
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            معجنات
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            30
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold">
                            950.00 ج.م
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            حبوب بن
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            5
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold">
                            450.00 ج.م
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-zinc-800">
                        <tr>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                            المجموع الكلي
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                            102
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-primary dark:text-primary-dark">
                            {totalSales} ج.م
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded border border-amber-200 dark:border-amber-800 text-sm">
                    <span className="material-symbols-outlined">info</span>
                    <span>
                      يرجى التأكد من مطابقة النقد الفعلي في الدرج مع "النقد
                      المستلم" قبل إغلاق الوردية.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
            <button
              onClick={onConfirm}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary hover:bg-primary-dark text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:ml-3 sm:w-auto sm:text-sm"
              type="button">
              تأكيد وإغلاق الوردية
            </button>
            <button
              onClick={() => window.print()}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-zinc-600 shadow-sm px-4 py-2 bg-white dark:bg-card-dark text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              type="button">
              طباعة التقرير
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSReportModal;
