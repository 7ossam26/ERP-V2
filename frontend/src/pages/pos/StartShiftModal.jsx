import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FaCashRegister, FaCheck, FaUser, FaClock, FaCalendarAlt, FaStore, FaSignOutAlt } from "react-icons/fa";
import shiftService from "../../services/shiftService";

const StartShiftModal = ({ isOpen, onClose, onConfirm, user }) => {
    const navigate = useNavigate();
    const [startCash, setStartCash] = useState("");
    // Whether the cashier has actually edited the field. If they haven't we send
    // `undefined` rather than the prefilled number, so the backend reconciles
    // against the LIVE treasury balance instead of a value that may have gone
    // stale while the modal sat open.
    const [touched, setTouched] = useState(false);
    const [context, setContext] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const branchId = user?.branch?.id;

    useEffect(() => {
        if (!isOpen || !branchId) return;
        let cancelled = false;
        // Every state update lives in an async callback rather than the effect
        // body, so opening the modal doesn't trigger a cascading re-render.
        shiftService
            .getOpeningContext(branchId)
            .then((data) => {
                if (cancelled) return;
                setContext(data);
                setTouched(false);
                setStartCash(
                    data?.suggestedStartCash != null
                        ? String(data.suggestedStartCash)
                        : "",
                );
            })
            .catch(() => {
                // Non-fatal: the cashier can still type a count, and the backend
                // defaults to the treasury balance when the field is left alone.
                if (cancelled) return;
                setContext(null);
                setTouched(false);
                setStartCash("");
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, branchId]);

    if (!isOpen) return null;

    const fmt = (n) =>
        Number(n).toLocaleString("ar-EG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    // What this count will actually book to the branch treasury. Zero means the
    // drawer matches the books and nothing is posted — the ordinary case.
    const treasuryBalance = context?.treasuryBalance;
    const delta =
        touched && treasuryBalance != null && startCash !== ""
            ? Math.round((parseFloat(startCash) - treasuryBalance) * 100) / 100
            : 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Untouched → undefined, so the backend uses the live treasury balance.
        // Never send 0 for an empty field: that would book a withdrawal of the
        // entire carried balance.
        onConfirm(touched && startCash !== "" ? parseFloat(startCash) : undefined);
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
                            <FaCashRegister className="w-8 h-8" />
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
                                <FaUser />
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
                                <FaStore />
                                <span className="font-semibold text-sm">الفرع</span>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                                {user?.branch?.name || "----"}
                            </p>
                        </div>

                        {/* Date */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3 mb-2 text-primary-600 dark:text-primary-400">
                                <FaCalendarAlt />
                                <span className="font-semibold text-sm">التاريخ</span>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white font-mono dir-ltr">
                                {currentTime.toLocaleDateString("en-CA")}
                            </p>
                        </div>

                        {/* Time */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3 mb-2 text-primary-600 dark:text-primary-400">
                                <FaClock />
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
                                النقدية في الدرج
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={startCash}
                                    onChange={(e) => {
                                        setTouched(true);
                                        setStartCash(e.target.value);
                                    }}
                                    className="block w-full px-4 py-4 text-xl font-bold text-center rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-300"
                                    placeholder="0.00"
                                    autoFocus
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                    ج.م
                                </span>
                            </div>

                            {treasuryBalance != null && (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    رصيد {context?.treasuryName || "الخزينة"} الحالي:{" "}
                                    <span className="font-bold font-mono dir-ltr inline-block">
                                        {fmt(treasuryBalance)}
                                    </span>{" "}
                                    ج.م
                                </p>
                            )}

                            {/* Show exactly what the count will book, so the delta is
                                never a surprise after the fact. */}
                            {delta !== 0 && (
                                <p
                                    className={`mt-2 text-sm font-semibold ${
                                        delta > 0
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-amber-600 dark:text-amber-400"
                                    }`}
                                >
                                    {delta > 0 ? "سيتم تسجيل إيداع افتتاحي: " : "سيتم تسجيل سحب افتتاحي: "}
                                    <span className="font-mono dir-ltr inline-block">
                                        {fmt(Math.abs(delta))}
                                    </span>{" "}
                                    ج.م
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
                            >
                                <FaCheck className="w-5 h-5" />
                                <span>بدء الوردية</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExit}
                                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                                title="الخروج إلى لوحة التحكم"
                            >
                                <FaSignOutAlt className="w-5 h-5" />
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
