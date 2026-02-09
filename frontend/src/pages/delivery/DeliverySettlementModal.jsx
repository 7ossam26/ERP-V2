import React, { useState, useEffect } from "react";
import { treasuryService } from "../../services/treasuryService";
import toast from "react-hot-toast";

const DeliverySettlementModal = ({ deliveryMan, onClose, onSettle }) => {
    const [treasuries, setTreasuries] = useState([]);
    const [amount, setAmount] = useState("");
    const [selectedTreasury, setSelectedTreasury] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchTreasuries = async () => {
            try {
                const data = await treasuryService.getAll();
                const safes = data.filter((t) => t.isActive);
                setTreasuries(safes);

                // Default to driver's branch treasury if available
                if (deliveryMan?.branch?.treasuryId) {
                    const branchTreasury = safes.find(t => t.id === deliveryMan.branch.treasuryId);
                    if (branchTreasury) {
                        setSelectedTreasury(branchTreasury.id);
                        return;
                    }
                }

                // Fallback to first available treasury
                if (safes.length > 0) {
                    setSelectedTreasury(safes[0].id);
                }
            } catch (error) {
                console.error("Error fetching treasuries:", error);
                toast.error("فشل تحميل الخزن");
            }
        };
        fetchTreasuries();
    }, [deliveryMan]);

    // Pre-fill amount with full debt if available
    useEffect(() => {
        if (deliveryMan?.walletBalance) {
            setAmount(deliveryMan.walletBalance);
        }
    }, [deliveryMan]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !selectedTreasury) {
            toast.error("الرجاء إدخال المبلغ وتحديد الخزنة");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSettle({
                deliveryManId: deliveryMan.id,
                amount: parseFloat(amount),
                treasuryId: parseInt(selectedTreasury),
                notes,
            });
            onClose();
        } catch (error) {
            console.error("Settlement failed", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!deliveryMan) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
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
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Current Debt Display */}
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-900/20 text-center">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">
                            المديونية الحالية
                        </p>
                        <p className="text-3xl font-bold text-red-700 dark:text-red-400 font-mono">
                            {parseFloat(deliveryMan.walletBalance || 0).toLocaleString("en-US")} ج.م
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

                    {/* Treasury Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                            توريد إلى الخزنة
                        </label>
                        <div className="relative">
                            <select
                                value={selectedTreasury}
                                onChange={(e) => setSelectedTreasury(e.target.value)}
                                className="w-full bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-xl py-3 pr-4 pl-10 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                                required>
                                <option value="" disabled>
                                    اختر الخزنة...
                                </option>
                                {treasuries.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} (رصيد: {parseFloat(t.balance).toLocaleString()})
                                    </option>
                                ))}
                            </select>
                            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                expand_more
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
                            {isSubmitting ? (
                                <>
                                    <span className="material-icons-round animate-spin text-sm">
                                        refresh
                                    </span>
                                    <span>جاري المعالجة...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-icons-round">payments</span>
                                    <span>تأكيد التسوية وتسليم النقدية</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeliverySettlementModal;
