import React, { useState } from "react";
import Modal from "../../../components/ui/Modal";
import apiClient from "../../../services/apiClient";
import { toast } from "react-hot-toast";
import { FaLock, FaUser } from "react-icons/fa";

const ShiftApprovalModal = ({ isOpen, onClose, shift, onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      await apiClient.post("/shifts/approve", {
        shiftId: shift.id,
        managerUsername: username,
        managerPassword: password,
      });
      toast.success("تم اعتماد الوردية بنجاح");
      if (onSuccess) onSuccess();
      handleClose();
    } catch (error) {
      console.error(error);
      const msg = error.data?.message || error.message || "فشل اعتماد الوردية";

      // Check for pending orders in error data (APIError structure)
      if (error.data?.pendingOrders) {
        setPendingOrders(error.data.pendingOrders);
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setPendingOrders(null);
    onClose();
  };

  if (!shift) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`اعتماد وردية #${shift.id}`}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg text-sm mb-4 border border-yellow-200">
          أنت على وشك إغلاق الوردية الخاصة بـ{" "}
          <strong className="font-bold">{shift.user?.name}</strong>. يرجى تأكيد
          العملية ببيانات الدخول الخاصة بالمدير.
        </div>

        {pendingOrders && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-4 max-h-60 overflow-y-auto">
            <h4 className="text-red-800 font-bold text-sm mb-2 flex items-center gap-2">
              ⚠️ طلبات معلقة ({pendingOrders.length})
            </h4>
            <ul className="space-y-2">
              {pendingOrders.map((order, idx) => (
                <li
                  key={idx}
                  className="bg-white p-2 rounded border border-red-100 text-sm flex justify-between items-center">
                  <span className="font-bold flex items-center gap-2">
                    📦 {order.saleNumber}
                  </span>
                  <div className="text-gray-600 text-xs flex flex-col items-end">
                    <span>👤 {order.deliveryMan}</span>
                    <span className="font-mono">
                      {parseFloat(order.amount).toFixed(2)} ج.م
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-red-600 text-center">
              يجب تسوية هذه الطلبات أولاً من شاشة "تسوية التوصيل"
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            اسم المستخدم (المدير)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">
              <FaUser />
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-colors"
              placeholder="Username"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            كلمة المرور
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">
              <FaLock />
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {loading ? "جاري الاعتماد..." : "تأكيد وإغلاق الوردية"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ShiftApprovalModal;
