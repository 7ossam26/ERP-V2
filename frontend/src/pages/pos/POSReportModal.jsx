import React from "react";
import { createPortal } from "react-dom";

const POSReportModal = ({ isOpen, onClose, onConfirm, reportData }) => {
  if (!isOpen) return null;

  const employeeName = reportData?.employeeName || "غير معروف";
  const shiftName = reportData?.shiftName || "وردية";
  const branchName = reportData?.branchName || "";
  const date = reportData?.date
    ? new Date(reportData.date).toLocaleDateString("ar-EG")
    : new Date().toLocaleDateString("ar-EG");
  const startTime = reportData?.startTime
    ? new Date(reportData.startTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    : "";
  const endTime = reportData?.endTime
    ? new Date(reportData.endTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    : "";

  const instapayPayments = reportData?.cardPayments || 0;
  const cashReceived = reportData?.cashReceived || 0;
  const totalAmount = reportData?.totalSales || 0;
  const totalExpenses = reportData?.totalExpenses || 0;
  const startCash = reportData?.startCash || 0;
  const systemExpectedCash = reportData?.systemExpectedCash || 0;
  const actualCash = reportData?.actualCash || 0;
  const shortage = reportData?.shortage || 0;

  const salesDetails = reportData?.salesDetails || [];
  const deliveryDetails = reportData?.deliveryDetails || [];
  const expenses = reportData?.expenses || [];

  const handlePrint = () => window.print();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:inset-auto print:relative">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:rounded-none print:shadow-none">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800 print:hidden">
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

        {/* Print header */}
        <div className="hidden print:block text-center border-b-2 border-gray-800 pb-3 mb-4 px-6 pt-4">
          <h1 className="text-2xl font-bold">تقرير نهاية الوردية</h1>
          {branchName && <p className="text-lg">{branchName}</p>}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 print:overflow-visible">

          {/* Info Board */}
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-4 flex flex-wrap justify-between items-center mb-6 text-sm sm:text-base print:bg-gray-100 print:rounded-xl">
            <div className="text-center sm:text-right">
              <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">اسم الموظف</span>
              <span className="font-bold text-gray-800 dark:text-white">{employeeName}</span>
            </div>
            <div className="text-center">
              <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">التاريخ</span>
              <span className="font-bold text-gray-800 dark:text-white">{date}</span>
            </div>
            <div className="text-center">
              <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">الوردية</span>
              <span className="font-bold text-gray-800 dark:text-white">{shiftName}</span>
            </div>
            {startTime && (
              <div className="text-center sm:text-left">
                <span className="block text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-1">البداية / النهاية</span>
                <span className="font-bold text-gray-800 dark:text-white">{startTime} — {endTime}</span>
              </div>
            )}
          </div>

          {/* Sales Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-5 text-center border border-purple-100 dark:border-purple-900/20 print:border print:border-purple-300">
              <span className="block text-purple-600 dark:text-purple-400 font-medium mb-1 text-sm">مبيعات InstaPay</span>
              <span className="block text-2xl font-bold text-purple-800 dark:text-purple-300">
                {instapayPayments.toLocaleString()} ج.م
              </span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-5 text-center border border-blue-100 dark:border-blue-900/20 print:border print:border-blue-300">
              <span className="block text-blue-600 dark:text-blue-400 font-medium mb-1 text-sm">مبيعات نقدي</span>
              <span className="block text-2xl font-bold text-blue-800 dark:text-blue-300">
                {cashReceived.toLocaleString()} ج.م
              </span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-5 text-center border border-green-100 dark:border-green-900/20 print:border print:border-green-300">
              <span className="block text-green-600 dark:text-green-400 font-medium mb-1 text-sm">إجمالي المبيعات</span>
              <span className="block text-2xl font-bold text-green-800 dark:text-green-300">
                {totalAmount.toLocaleString()} ج.م
              </span>
            </div>
          </div>

          {/* Cash Settlement */}
          <div className="border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden mb-6 print:border-gray-400">
            <div className="bg-gray-50 dark:bg-zinc-800/50 px-5 py-3 font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">account_balance</span>
              تسوية النقدية
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-zinc-700">
                <span className="text-gray-600 dark:text-gray-400">رصيد البداية</span>
                <span className="font-mono font-bold">{startCash.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-zinc-700 text-green-600">
                <span>+ مبيعات نقدي</span>
                <span className="font-mono font-bold">+{cashReceived.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-zinc-700 text-red-600">
                <span>- مصروفات</span>
                <span className="font-mono font-bold">-{totalExpenses.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-3 px-3 bg-gray-50 dark:bg-zinc-800 rounded-xl font-bold text-gray-800 dark:text-white">
                <span>= المتوقع في الدرج</span>
                <span className="font-mono text-lg">{systemExpectedCash.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3">
                <span className="text-gray-600 dark:text-gray-400">العد الفعلي</span>
                <span className="font-mono font-bold text-blue-600">{actualCash.toLocaleString()} ج.م</span>
              </div>
              <div className={`flex justify-between items-center py-2 px-3 rounded-xl font-bold ${
                shortage < 0
                  ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  : shortage > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400"
              }`}>
                <span>{shortage < 0 ? "⚠️ عجز" : shortage > 0 ? "✅ زيادة" : "✅ متطابق"}</span>
                <span className="font-mono text-lg">{Math.abs(shortage).toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          {expenses.length > 0 && (
            <div className="border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden mb-6 print:border-gray-400">
              <div className="bg-red-50 dark:bg-red-900/10 px-5 py-3 font-bold text-red-700 dark:text-red-400 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                المصروفات ({expenses.length})
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-700">
                {expenses.map((exp, i) => (
                  <div key={i} className="px-5 py-3 flex justify-between items-center text-sm">
                    <span className="font-bold text-red-600">{exp.amount.toLocaleString()} ج.م</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded">{exp.paymentMethod === "CASH" ? "نقدي" : "InstaPay"}</span>
                    <span className="text-gray-700 dark:text-gray-300">{exp.description}</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between items-center font-bold bg-gray-50 dark:bg-zinc-800/50">
                  <span className="text-red-600">{totalExpenses.toLocaleString()} ج.م</span>
                  <span className="text-gray-600 dark:text-gray-400">الإجمالي</span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Breakdown */}
          {deliveryDetails.length > 0 && (
            <div className="border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden mb-6 print:border-gray-400">
              <div className="bg-orange-50 dark:bg-orange-900/10 px-5 py-3 font-bold text-orange-700 dark:text-orange-400 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">local_shipping</span>
                التوصيل
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-700">
                {deliveryDetails.map((d, i) => (
                  <div key={i} className="px-5 py-3 flex justify-between items-center text-sm">
                    <span className="font-bold">{d.total.toLocaleString()} ج.م</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600">✓ {d.paidCount} مسلّم</span>
                      {d.pendingCount > 0 && (
                        <span className="text-orange-600">⏳ {d.pendingCount} معلق</span>
                      )}
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales Category Breakdown */}
          {salesDetails.length > 0 && (
            <div className="border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden mb-6 print:border-gray-400">
              <div className="bg-gray-50 dark:bg-zinc-800/50 px-5 py-3 flex justify-between text-sm font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-zinc-700">
                <span>الإجمالي</span>
                <span>الكمية</span>
                <span>النوع</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {salesDetails.map((item, index) => (
                  <div
                    key={index}
                    className="px-5 py-3 flex justify-between items-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors text-sm">
                    <span className="font-bold">{item.total.toLocaleString()} ج.م</span>
                    <span className="text-gray-500 dark:text-gray-400">{item.count}</span>
                    <span className="font-medium">{item.type}</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30 font-bold text-gray-800 dark:text-white text-sm">
                  <span>{totalAmount.toLocaleString()} ج.م</span>
                  <span>{salesDetails.reduce((sum, i) => sum + i.count, 0)}</span>
                  <span>المجموع</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900 print:hidden">
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex-1 bg-[#6F4E37] hover:bg-[#5D4030] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
              تأكيد وإغلاق الوردية
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            <span className="material-symbols-outlined text-lg">print</span>
            طباعة
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            إغلاق
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not([data-print-root]) { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default POSReportModal;
