import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Receipt, Check, User, Clock, Calendar, Store, LogOut } from "lucide-react";

const StartShiftModal = ({ isOpen, onClose, onConfirm, user }) => {
    const navigate = useNavigate();
    const [startCash, setStartCash] = useState("");
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(startCash ? parseFloat(startCash) : 0);
    };

    const handleExit = () => {
        navigate("/dashboard");
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all scale-100 opacity-100 border border-gray-100 dark:border-gray-700">

                {/* Header */}
                <div className="bg-primary-600 p-6 rounded-t-2xl text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Receipt size={16} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">فتح وردية جديدة</h2>
                            <p className="text-primary-100 text-sm">أدخل بيانات بداية الوردية</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">

                    {/* Info Cards Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Employee Info */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3 mb-2 text-primary-600 dark:text-primary-400">
                                <User size={16} />
                                <span className="font-semibold text-sm">الموظف</span>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                                {user?.name || "غير معروف"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {user?.role || "----"}
                            </p>
                        </div>

                        {/* Branch Info */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3 mb-2 text-primary-600 dark:text-primary-400">
                                <Store size={16} />
                                <span className="font-semibold text-sm">الفرع</span>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                                {user?.branch?.name || "----"}
                            </p>
                        </div>

                        {/* Date */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3 mb-2 text-primary-600 dark:text-primary-400">
                                <Calendar size={16} />
                                <span className="font-semibold text-sm">التاريخ</span>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white font-mono dir-ltr">
                                {currentTime.toLocaleDateString("en-CA")}
                            </p>
                        </div>

                        {/* Time */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3 mb-2 text-primary-600 dark:text-primary-400">
                                <Clock size={16} />
                                <span className="font-semibold text-sm">الوقت الحالي</span>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white font-mono dir-ltr">
                                {currentTime.toLocaleTimeString("en-US", { hour12: true })}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                الرصيد الافتتاحي للخزينة (اختياري)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={startCash}
                                    onChange={(e) => setStartCash(e.target.value)}
                                    className="block w-full px-4 py-4 text-xl font-bold text-center rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-300"
                                    placeholder="0.00"
                                    autoFocus
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                    ج.م
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
                            >
                                <Check size={16} />
                                <span>بدء الوردية</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExit}
                                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                                title="الخروج إلى لوحة التحكم"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StartShiftModal;
