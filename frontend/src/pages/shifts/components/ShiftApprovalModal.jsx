import React, { useState } from "react";
import Modal from "../../../components/ui/Modal";
import apiClient from "../../../services/apiClient";
import { toast } from "react-hot-toast";
import { FaLock, FaUser } from "react-icons/fa";

const ShiftApprovalModal = ({ isOpen, onClose, shift, onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "فشل اعتماد الوردية";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUsername("");
    setPassword("");
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
