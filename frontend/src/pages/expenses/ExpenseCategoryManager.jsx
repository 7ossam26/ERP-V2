import React from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { expenseCategoryService } from "../../services/expenseCategoryService";

const ExpenseCategoryForm = ({ initialData, onSave, onClose, showToast }) => {
    const [formData, setFormData] = React.useState(
        initialData || { name: "", isActive: true }
    );

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            if (showToast) showToast("يرجى إدخال اسم التصنيف", "error");
            return;
        }
        await onSave(formData, true);
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                    اسم التصنيف
                </label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="مثال: كهرباء، إيجار، نثريات..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                    الحالة
                </label>
                <div className="relative flex items-center mt-3">
                    <label className="relative inline-flex items-center cursor-pointer group gap-3">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={formData.isActive !== false}
                            onChange={handleChange}
                            className="sr-only peer"
                        />
                        <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-primary transition-colors">
                            {formData.isActive !== false ? "نشط" : "غير نشط"}
                        </span>
                    </label>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all min-h-touch">
                    إلغاء
                </button>
                <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-touch">
                    <span className="material-icons-round text-lg">save</span>
                    <span>{initialData ? "حفظ التغييرات" : "إضافة"}</span>
                </button>
            </div>
        </form>
    );
};

const ExpenseCategoryManager = () => {
    const columns = [
        { header: "#", accessor: "id" },
        { header: "اسم التصنيف", accessor: "name" },
        {
            header: "الحالة",
            accessor: "isActive",
            render: (cat) => (
                <span
                    className={`px-2 py-1 rounded text-xs font-bold ${cat.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        }`}>
                    {cat.isActive ? "نشط" : "غير نشط"}
                </span>
            ),
        },
    ];

    return (
        <GenericPageManager
            title="تصنيفات المصروفات"
            subtitle="إدارة أنواع المصروفات المتاحة لجميع الفروع"
            icon="label"
            service={expenseCategoryService}
            columns={columns}
            FormComponent={ExpenseCategoryForm}
            emptyMessage="لا توجد تصنيفات مضافة"
            backPath="/expenses"
        />
    );
};

export default ExpenseCategoryManager;
