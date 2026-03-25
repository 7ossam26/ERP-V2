import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { salesService } from "../../services/salesService";

const PreparationQueueModal = ({ isOpen, onClose, deliveryMen = [] }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [selectedRiders, setSelectedRiders] = useState({}); // { [orderId]: riderId }

  useEffect(() => {
    if (isOpen) fetchOrders();
  }, [isOpen]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await salesService.getPreparationQueue();
      setOrders(data || []);
    } catch (error) {
      console.error("Failed to load preparation queue:", error);
      toast.error(error.message || "فشل تحميل قسم التجهيز");
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async (orderId) => {
    const riderId = selectedRiders[orderId];
    if (!riderId) {
      toast.error("يرجى اختيار طيار للإرسال");
      return;
    }

    try {
      setDispatchingId(orderId);
      await salesService.dispatchDelivery(orderId, riderId);
      toast.success("تم إرسال الطلب للطيار");
      // Remove from local list
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelectedRiders((prev) => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });
    } catch (error) {
      console.error("Dispatch failed:", error);
      toast.error(error.message || "فشل الإرسال");
    } finally {
      setDispatchingId(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 rounded-t-2xl text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl">kitchen</span>
            <div>
              <h2 className="text-xl font-bold">قسم التجهيز</h2>
              <p className="text-blue-100 text-sm">
                {orders.length} طلب بانتظار التوصيل
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="تحديث">
              <span
                className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>
                refresh
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              جاري التحميل...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <span className="material-symbols-outlined text-5xl mb-3 block text-gray-300">
                check_circle
              </span>
              <p className="font-medium">لا توجد طلبات في قسم التجهيز</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-900/50">
                  {/* Order header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
                          #{order.saleNumber}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                          تجهيز
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 dark:text-white mt-1">
                        {order.client?.name || "عميل نقدي"}
                      </p>
                      {order.client?.phone && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {order.client.phone}
                        </p>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-lg text-gray-800 dark:text-white">
                        {parseFloat(order.total).toFixed(2)} ج.م
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(order.createdAt).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Zone & Address */}
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <span className="material-symbols-outlined text-orange-500 text-base">
                      location_on
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {order.deliveryZone?.name}
                    </span>
                    {order.deliveryAddress && (
                      <span className="text-gray-500 dark:text-gray-400 truncate">
                        — {order.deliveryAddress}
                      </span>
                    )}
                  </div>

                  {/* Items summary */}
                  {order.items && order.items.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 bg-white dark:bg-gray-800 rounded-lg p-2">
                      {order.items.map((si, i) => (
                        <span key={i}>
                          {si.item?.name || si.bom?.name} ×{" "}
                          {parseFloat(si.quantity).toFixed(2)}
                          {i < order.items.length - 1 ? " ، " : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Dispatch row */}
                  <div className="flex gap-2">
                    <select
                      value={selectedRiders[order.id] || ""}
                      onChange={(e) =>
                        setSelectedRiders((prev) => ({
                          ...prev,
                          [order.id]: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500">
                      <option value="">-- اختر طيار --</option>
                      {deliveryMen.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDispatch(order.id)}
                      disabled={
                        !selectedRiders[order.id] || dispatchingId === order.id
                      }
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold rounded-lg transition-colors text-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">
                        local_shipping
                      </span>
                      {dispatchingId === order.id ? "..." : "توصيل"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PreparationQueueModal;
