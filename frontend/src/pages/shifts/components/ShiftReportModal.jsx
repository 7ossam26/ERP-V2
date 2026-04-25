import React, { useState, useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import apiClient from "../../../services/apiClient";
import { toast } from "react-hot-toast";
import {
  Printer,
  Banknote,
  CreditCard,
  ShoppingCart,
  Coins,
} from "lucide-react";

const ShiftReportModal = ({ isOpen, onClose, shiftId }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const res = await apiClient.get(`/shifts/${shiftId}/report`);
      setReport(res);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "فشل تحميل تقرير الوردية");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sales */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3 mb-2 text-blue-600">
                <ShoppingCart size={16} />
                <h4 className="font-bold">إجمالي المبيعات</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.totalSales.toLocaleString()} ج.م
              </p>
            </div>

            {/* Cash Received */}
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <div className="flex items-center gap-3 mb-2 text-green-600">
                <Banknote size={16} />
                <h4 className="font-bold">مبيعات كاش</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.cashReceived.toLocaleString()} ج.م
              </p>
            </div>

            {/* InstaPay Payments */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <div className="flex items-center gap-3 mb-2 text-purple-600">
                <CreditCard size={16} />
                <h4 className="font-bold">مبيعات InstaPay</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.cardPayments.toLocaleString()} ج.م
              </p>
            </div>

            {/* Expenses */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="flex items-center gap-3 mb-2 text-red-600">
                <Coins size={16} />
                <h4 className="font-bold">المصروفات</h4>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {report.totalExpenses.toLocaleString()} ج.م
              </p>
            </div>
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
                            className={`px-2 py-0.5 rounded text-xs ${order.paymentMethod === "CASH" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                            {order.paymentMethod === "CASH" ? "نقدي" : "InstaPay"}
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
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-red-600">
                <span>- المصروفات (كاش)</span>
                <span className="font-mono font-bold">
                  {report.totalExpenses.toLocaleString()}
                </span>
              </div>
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
                <span>العجز / الزيادة</span>
                <span className="font-mono text-lg">
                  {report.shortage.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
              <Printer size={16} />
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
