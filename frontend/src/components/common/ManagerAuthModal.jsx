import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaUser, FaLock, FaCheck, FaTimes } from "react-icons/fa";
import userService from "../../services/userService";
import toast from "react-hot-toast";

const ManagerAuthModal = ({
  isOpen,
  onClose,
  onVerify,
  branchId, // Optional: verify against specific branch managers
  title = "تصريح المدير",
  message = "يرجى إدخال بيانات المدير للمتابعة",
  actionLabel = "تأكيد",
}) => {
  const [managers, setManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchManagers();
    }
  }, [isOpen]);

  const fetchManagers = async () => {
    try {
      // Should add a generic getManagers endpoint or use existing branch one?
      // If branchId provided use it, else get all admins/managers (TODO: Implement generic call if needed)
      // For now, if branchId is missing, assume current user's branch or global fetch?
      // Reusing getBranchManagers for now as our primary usecase is POS in a branch.
      // If branchId is null, we might need to handle it.

      // Fallback: If no branchId, maybe fetch all managers?
      // Let's rely on the passed branchId for now, typical in POS.
      const targetBranchId = branchId || 1; // Default to main branch if missing (risky?)
      const data = await userService.getBranchManagers(targetBranchId);
      setManagers(data || []);
      if (data && data.length > 0) {
        // Try to find a manager different from current user if possible?
        // No, just select first one.
        setSelectedManager(data[0].username);
      }
    } catch (error) {
      console.error("Failed to fetch managers:", error);
      // Don't show error toast on mount repeatedly
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedManager || !password) {
      toast.error("يرجى إدخال اسم المدير وكلمة المرور");
      return;
    }

    setLoading(true);
    try {
      await onVerify(selectedManager, password);
      // Parent handles closing
      setPassword("");
    } catch (error) {
      console.error("Verification failed", error);
      // Error toast handled by parent usually, or we can do it here if parent throws
      toast.error(error.response?.data?.error || "فشل التحقق من المدير");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-2xl text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaLock /> {title}
          </h2>
          <p className="text-red-100 text-sm mt-1">{message}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Manager Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                <FaUser className="inline mr-2" />
                المدير
              </label>
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
                required>
                {managers.length === 0 ? (
                  <option value="">جاري التحميل...</option>
                ) : (
                  managers.map((manager) => (
                    <option key={manager.id} value={manager.username}>
                      {manager.name} ({manager.role?.name})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                <FaLock className="inline mr-2" />
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
                  placeholder="أدخل كلمة مرور المدير"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || managers.length === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                <FaCheck className="w-5 h-5" />
                <span>{loading ? "جاري التحقق..." : actionLabel}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2">
                <FaTimes className="w-5 h-5" />
                <span>إلغاء</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ManagerAuthModal;
