import React, { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import apiClient from "../../../services/apiClient";
import { settingsService } from "../../../services/settingsService";
import printShiftReport from "../../../utils/printShiftReport";
import { toast } from "react-hot-toast";
import {
  FaPrint,
  FaMoneyBillWave,
  FaCreditCard,
  FaShoppingCart,
  FaCoins,
} from "react-icons/fa";

const ShiftReportModal = ({ isOpen, onClose, shiftId }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (isOpen && shiftId) {
      fetchReport();
    } else {
      setReport(null);
    }
  }, [isOpen, shiftId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const [res, cfg] = await Promise.all([
        apiClient.get(`/shifts/${shiftId}/report`),
        settingsService.get().catch(() => null),
      ]);
      setReport({ ...res, shiftId });
      setSettings(cfg || null);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "فشل تحميل تقرير الوردية");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!report) return;
    printShiftReport(report, settings || {});
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`تقرير وردية #${shiftId}`}>
      {loading ? (
        <div className="p-8 text-center text-gray-500">
          جاري تحميل البيانات...
        </div>
      ) : report ? (
        <div className="space-y-6 text-right font-cairo" dir="rtl">
          {/* Header Info */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">الموظف</p>
              <p className="font-bold text-lg">{report.employeeName}</p>
            </div>
            <div>
              <p className="text-gray-500">الفرع</p>
              <p className="font-bold">{report.branchName}</p>
            </div>
            <div>
              <p className="text-gray-500">نوع الوردية</p>
              <p className="font-bold">{report.shiftName}</p>
            </div>
            <div>
              <p className="text-gray-500">بداية الوردية</p>
              <p className="font-mono font-bold" dir="ltr">
                {new Date(report.startTime).toLocaleString("ar-EG")}
              </p>
            </div>
            <div>
              <p className="text-gray-500">نهاية الوردية</p>
              <p className="font-mono font-bold" dir="ltr">
                {report.endTime
                  ? new Date(report.endTime).toLocaleString("ar-EG")
                  : "مفتوحة"}
              </p>
            </div>
          </div>

          {/* Money Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Sales */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3 mb-2 text-blue-600">
                <FaShoppingCart />
                <h4 className="font-bold">إجمالي المبيعات</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.totalSales.toLocaleString()} ج.م
              </p>
            </div>

            {/* Cash Received */}
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <div className="flex items-center gap-3 mb-2 text-green-600">
                <FaMoneyBillWave />
                <h4 className="font-bold">مبيعات كاش</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.cashReceived.toLocaleString()} ج.م
              </p>
            </div>

            {/* Visa Payments */}
            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
              <div className="flex items-center gap-3 mb-2 text-sky-600">
                <FaCreditCard />
                <h4 className="font-bold">مبيعات فيزا</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {Number(report.expectedVisa ?? report.visaPayments ?? 0).toLocaleString()} ج.م
              </p>
            </div>

            {/* InstaPay Payments */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <div className="flex items-center gap-3 mb-2 text-purple-600">
                <FaCreditCard />
                <h4 className="font-bold">مبيعات انستاباي</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {Number(report.expectedInstapay ?? report.instapayPayments ?? 0).toLocaleString()} ج.م
              </p>
            </div>

            {/* Expenses */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="flex items-center gap-3 mb-2 text-red-600">
                <FaCoins />
                <h4 className="font-bold">المصروفات</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.totalExpenses.toLocaleString()} ج.م
              </p>
            </div>

            {/* Employee Advances */}
            {(report.totalAdvances ?? 0) > 0 && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <div className="flex items-center gap-3 mb-2 text-orange-600">
                  <FaCoins />
                  <h4 className="font-bold">سلف الموظفين</h4>
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {Number(report.totalAdvances).toLocaleString()} ج.م
                </p>
              </div>
            )}
          </div>

          {/* Order History */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mt-6">
            <div className="bg-gray-100 px-4 py-3 font-bold text-gray-700 border-b border-gray-200 flex justify-between items-center">
              <span>سجل الطلبات</span>
              <span className="text-xs font-normal bg-gray-200 px-2 py-1 rounded-full">
                {report.orders?.length || 0} طلب
              </span>
            </div>
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">التوقيت</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">الإجمالي (ج.م)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.orders && report.orders.length > 0 ? (
                    report.orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/50">
                        <td className="p-3 font-mono text-gray-600">
                          {order.saleNumber}
                        </td>
                        <td className="p-3 font-bold">{order.clientName}</td>
                        <td className="p-3 text-gray-500" dir="ltr">
                          {new Date(order.time).toLocaleTimeString("ar-EG")}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              order.paymentMethod === "CASH"
                                ? "bg-green-100 text-green-700"
                                : order.paymentMethod === "VISA"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                            }`}>
                            {order.paymentMethod === "CASH"
                              ? "نقدي"
                              : order.paymentMethod === "VISA"
                                ? "فيزا"
                                : "انستاباي"}
                          </span>
                        </td>
                        <td className="p-3 font-bold">
                          {order.total.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-400">
                        لا توجد طلبات في هذه الوردية
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Settlement */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 border-b border-gray-200">
              تسوية العهدة
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span>رصيد البداية</span>
                <span className="font-mono font-bold">
                  {report.startCash.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-green-600">
                <span>+ مبيعات الكاش</span>
                <span className="font-mono font-bold">
                  {report.cashReceived.toLocaleString()}
                </span>
              </div>
              {report.cashBreakdown && (
                <div className="ps-4 pb-2 border-b border-gray-100 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>• تسويات الدليفري</span>
                    <span className="font-mono">
                      {Number(
                        report.cashBreakdown.codDeliveredThisShift || 0,
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-red-600">
                <span>- المصروفات (كاش)</span>
                <span className="font-mono font-bold">
                  {Number(report.expenseBreakdown?.total ?? 0).toLocaleString()}
                </span>
              </div>
              {(report.totalAdvances ?? 0) > 0 && (
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-orange-600">
                  <span>- سلف الموظفين (كاش)</span>
                  <span className="font-mono font-bold">
                    {Number(report.totalAdvances).toLocaleString()}
                  </span>
                </div>
              )}
              {(report.pilotSettlementDifference ?? 0) > 0 && (
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-orange-600">
                  <span>- فرق تسوية الطيارين (كاش)</span>
                  <span className="font-mono font-bold">
                    {Number(report.pilotSettlementDifference).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 bg-gray-50 rounded px-2 font-bold">
                <span>= المتوقع في الدرج</span>
                <span className="font-mono text-xl">
                  {report.systemExpectedCash.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-2 border-t pt-2">
                <span>العد الفعلي</span>
                <span className="font-mono font-bold">
                  {report.actualCash.toLocaleString()}
                </span>
              </div>
              <div
                className={`flex justify-between items-center py-2 px-2 rounded font-bold ${report.shortage < 0 ? "bg-red-100 text-red-700" : report.shortage > 0 ? "bg-green-100 text-green-700" : "bg-green-50 text-green-700"}`}>
                <span>العجز / الزيادة (كاش فقط)</span>
                <span className="font-mono text-lg">
                  {report.shortage.toLocaleString()}
                </span>
              </div>

              {/* Digital payment reconciliation — auto-trusted, no variance prompt */}
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <div className="text-xs text-gray-500 italic">
                  مبيعات رقمية — موثوقة تلقائياً (لا تحتاج عد)
                </div>
                <div className="flex justify-between items-center py-1 px-2 bg-blue-50 rounded">
                  <span className="text-blue-700">فيزا</span>
                  <span className="font-mono font-bold text-blue-700">
                    {Number(report.expectedVisa ?? 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 px-2 bg-purple-50 rounded">
                  <span className="text-purple-700">انستاباي</span>
                  <span className="font-mono font-bold text-purple-700">
                    {Number(report.expectedInstapay ?? 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Breakdown */}
          {report.expenses && report.expenses.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 font-bold text-gray-700 border-b border-gray-200 flex justify-between items-center">
                <span>تفاصيل المصروفات</span>
                <span className="text-xs font-normal bg-red-100 text-red-700 px-2 py-1 rounded-full">
                  {report.expenses.length} مصروف
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="p-3">الوصف</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">المبلغ (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.expenses.map((expense, index) => (
                      <tr key={index} className="hover:bg-gray-50/50">
                        <td className="p-3 font-medium">{expense.description}</td>
                        <td className="p-3 text-sm text-gray-600">
                          {expense.category?.name || "غير مصنف"}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${expense.paymentMethod === "CASH" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {expense.paymentMethod === "CASH" ? "نقدي" : "بطاقة"}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-red-600">
                          {expense.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan="3" className="p-3 font-bold text-gray-700">الإجمالي</td>
                      <td className="p-3 font-bold text-red-600">
                        {report.totalExpenses.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Advances Breakdown */}
          {report.advances && report.advances.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 font-bold text-gray-700 border-b border-gray-200 flex justify-between items-center">
                <span>تفاصيل سلف الموظفين</span>
                <span className="text-xs font-normal bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  {report.advances.length} سلفة
                </span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">السبب</th>
                      <th className="p-3">المبلغ (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.advances.map((adv, index) => (
                      <tr key={index} className="hover:bg-gray-50/50">
                        <td className="p-3 font-medium">{adv.employeeName}</td>
                        <td className="p-3 text-sm text-gray-600">
                          {adv.reason || "—"}
                        </td>
                        <td className="p-3 font-bold text-orange-600">
                          {Number(adv.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan="2" className="p-3 font-bold text-gray-700">
                        الإجمالي
                      </td>
                      <td className="p-3 font-bold text-orange-600">
                        {Number(report.totalAdvances).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
              <FaPrint />
              طباعة التقرير
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
              إغلاق
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-red-500">لا توجد بيانات للعرض</div>
      )}
    </Modal>
  );
};

export default ShiftReportModal;
