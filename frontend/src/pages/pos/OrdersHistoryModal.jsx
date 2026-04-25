import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  History,
  Search,
  X,
  RotateCw,
  Receipt,
} from "lucide-react";
import { shiftService } from "../../services/domainServices";
import toast from "react-hot-toast";

const OrdersHistoryModal = ({ isOpen, onClose, shiftId, onRefundClick }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen && shiftId) {
      fetchOrders();
    }
  }, [isOpen, shiftId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Using getReport to fetch orders.
      // Ideally we should have a lighter endpoint like /shifts/:id/orders,
      // but getReport was modified in plan to include 'orders'.
      // Let's assume the previous backend logic (which I read earlier) already provides this or we need to add it?
      // Wait, I saw backend routes/shifts.js earlier. It has /:id/report.
      // It fetches sales and maps them to simplified objects.
      // Let's verify if I need to update backend to send `orders` array inside report.
      // I'll check my memory or file content.
      // In step 125, I read shifts.js. Lines 593-600 map `orders`.
      // Line 665 adds `orders: orders` to response.
      // So YES, it is already there!

      const report = await shiftService.getReport(shiftId);
      if (report && report.orders) {
        setOrders(report.orders);
      }
    } catch (error) {
      console.error("Fetch orders failed:", error);
      toast.error(error.message || "فشل تحميل سجل الطلبات");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.clientName &&
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-end bg-black/20 backdrop-blur-sm"
      style={{ direction: "rtl" }}
      onClick={onClose}>
      {/* Sidebar-like Modal from Right (or Left in RTL, actually 'start' is Right in RTL) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 w-full max-w-lg h-full shadow-2xl flex flex-col transform transition-transform animate-slide-in-right border-l border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History size={16} /> سجل فواتير الوردية
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-blue-700 p-2 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Sub-header / Stats */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-blue-100 dark:border-blue-900/50">
          <div className="flex justify-between text-sm text-blue-800 dark:text-blue-200">
            <span>
              عدد الفواتير: <strong>{orders.length}</strong>
            </span>

          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم الفاتورة أو اسم العميل..."
              className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-900"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50 dark:bg-gray-900">
          {loading ? (
            <div className="text-center py-10 text-gray-500">
              جاري التحميل...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-10 text-gray-500 flex flex-col items-center">
              <Receipt size={16} className="text-4xl mb-2 opacity-20" />
              <p>لا توجد فواتير مطابقة</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      {order.saleNumber}
                      <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 text-green-700 bg-opacity-50">
                        {new Date(order.time).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {order.clientName}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg text-blue-600">
                      {order.total.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400 uppercase">
                      {order.paymentMethod}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      onRefundClick(order.saleNumber); // Pass sale number to parent
                      // onClose(); // Optional: Close history or keep it open? Better close to focus on refund.
                    }}
                    className="px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center gap-1 transition-colors">
                    <RotateCw size={16} /> استرجاع
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OrdersHistoryModal;
