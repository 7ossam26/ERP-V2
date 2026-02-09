import React from "react";
import { createPortal } from "react-dom";
import { FaTruck, FaTimes, FaExclamationTriangle } from "react-icons/fa";

const PendingDeliveriesModal = ({ isOpen, onClose, pendingOrders }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all border border-red-200 dark:border-red-900 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <FaTruck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">لا يمكن إنهاء الوردية</h2>
              <p className="text-red-100 text-sm mt-1 opacity-90">
                يوجد طلبات توصيل معلقة يجب تسويتها أولاً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-lg">
            <FaTimes />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 mb-4 flex items-start gap-3">
            <FaExclamationTriangle className="text-red-500 mt-1 flex-shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
              يجب عليك الذهاب إلى شاشة <strong>"تسوية التوصيل"</strong> وتسوية
              الطلبات التالية قبل إغلاق الوردية.
            </div>
          </div>

          {pendingOrders && pendingOrders.length > 0 && (
            <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 sticky top-0 bg-white dark:bg-gray-800 py-2 border-b border-gray-100 dark:border-gray-700 z-10">
                قائمة الطلبات المعلقة ({pendingOrders.length})
              </h4>
              <ul className="space-y-3">
                {pendingOrders.map((order, idx) => (
                  <li
                    key={idx}
                    className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600 flex justify-between items-center group hover:border-red-200 dark:hover:border-red-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-white dark:bg-gray-600 w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm font-bold text-gray-700 dark:text-gray-200">
                        📦
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white text-sm">
                          {order.saleNumber}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <span>👤</span>
                          <span>{order.deliveryMan}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-gray-900 dark:text-white">
                        {parseFloat(order.amount).toFixed(2)}
                        <span className="text-xs font-normal text-gray-500 mr-1">
                          ج.م
                        </span>
                      </div>
                      <div className="text-[10px] text-red-500 font-medium">
                        غير مسددة
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors w-full sm:w-auto text-center">
              فهمت
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PendingDeliveriesModal;
