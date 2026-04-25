import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User, Lock, Check, X } from "lucide-react";
import userService from "../../services/userService";
import toast from "react-hot-toast";

const ShiftVerificationModal = ({
    isOpen,
    onClose,
    onVerify,
    branchId,
    shiftData // Contains: actualCash, systemExpectedCash, shortage, etc.
}) => {
    const [managers, setManagers] = useState([]);
    const [selectedManager, setSelectedManager] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen && branchId) {
            fetchManagers();
        }
    }, [isOpen, branchId]);

    const fetchManagers = async () => {
        try {
            const data = await userService.getBranchManagers(branchId);
            setManagers(data || []);
            if (data && data.length > 0) {
                setSelectedManager(data[0].username);
            }
        } catch (error) {
            console.error("Failed to fetch managers:", error);
            toast.error(error.message || "فشل تحميل قائمة المديرين");
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
            // Parent will handle success
            setPassword("");
        } catch (error) {
            // Error handling in parent
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const shortage = shiftData?.shortage || 0;
    const isShortage = shortage < 0;
    const isOverage = shortage > 0;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all border border-gray-100 dark:border-gray-700">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl text-white">
                    <h2 className="text-2xl font-bold">موافقة المدير - إغلاق الوردية</h2>
                    <p className="text-blue-100 text-sm mt-1">يرجى إدخال بيانات المدير للموافقة على إغلاق الوردية</p>
                </div>

                <div className="p-6 space-y-6">

                    {/* Cash Summary */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 space-y-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">ملخص الخزينة</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-600">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">المبلغ المتوقع</div>
                                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                    {(shiftData?.systemExpectedCash || 0).toFixed(2)} ج.م
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-600">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">المبلغ الفعلي</div>
                                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                    {(shiftData?.actualCash || 0).toFixed(2)} ج.م
                                </div>
                            </div>
                        </div>

                        {/* Shortage/Overage Display */}
                        {shortage !== 0 && (
                            <div className={`rounded-lg p-4 border-2 ${isShortage
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                                    : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                }`}>
                                <div className={`text-sm mb-1 ${isShortage ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
                                    }`}>
                                    {isShortage ? '⚠️ عجز' : '✅ زيادة'}
                                </div>
                                <div className={`text-3xl font-bold ${isShortage ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                    }`}>
                                    {Math.abs(shortage).toFixed(2)} ج.م
                                </div>
                            </div>
                        )}

                        {shortage === 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-2 border-green-300 dark:border-green-700">
                                <div className="text-green-700 dark:text-green-300 text-center font-bold text-lg">
                                    ✅ الحساب مطابق تماماً
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Manager Authentication Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                <User size={16} className="inline mr-2" />
                                المدير
                            </label>
                            <select
                                value={selectedManager}
                                onChange={(e) => setSelectedManager(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
                                required
                            >
                                {managers.length === 0 ? (
                                    <option value="">لا يوجد مديرين متاحين</option>
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
                                <Lock size={16} className="inline mr-2" />
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
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading || managers.length === 0}
                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Check size={16} />
                                <span>{loading ? "جاري الموافقة..." : "موافقة وإغلاق الوردية"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={16} />
                                <span>إلغاء</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ShiftVerificationModal;
