import React, { useState, useEffect } from "react";
import { expenseService } from "../../services/domainServices";
import { expenseCategoryService } from "../../services/expenseCategoryService";
import toast from "react-hot-toast";

const AddExpenseModal = ({ onClose, onAdd, onUpdate, expenseToEdit }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        treasuryId: "",
        paymentMethod: "CASH",
        categoryId: "",
    });
    const [treasuries, setTreasuries] = useState([]);
    const [categories, setCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);

    useEffect(() => {
        if (expenseToEdit) {
            setFormData({
                date: new Date(expenseToEdit.date).toISOString().split("T")[0],
                description: expenseToEdit.description,
                amount: expenseToEdit.amount,
                treasuryId: expenseToEdit.treasuryId,
                paymentMethod: expenseToEdit.paymentMethod,
                categoryId: expenseToEdit.categoryId || "",
            });
        }
    }, [expenseToEdit]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [treasuryData, categoryData] = await Promise.all([
                    expenseService.getTreasuries(),
                    expenseCategoryService.getActive(),
                ]);
                setTreasuries(treasuryData);
                setCategories(categoryData);

                if (!expenseToEdit) {
                    setFormData(prev => ({
                        ...prev,
                        treasuryId: treasuryData.length > 0 ? treasuryData[0].id : "",
                    }));
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
                toast.error("فشل تحميل البيانات");
            }
        };
        fetchData();
    }, [expenseToEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleQuickAddCategory = async () => {
        if (!newCategoryName.trim()) {
            toast.error("يرجى إدخال اسم التصنيف");
            return;
        }
        setSavingCategory(true);
        try {
            const created = await expenseCategoryService.create({ name: newCategoryName.trim() });
            setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ar")));
            setFormData(prev => ({ ...prev, categoryId: created.id }));
            setNewCategoryName("");
            setShowQuickAdd(false);
            toast.success(`تم إضافة التصنيف "${created.name}"`);
        } catch (error) {
            toast.error(error.message || "فشل إضافة التصنيف");
        } finally {
            setSavingCategory(false);
        }
    };

    const handleSubmit = () => {
        if (!formData.description.trim()) {
            toast.error("يرجى إدخال وصف المصروف");
            return;
        }
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error("يرجى إدخال مبلغ صحيح أكبر من صفر");
            return;
        }
        if (!formData.treasuryId) {
            toast.error("يرجى اختيار الخزينة");
            return;
        }
        if (!formData.categoryId) {
            toast.error("يرجى اختيار تصنيف المصروف");
            return;
        }
        if (expenseToEdit) {
            onUpdate(expenseToEdit.id, formData);
        } else {
            onAdd(formData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-light/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-light w-full max-w-lg rounded-xl shadow-2xl border border-border-light flex flex-col max-h-[90vh] animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-border-light bg-surface-light rounded-t-xl">
                    <h2 className="text-xl font-bold text-text-light flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                            {expenseToEdit ? "edit" : "add_circle"}
                        </span>
                        {expenseToEdit ? "تعديل المصروف" : "إضافة مصروف جديد"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-text-light/50 hover:text-red-500 transition-colors rounded-lg p-1 hover:bg-red-50">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
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
                                طريقة الدفع
                            </label>
                            <select
                                name="paymentMethod"
                                value={formData.paymentMethod}
                                onChange={handleChange}
                                className="w-full bg-background-light border border-border-light rounded-lg px-4 py-2.5 text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer">
                                <option value="CASH">نقدي</option>
                                <option value="CARD">بطاقة بنكية</option>
                            </select>
                        </div>
                    </div>

                    {/* Category selector */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-text-light block">
                                التصنيف <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowQuickAdd(!showQuickAdd)}
                                className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 transition-colors">
                                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                تصنيف جديد
                            </button>
                        </div>
                        <select
                            name="categoryId"
                            value={formData.categoryId}
                            onChange={handleChange}
                            className="w-full bg-background-light border border-border-light rounded-lg px-4 py-2.5 text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer">
                            <option value="">-- اختر التصنيف --</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>

                        {showQuickAdd && (
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleQuickAddCategory()}
                                    placeholder="اسم التصنيف الجديد..."
                                    className="flex-1 bg-background-light border border-primary/40 rounded-lg px-3 py-2 text-sm text-text-light focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleQuickAddCategory}
                                    disabled={savingCategory}
                                    className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
                                    {savingCategory ? "..." : "إضافة"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowQuickAdd(false); setNewCategoryName(""); }}
                                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                                    إلغاء
                                </button>
                            </div>
                        )}
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
                            placeholder="مثال: شراء حبوب بن، فاتورة كهرباء..."
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
                            {expenseToEdit ? "save" : "check"}
                        </span>
                        <span>{expenseToEdit ? "حفظ التعديلات" : "إضافة"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddExpenseModal;
