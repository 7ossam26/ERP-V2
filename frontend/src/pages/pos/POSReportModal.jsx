import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const TEXT = {
  unknownEmployee: "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
  shift: "\u0648\u0631\u062F\u064A\u0629",
  modalTitle: "\u062A\u0642\u0631\u064A\u0631 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0648\u0631\u062F\u064A\u0629",
  reportPrefix:
    "\u062A\u0642\u0631\u064A\u0631 \u0646\u0647\u0627\u064A\u0629 \u0648\u0631\u062F\u064A\u0629 \u0631\u0642\u0645",
  from: "\u0645\u0646",
  to: "\u0625\u0644\u0649",
  salesDetails:
    "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
  takeaway: "\u062A\u064A\u0643 \u0623\u0648\u0627\u0649 :",
  delivery: "\u062F\u0644\u064A\u0641\u0631\u0649 :",
  returned: "\u0645\u0631\u062A\u062C\u0639 :",
  driverDiscount: "\u062E\u0635\u0645 \u0627\u0644\u0633\u0627\u0626\u0642 :",
  invoiceDiscount: "\u062E\u0635\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 :",
  netSales: "\u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A :",
  cashMovement: "\u062D\u0631\u0643\u0629 \u0627\u0644\u0646\u0642\u062F\u064A\u0629",
  cashIn: "\u0646\u0642\u062F\u064A \u062F\u0627\u062E\u0644 :",
  expenseOut: "\u0645\u0635\u0631\u0648\u0641 \u062E\u0627\u0631\u062C :",
  customerCollections:
    "\u062A\u062D\u0635\u064A\u0644\u0627\u062A \u0639\u0645\u0644\u0627\u0621 :",
  customerCredit: "\u0623\u062C\u0644 \u0639\u0645\u0644\u0627\u0621 :",
  totals: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A",
  totalSalesLabel: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A :",
  visa: "\u0641\u064A\u0632\u0627 :",
  drawerAmount: "\u0627\u0644\u0645\u0628\u0644\u063A \u0641\u064A \u0627\u0644\u062F\u0631\u062C :",
  cashSettlement: "\u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0646\u0642\u062F\u064A\u0629",
  openingBalance: "\u0631\u0635\u064A\u062F \u0627\u0644\u0628\u062F\u0627\u064A\u0629",
  cashSalesPlus: "+ \u0645\u0628\u064A\u0639\u0627\u062A \u0646\u0642\u062F\u064A",
  depositsPlus: "+ \u0625\u064A\u062F\u0627\u0639\u0627\u062A",
  expensesMinus: "- \u0645\u0635\u0631\u0648\u0641\u0627\u062A",
  expectedDrawer: "= \u0627\u0644\u0645\u062A\u0648\u0642\u0639 \u0641\u064A \u0627\u0644\u062F\u0631\u062C",
  actualCount: "\u0627\u0644\u0639\u062F \u0627\u0644\u0641\u0639\u0644\u064A",
  shortage: "\u0639\u062C\u0632",
  overage: "\u0632\u064A\u0627\u062F\u0629",
  matched: "\u0645\u062A\u0637\u0627\u0628\u0642",
  expenseDetails:
    "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A",
  cash: "\u0646\u0642\u062F\u064A",
  deliveryDetails:
    "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u0648\u0635\u064A\u0644",
  delivered: "\u0645\u0633\u0644\u0651\u0645",
  pending: "\u0645\u0639\u0644\u0642",
  finish: "\u0625\u0646\u0647\u0627\u0621",
  print: "\u0637\u0628\u0627\u0639\u0629",
  close: "\u0625\u063A\u0644\u0627\u0642",
};

function ReportRow({
  label,
  count,
  amount,
  bold,
  border,
  negative,
  formatAmount,
}) {
  return (
    <div className={`flex items-center py-2.5 px-4 text-sm ${border ? "border-t-2 border-gray-300 dark:border-zinc-600" : "border-b border-gray-100 dark:border-zinc-800"} ${bold ? "font-bold bg-gray-50 dark:bg-zinc-800/50" : ""}`}>
      <span className="flex-1 text-right font-medium text-gray-700 dark:text-gray-200">
        {label}
      </span>
      {count !== undefined && (
        <span className="w-16 text-center font-mono text-gray-500 dark:text-gray-400">
          {count}
        </span>
      )}
      <span className={`w-32 text-left font-mono font-bold ${negative ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white"}`}>
        {negative && amount !== 0 ? "-" : ""}
        {formatAmount(Math.abs(amount))}
      </span>
    </div>
  );
}

const POSReportModal = ({
  isOpen,
  onClose,
  onConfirm,
  reportData,
  autoPrint = false,
}) => {
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

  const employeeName = reportData?.employeeName || TEXT.unknownEmployee;
  const shiftName = reportData?.shiftName || TEXT.shift;
  const branchName = reportData?.branchName || "";
  const shiftId = reportData?.shiftId || "";
  const date = reportData?.date
    ? new Date(reportData.date).toLocaleDateString("ar-EG")
    : new Date().toLocaleDateString("ar-EG");
  const startTime = reportData?.startTime
    ? new Date(reportData.startTime).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const endTime = reportData?.endTime
    ? new Date(reportData.endTime).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Still open";

  const cashReceived = reportData?.cashReceived || 0;
  const cardPayments = reportData?.cardPayments || 0;
  const totalSales = reportData?.totalSales || 0;
  const totalExpenses = reportData?.totalExpenses || 0;
  const startCash = reportData?.startCash || 0;
  const systemExpectedCash = reportData?.systemExpectedCash || 0;
  const actualCash = reportData?.actualCash || 0;
  const shortage = reportData?.shortage || 0;

  const takeaway = reportData?.takeaway || { count: 0, total: 0 };
  const delivery = reportData?.delivery || { count: 0, total: 0 };
  const returned = reportData?.returned || { count: 0, total: 0 };
  const netSales = reportData?.netSales || 0;
  const deposits = reportData?.deposits || { count: 0, total: 0 };
  const expenseBreakdown = reportData?.expenseBreakdown || {
    count: 0,
    total: 0,
  };
  const discounts = reportData?.discounts || {
    driverDiscount: { count: 0, total: 0 },
    invoiceDiscount: { count: 0, total: 0 },
  };
  const drawerAmount = reportData?.drawerAmount || 0;

  const expenses = reportData?.expenses || [];
  const deliveryDetails = reportData?.deliveryDetails || [];

  const fmt = (value) =>
    Number(value).toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handlePrint = () => window.print();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:inset-auto print:relative"
      data-print-root>
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:rounded-none print:shadow-none print:max-w-none">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800 print:hidden">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {TEXT.modalTitle}
            </h2>
            <span className="material-symbols-outlined text-2xl text-gray-600 dark:text-gray-400">
              summarize
            </span>
          </div>
        </div>

        <div
          className="overflow-y-auto custom-scrollbar flex-1 print:overflow-visible"
          dir="rtl">
          <div className="text-center py-5 px-6 border-b-2 border-gray-800 dark:border-zinc-300">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {TEXT.reportPrefix} {shiftId}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              {TEXT.from} {startTime} {date}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {TEXT.to} {endTime}
            </p>
            {branchName && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                {branchName} - {employeeName} - {shiftName}
              </p>
            )}
          </div>

          <div className="mx-4 mt-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 font-bold text-emerald-800 dark:text-emerald-300 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                point_of_sale
              </span>
              {TEXT.salesDetails}
            </div>
            <ReportRow
              label={TEXT.takeaway}
              count={takeaway.count}
              amount={takeaway.total}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.delivery}
              count={delivery.count}
              amount={delivery.total}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.returned}
              count={returned.count}
              amount={returned.total}
              negative={returned.total > 0}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.driverDiscount}
              count={discounts.driverDiscount.count}
              amount={discounts.driverDiscount.total}
              negative={discounts.driverDiscount.total > 0}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.invoiceDiscount}
              count={discounts.invoiceDiscount.count}
              amount={discounts.invoiceDiscount.total}
              negative={discounts.invoiceDiscount.total > 0}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.netSales}
              amount={netSales}
              bold
              border
              formatAmount={fmt}
            />
          </div>

          <div className="mx-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 font-bold text-blue-800 dark:text-blue-300 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                swap_vert
              </span>
              {TEXT.cashMovement}
            </div>
            <ReportRow
              label={TEXT.cashIn}
              count={deposits.count}
              amount={deposits.total}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.expenseOut}
              count={expenseBreakdown.count}
              amount={expenseBreakdown.total}
              negative
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.customerCollections}
              count={0}
              amount={0}
              formatAmount={fmt}
            />
            <ReportRow
              label={TEXT.customerCredit}
              count={0}
              amount={0}
              formatAmount={fmt}
            />
          </div>

          <div className="mx-4 mb-3 border-2 border-gray-300 dark:border-zinc-600 rounded-xl overflow-hidden print:border-gray-500 print:mx-0">
            <div className="bg-gray-100 dark:bg-zinc-800 px-4 py-2.5 font-bold text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-zinc-600 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                calculate
              </span>
              {TEXT.totals}
            </div>
            <div className="flex items-center py-3 px-4 text-sm border-b border-gray-200 dark:border-zinc-700">
              <span className="flex-1 text-right font-bold text-gray-800 dark:text-white">
                {TEXT.totalSalesLabel}
              </span>
              <span className="w-32 text-left font-mono font-bold text-lg text-gray-900 dark:text-white">
                {fmt(totalSales)}
              </span>
            </div>
            <div className="flex items-center py-3 px-4 text-sm border-b border-gray-200 dark:border-zinc-700">
              <span className="flex-1 text-right font-bold text-purple-700 dark:text-purple-400">
                {TEXT.visa}
              </span>
              <span className="w-32 text-left font-mono font-bold text-lg text-purple-700 dark:text-purple-400">
                {fmt(cardPayments)}
              </span>
            </div>
            <div className="flex items-center py-3 px-4 text-sm bg-amber-50 dark:bg-amber-900/20">
              <span className="flex-1 text-right font-bold text-amber-800 dark:text-amber-300">
                {TEXT.drawerAmount}
              </span>
              <span className="w-32 text-left font-mono font-bold text-lg text-amber-800 dark:text-amber-300">
                {fmt(drawerAmount)}
              </span>
            </div>
          </div>

          <div className="mx-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
            <div className="bg-gray-50 dark:bg-zinc-800/50 px-4 py-2.5 font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                account_balance
              </span>
              {TEXT.cashSettlement}
            </div>
            <div className="text-sm">
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800">
                <span className="flex-1 text-right text-gray-600 dark:text-gray-400">
                  {TEXT.openingBalance}
                </span>
                <span className="w-32 text-left font-mono font-bold">
                  {fmt(startCash)}
                </span>
              </div>
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800 text-green-600 dark:text-green-400">
                <span className="flex-1 text-right">{TEXT.cashSalesPlus}</span>
                <span className="w-32 text-left font-mono font-bold">
                  +{fmt(cashReceived)}
                </span>
              </div>
              {deposits.total > 0 && (
                <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800 text-green-600 dark:text-green-400">
                  <span className="flex-1 text-right">{TEXT.depositsPlus}</span>
                  <span className="w-32 text-left font-mono font-bold">
                    +{fmt(deposits.total)}
                  </span>
                </div>
              )}
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800 text-red-600 dark:text-red-400">
                <span className="flex-1 text-right">{TEXT.expensesMinus}</span>
                <span className="w-32 text-left font-mono font-bold">
                  -{fmt(totalExpenses)}
                </span>
              </div>
              <div className="flex items-center py-2.5 px-4 bg-gray-50 dark:bg-zinc-800 font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-zinc-700">
                <span className="flex-1 text-right">{TEXT.expectedDrawer}</span>
                <span className="w-32 text-left font-mono text-base">
                  {fmt(systemExpectedCash)}
                </span>
              </div>
              <div className="flex items-center py-2 px-4 border-b border-gray-100 dark:border-zinc-800">
                <span className="flex-1 text-right text-gray-600 dark:text-gray-400">
                  {TEXT.actualCount}
                </span>
                <span className="w-32 text-left font-mono font-bold text-blue-600 dark:text-blue-400">
                  {fmt(actualCash)}
                </span>
              </div>
              <div className={`flex items-center py-2.5 px-4 font-bold ${
                shortage < 0
                  ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              }`}>
                <span className="flex-1 text-right">
                  {shortage < 0
                    ? TEXT.shortage
                    : shortage > 0
                      ? TEXT.overage
                      : TEXT.matched}
                </span>
                <span className="w-32 text-left font-mono text-base">
                  {fmt(Math.abs(shortage))}
                </span>
              </div>
            </div>
          </div>

          {expenses.length > 0 && (
            <div className="mx-4 mb-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
              <div className="bg-red-50 dark:bg-red-900/10 px-4 py-2.5 font-bold text-red-700 dark:text-red-400 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  receipt_long
                </span>
                {TEXT.expenseDetails} ({expenses.length})
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {expenses.map((expense, index) => (
                  <div key={index} className="px-4 py-2 flex items-center text-sm">
                    <span className="flex-1 text-right text-gray-700 dark:text-gray-300">
                      {expense.description}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded mx-2">
                      {expense.paymentMethod === "CASH" ? TEXT.cash : "InstaPay"}
                    </span>
                    <span className="w-28 text-left font-mono font-bold text-red-600 dark:text-red-400">
                      {fmt(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deliveryDetails.length > 0 && (
            <div className="mx-4 mb-4 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden print:border-gray-400 print:mx-0">
              <div className="bg-orange-50 dark:bg-orange-900/10 px-4 py-2.5 font-bold text-orange-700 dark:text-orange-400 border-b border-gray-200 dark:border-zinc-700 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  local_shipping
                </span>
                {TEXT.deliveryDetails}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {deliveryDetails.map((deliveryItem, index) => (
                  <div key={index} className="px-4 py-2 flex items-center text-sm">
                    <span className="flex-1 text-right font-medium text-gray-700 dark:text-gray-300">
                      {deliveryItem.name}
                    </span>
                    <div className="flex gap-2 text-xs mx-2">
                      <span className="text-green-600">
                        {deliveryItem.paidCount} {TEXT.delivered}
                      </span>
                      {deliveryItem.pendingCount > 0 && (
                        <span className="text-orange-600">
                          {deliveryItem.pendingCount} {TEXT.pending}
                        </span>
                      )}
                    </div>
                    <span className="w-28 text-left font-mono font-bold">
                      {fmt(deliveryItem.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900 print:hidden">
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-[0.98]">
              {TEXT.finish}
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            <span className="material-symbols-outlined text-lg">print</span>
            {TEXT.print}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            {TEXT.close}
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          body > [data-print-root] { display: flex !important; }
          @page { size: A4; margin: 10mm; }
          [data-print-root] { background: white !important; position: static !important; }
          [data-print-root] [class*="bg-emerald"], [data-print-root] [class*="bg-blue-50"],
          [data-print-root] [class*="bg-gray-1"], [data-print-root] [class*="bg-red-50"],
          [data-print-root] [class*="bg-orange-50"], [data-print-root] [class*="bg-amber-50"] {
            background: #f5f5f5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default POSReportModal;
