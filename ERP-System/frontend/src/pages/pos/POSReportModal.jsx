import React from "react";
import { createPortal } from "react-dom";

const POSReportModal = ({ isOpen, onClose, onConfirm, totalSales = 0 }) => {
  if (!isOpen) return null;

  // Mock Data for the design
  const employeeName = "أحمد محمد";
  const shiftName = "صباحية";
  const date = "2023-10-27";

  const cardPayments = 2270.0;
  const cashReceived = 3150.0;
  const totalAmount =
    typeof totalSales === "number"
      ? totalSales
      : parseFloat(totalSales) || 5420.0;

  const salesDetails = [
    { type: "مشروبات ساخنة", count: 45, total: 2150.0 },
    { type: "مشروبات باردة", count: 22, total: 1870.0 },
    { type: "معجنات", count: 30, total: 950.0 },
    { type: "حبوب بن", count: 5, total: 450.0 },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              تقرير نهاية الوردية
            </h2>
            <span className="material-symbols-outlined text-3xl text-gray-700 dark:text-gray-300">
              summarize
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Info Board */}
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-4 flex flex-wrap justify-between items-center mb-6 text-sm sm:text-base">
            <div className="text-center sm:text-right">
              <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">
                اسم الموظف
              </span>
              <span className="font-bold text-gray-800 dark:text-white">
                {employeeName}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">
                التاريخ
              </span>
              <span className="font-bold text-gray-800 dark:text-white">
                {date}
              </span>
            </div>
            <div className="text-center sm:text-left">
              <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">
                الوردية
              </span>
              <span className="font-bold text-gray-800 dark:text-white">
                {shiftName}
              </span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Card Payments */}
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-6 text-center border border-purple-100 dark:border-purple-900/20">
              <span className="block text-purple-600 dark:text-purple-400 font-medium mb-2">
                مدفوعات البطاقة
              </span>
              <span className="block text-3xl font-bold text-purple-800 dark:text-purple-300">
                {cardPayments.toLocaleString()} ج.م
              </span>
            </div>

            {/* Cash Received */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 text-center border border-blue-100 dark:border-blue-900/20">
              <span className="block text-blue-600 dark:text-blue-400 font-medium mb-2">
                النقد المستلم
              </span>
              <span className="block text-3xl font-bold text-blue-800 dark:text-blue-300">
                {cashReceived.toLocaleString()} ج.م
              </span>
            </div>

            {/* Total Sales */}
            <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-6 text-center border border-green-100 dark:border-green-900/20">
              <span className="block text-green-600 dark:text-green-400 font-medium mb-2">
                إجمالي المبيعات
              </span>
              <span className="block text-3xl font-bold text-green-800 dark:text-green-300">
                {totalAmount.toLocaleString()} ج.م
              </span>
            </div>
          </div>

          {/* Sales Table */}
          <div className="border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden mb-6">
            <div className="bg-gray-50 dark:bg-zinc-800/50 px-6 py-3 flex justify-between text-sm font-bold text-gray-500 dark:text-gray-400">
              <span>الإجمالي</span>
              <span>عدد القطع المباعة</span>
              <span>النوع</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {salesDetails.map((item, index) => (
                <div
                  key={index}
                  className="px-6 py-4 flex justify-between items-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <span className="font-bold">
                    {item.total.toLocaleString()} ج.م
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {item.count}
                  </span>
                  <span className="font-medium">{item.type}</span>
                </div>
              ))}
              {/* Total Row */}
              <div className="px-6 py-4 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30 font-bold text-gray-800 dark:text-white">
                <span>{totalAmount.toLocaleString()} ج.م</span>
                <span>{salesDetails.reduce((sum, i) => sum + i.count, 0)}</span>
                <span>المجموع الكلي</span>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex items-center justify-center gap-3 text-amber-800 dark:text-amber-200">
            <span className="material-symbols-outlined text-2xl">info</span>
            <span className="font-medium">
              يرجى التأكد من مطابقة النقد الفعلي في الدرج مع "النقد المستلم" قبل
              إغلاق الوردية.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-4 bg-white dark:bg-zinc-900">
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#6F4E37] hover:bg-[#5D4030] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
            تأكيد وإغلاق الوردية
          </button>
          <button className="px-8 py-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            طباعة التقرير
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default POSReportModal;
