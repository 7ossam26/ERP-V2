import React, { useState, useEffect } from "react";
import { treasuryService } from "../../services/domainServices";
import AuthService from "../../services/authService";

const AddDepositModal = ({ onClose, onAdd }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        treasuryId: "",
    });
    const [treasuries, setTreasuries] = useState([]);

    useEffect(() => {
        const fetchTreasuries = async () => {
            try {
                const data = await treasuryService.getAll();
                setTreasuries(data);

                // Default to user's branch treasury or first available
                const user = AuthService.getCurrentUser();
                if (user && user.branchId && data.length > 0) {
                    setFormData(prev => ({ ...prev, treasuryId: data[0].id }));
                } else if (data.length > 0) {
                    setFormData(prev => ({ ...prev, treasuryId: data[0].id }));
                }
            } catch (error) {
                console.error("Failed to fetch treasuries", error);
            }
        };
        fetchTreasuries();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = () => {
        onAdd(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-light/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-light w-full max-w-lg rounded-xl shadow-2xl border border-border-light flex flex-col max-h-[90vh] animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-border-light bg-surface-light rounded-t-xl">
                    <h2 className="text-xl font-bold text-text-light flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                            add_circle
                        </span>
                        إضافة إيداع جديد
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-text-light/50 hover:text-red-500 transition-colors rounded-lg p-1 hover:bg-red-50">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-text-light block">
                            الخزينة
                        </label>
                        <select
                            name="treasuryId"
                            value={formData.treasuryId}
                            onChange={handleChange}
                            className="w-full bg-background-light border border-border-light rounded-lg px-4 py-2.5 text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer">
                            {treasuries.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-text-light block">
                            التاريخ
                        </label>
                        <div className="relative">
                            <input
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full bg-background-light border border-border-light rounded-lg px-4 py-2.5 text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-numbers transition-all cursor-pointer"
                                type="date"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-text-light block">
                            الوصف
                        </label>
                        <input
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full bg-background-light border border-border-light rounded-lg px-4 py-2.5 text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-light/40"
                            placeholder="مثال: زيادة رأس مال، قرض..."
                            type="text"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-text-light block">
                            المبلغ
                        </label>
                        <div className="relative">
                            <input
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                className="w-full bg-background-light border border-border-light rounded-lg pr-4 pl-12 py-2.5 text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-numbers transition-all text-left"
                                placeholder="0.00"
                                style={{ direction: "ltr" }}
                                type="number"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 text-sm font-bold">
                                ج.م
                            </span>
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-border-light bg-background-light/30 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg border border-border-light bg-surface-light text-text-light hover:bg-accent/10 font-bold transition-colors">
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 rounded-lg bg-primary text-text-dark hover:bg-primary-hover shadow-md hover:shadow-lg font-bold transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">
                            check
                        </span>
                        <span>إضافة</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddDepositModal;
