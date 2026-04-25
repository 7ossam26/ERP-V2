import React, { useState } from "react";
import Modal from "../ui/Modal";
import { Lock, User } from "lucide-react";

/**
 * Reusable Manager Verification Modal
 * Used for operations that require manager approval (settlements, shift closures, etc.)
 */
const ManagerVerificationModal = ({
    isOpen,
    onClose,
    onVerify,
    title = "تأكيد المدير",
    description = "يرجى إدخال بيانات المدير لتأكيد العملية",
    loading = false,
    zIndex,
}) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!username || !password) {
            return;
        }
        onVerify({ managerUsername: username, managerPassword: password });
    };

    const handleClose = () => {
        setUsername("");
        setPassword("");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={title} zIndex={zIndex}>
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                {description && (
                    <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg text-sm mb-4 border border-yellow-200">
                        {description}
                    </div>
                )}

                {/* Manager Username */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        اسم المستخدم (المدير)
                    </label>
                    <div className="relative">
                        <User size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="اسم المستخدم"
                            required
                            autoFocus
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Manager Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        كلمة المرور
                    </label>
                    <div className="relative">
                        <Lock size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="كلمة المرور"
                            required
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                    <button
                        type="submit"
                        disabled={loading || !username || !password}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors">
                        {loading ? "جاري التحقق..." : "تأكيد"}
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors">
                        إلغاء
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ManagerVerificationModal;
