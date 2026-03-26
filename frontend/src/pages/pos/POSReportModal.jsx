import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const POSReportModal = ({ isOpen, onClose, onConfirm, reportData, autoPrint = false }) => {
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (isOpen && autoPrint && !hasPrinted.current) {
      hasPrinted.current = true;
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
    if (!isOpen) hasPrinted.current = false;
  }, [isOpen, autoPrint]);

  if (!isOpen) return null;

  const employeeName = reportData?.employeeName || "غير معروف";
  const shiftName = reportData?.shiftName || "وردية";
  const branchName = reportData?.branchName || "";
  const shiftId = reportData?.shiftId || "";
  const date = reportData?.date
    ? new Date(reportData.date).toLocaleDateString("ar-EG")
    : new Date().toLocaleDateString("ar-EG");
  const startTime = reportData?.startTime
    ? new Date(reportData.startTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    : "";
  const endTime = reportData?.endTime
    ? new Date(reportData.endTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    : "Still open";

  const cashReceived = reportData?.cashReceived || 0;
  const cardPayments = reportData?.cardPayments || 0;
  const totalSales = reportData?.totalSales || 0;
  const totalExpenses = reportData?.totalExpenses || 0;
  const startCash = reportData?.startCash || 0;
  const systemExpectedCash = reportData?.systemExpectedCash || 0;
  const actualCash = reportData?.actualCash || 0;
  const shortage = reportData?.shortage || 0;

  // New breakdown data
  const takeaway = reportData?.takeaway || { count: 0, total: 0 };
  const delivery = reportData?.delivery || { count: 0, total: 0 };
  const returned = reportData?.returned || { count: 0, total: 0 };
  const netSales = reportData?.netSales || 0;
  const deposits = reportData?.deposits || { count: 0, total: 0 };
  const expenseBreakdown = reportData?.expenseBreakdown || { count: 0, total: 0 };
  const drawerAmount = reportData?.drawerAmount || 0;

  const expenses = reportData?.expenses || [];
  const deliveryDetails = reportData?.deliveryDetails || [];

  const fmt = (v) => Number(v).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePrint = () => window.print();

  // Table row helper
  const Row = ({ label, count, amount, bold, border, negative }) => (
    <div className={`flex items-center py-2.5 px-4 text-sm ${border ? "border-t-2 border-gray-300 dark:border-zinc-600" : "border-b border-gray-100 dark:border-zinc-800"} ${bold ? "font-bold bg-gray-50 dark:bg-zinc-800/50" : ""}`}>
      <span className="flex-1 text-right font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {count !== undefined && (
        <span className="w-16 text-center font-mono text-gray-500 dark:text-gray-400">{count}</span>
      )}
      <span className={`w-32 text-left font-mono font-bold ${negative ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white"}`}>
        {negative && amount !== 0 ? "-" : ""}{fmt(Math.abs(amount))}
      </span>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:inset-auto print:relative" data-print-root>
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:rounded-none print:shadow-none print:max-w-none">

        {/* Screen Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800 print:hidden">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">تقرير نهاية الوردية</h2>
            <span className="material-symbols-outlined text-2xl text-gray-600 dark:text-gray-400">summarize</span>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto custom-scrollbar flex-1 print:overflow-visible" dir="rtl">

          {/* Report Header */}
          <div className="text-center py-5 px-6 border-b-2 border-gray-800 dark:border-zinc-300">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">تقرير نهاية وردية رقم {shiftId}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              من {startTime} {date}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              إلى {endTime}
            </p>
            {branchName && <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{branchName} — {employeeName} — {shiftName}</p>}
          </div>

          {/* Sales Breakdown Section */}
          <div className="mx-4 mt-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 font-bold text-emerald-800 dark:text-emerald-300 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">point_of_sale</span>
              تفاصيل المبيعات
            </div>
            <Row label="تيك أواى :" count={takeaway.count} amount={takeaway.total} />
            <Row label="دليفرى :" count={delivery.count} amount={delivery.total} />
            <Row label="مرتجع :" count={returned.count} amount={returned.total} negative={returned.total > 0} />
            <Row label="صافي المبيعات :" amount={netSales} bold border />
          </div>

          {/* Cash Movements Section */}
          <div className="mx-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 font-bold text-blue-800 dark:text-blue-300 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">swap_vert</span>
              حركة النقدية
            </div>
            <Row label="نقدي داخل :" count={deposits.count} amount={deposits.total} />
            <Row label="مصروف خارج :" count={expenseBreakdown.count} amount={expenseBreakdown.total} negative />
            <Row label="تحصيلات عملاء :" count={0} amount={0} />
            <Row label="أجل عملاء :" count={0} amount={0} />
          </div>

          {/* Totals Section */}
          <div className="mx-4 mb-3 border-2 border-gray-300 dark:border-zinc-600 rounded-xl overflow-hidden print:border-gray-500 print:mx-0">
            <div className="bg-gray-100 dark:bg-zinc-800 px-4 py-2.5 font-bold text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-zinc-600 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">calculate</span>
              الإجمالي
            </div>
            <div className="flex items-center py-3 px-4 text-sm border-b border-gray-200 dark:border-zinc-700">
              <span className="flex-1 text-right font-bold text-gray-800 dark:text-white">إجمالي المبيعات :</span>
              <span className="w-32 text-left font-mono font-bold text-lg text-gray-900 dark:text-white">{fmt(totalSales)}</span>
            </div>
            <div className="flex items-center py-3 px-4 text-sm border-b border-gray-200 dark:border-zinc-700">
              <span className="flex-1 text-right font-bold text-purple-700 dark:text-purple-400">فيزا :</span>
              <span className="w-32 text-left font-mono font-bold text-lg text-purple-700 dark:text-purple-400">{fmt(cardPayments)}</span>
            </div>
            <div className="flex items-center py-3 px-4 text-sm bg-amber-50 dark:bg-amber-900/20">
              <span className="flex-1 text-right font-bold text-amber-800 dark:text-amber-300">المبلغ في الدرج :</span>
              <span className="w-32 text-left font-mono font-bold text-lg text-amber-800 dark:text-amber-300">{fmt(drawerAmount)}</span>
            </div>
          </div>

          {/* Cash Settlement */}
          <div className="mx-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
            <div className="bg-gray-50 dark:bg-zinc-800/50 px-4 py-2.5 font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">account_balance</span>
              تسوية النقدية
            </div>
            <div className="text-sm">
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800">
                <span className="flex-1 text-right text-gray-600 dark:text-gray-400">رصيد البداية</span>
                <span className="w-32 text-left font-mono font-bold">{fmt(startCash)}</span>
              </div>
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800 text-green-600 dark:text-green-400">
                <span className="flex-1 text-right">+ مبيعات نقدي</span>
                <span className="w-32 text-left font-mono font-bold">+{fmt(cashReceived)}</span>
              </div>
              {deposits.total > 0 && (
                <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800 text-green-600 dark:text-green-400">
                  <span className="flex-1 text-right">+ إيداعات</span>
                  <span className="w-32 text-left font-mono font-bold">+{fmt(deposits.total)}</span>
                </div>
              )}
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800 text-red-600 dark:text-red-400">
                <span className="flex-1 text-right">- مصروفات</span>
                <span className="w-32 text-left font-mono font-bold">-{fmt(totalExpenses)}</span>
              </div>
              <div className="flex items-center py-2.5 px-4 bg-gray-50 dark:bg-zinc-800 font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-zinc-700">
                <span className="flex-1 text-right">= المتوقع في الدرج</span>
                <span className="w-32 text-left font-mono text-base">{fmt(systemExpectedCash)}</span>
              </div>
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800">
                <span className="flex-1 text-right text-gray-600 dark:text-gray-400">العد الفعلي</span>
                <span className="w-32 text-left font-mono font-bold text-blue-600 dark:text-blue-400">{fmt(actualCash)}</span>
              </div>
              <div className={`flex items-center py-2.5 px-4 font-bold ${
                shortage < 0
                  ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              }`}>
                <span className="flex-1 text-right">{shortage < 0 ? "عجز" : shortage > 0 ? "زيادة" : "متطابق"}</span>
                <span className="w-32 text-left font-mono text-base">{fmt(Math.abs(shortage))}</span>
              </div>
            </div>
          </div>

          {/* Expenses Detail */}
          {expenses.length > 0 && (
            <div className="mx-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
              <div className="bg-red-50 dark:bg-red-900/10 px-4 py-2.5 font-bold text-red-700 dark:text-red-400 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                تفاصيل المصروفات ({expenses.length})
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {expenses.map((exp, i) => (
                  <div key={i} className="px-4 py-2 flex items-center text-sm">
                    <span className="flex-1 text-right text-gray-700 dark:text-gray-300">{exp.description}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded mx-2">{exp.paymentMethod === "CASH" ? "نقدي" : "InstaPay"}</span>
                    <span className="w-28 text-left font-mono font-bold text-red-600 dark:text-red-400">{fmt(exp.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Breakdown */}
          {deliveryDetails.length > 0 && (
            <div className="mx-4 mb-4 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
              <div className="bg-orange-50 dark:bg-orange-900/10 px-4 py-2.5 font-bold text-orange-700 dark:text-orange-400 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">local_shipping</span>
                تفاصيل التوصيل
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {deliveryDetails.map((d, i) => (
                  <div key={i} className="px-4 py-2 flex items-center text-sm">
                    <span className="flex-1 text-right font-medium text-gray-700 dark:text-gray-300">{d.name}</span>
                    <div className="flex gap-2 text-xs mx-2">
                      <span className="text-green-600">{d.paidCount} مسلّم</span>
                      {d.pendingCount > 0 && <span className="text-orange-600">{d.pendingCount} معلق</span>}
                    </div>
                    <span className="w-28 text-left font-mono font-bold">{fmt(d.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900 print:hidden">
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex-1 bg-[#6F4E37] hover:bg-[#5D4030] text-white font-bold py-3 px-5 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
              تأكيد وإغلاق الوردية
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            <span className="material-symbols-outlined text-lg">print</span>
            طباعة
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            إغلاق
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          body > [data-print-root], body > div:last-child { display: flex !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default POSReportModal;
