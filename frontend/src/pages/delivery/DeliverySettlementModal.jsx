import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import ManagerVerificationModal from "../../components/shared/ManagerVerificationModal";
import Icon from "../../components/ui/Icon";

const DeliverySettlementModal = ({ deliveryMan, onClose, onSettle }) => {
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showManagerVerification, setShowManagerVerification] = useState(false);

    // Pre-fill amount with full debt if available
    useEffect(() => {
        if (deliveryMan?.walletBalance) {
            setAmount(deliveryMan.walletBalance);
        }
    }, [deliveryMan]);

    const handleProceedToVerification = (e) => {
        e.preventDefault();
        if (!amount) {
            toast.error("الرجاء إدخال المبلغ");
            return;
        }
        setShowManagerVerification(true);
    };

    const handleManagerVerify = async (credentials) => {
        setIsSubmitting(true);
        try {
            await onSettle({
                deliveryManId: deliveryMan.id,
                amount: parseFloat(amount),
                notes,
                ...credentials, // managerUsername, managerPassword
            });
            setShowManagerVerification(false);
            onClose();
        } catch (error) {
            console.error("Settlement failed", error);
            const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "فشلت عملية التسوية";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!deliveryMan) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                تسوية مديونية طيار
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {deliveryMan.name}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Icon name="close" />
                        </button>
                    </div>

                    <form onSubmit={handleProceedToVerification} className="p-6 space-y-4">
                        {/* Current Debt Display */}
                        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-900/20 text-center">
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">
                                المديونية الحالية
                            </p>
                            <p className="text-3xl font-bold text-red-700 dark:text-red-400 font-mono">
                                {parseFloat(deliveryMan.walletBalance || 0).toLocaleString(
                                    "en-US",
                                )}{" "}
                                ج.م
                            </p>
                        </div>

                        {/* Treasury Info (Read-only) */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/20">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                                💰 الخزنة المستهدفة
                            </p>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                خزنة فرع {deliveryMan.branch?.name || "غير محدد"}
                            </p>
                            <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                                سيتم التوريد تلقائياً إلى خزنة فرع الطيار
                            </p>
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                المبلغ المستلم
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-xl py-3 pr-4 pl-12 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all font-mono text-lg font-bold"
                                    placeholder="0.00"
                                    required
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                    EGP
                                </span>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                ملاحظات
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-xl py-3 px-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none h-24"
                                placeholder="أي ملاحظات إضافية..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-2 w-2/3 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-200 dark:shadow-none hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <Icon name="lock" />
                                <span>المتابعة للتأكيد</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Manager Verification Modal */}
            <ManagerVerificationModal
                isOpen={showManagerVerification}
                onClose={() => setShowManagerVerification(false)}
                onVerify={handleManagerVerify}
                title="تأكيد التسوية"
                description={`أنت على وشك تسوية مديونية ${deliveryMan.name} بمبلغ ${parseFloat(amount || 0).toLocaleString()} ج.م. يرجى تأكيد العملية ببيانات المدير.`}
                loading={isSubmitting}
                zIndex="z-[70]"
            />
        </>
    );
};

export default DeliverySettlementModal;
