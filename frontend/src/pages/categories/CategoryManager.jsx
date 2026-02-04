import React from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { categoryService } from "../../services/domainServices";
import AuthService from "../../services/authService";

const CategoryForm = ({ initialData, onSave, onClose, data }) => {
  // Calculate next ID if creating new category
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = React.useState(
    initialData || { name: "", id: nextId }
  );
  const [keepOpen, setKeepOpen] = React.useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
          رقم التصنيف (ID)
        </label>
        <input
          type="text"
          value={formData.id}
          disabled
          className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
        />
      </div>
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
          placeholder="أدخل اسم التصنيف"
        />
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all min-h-touch">
          إلغاء
        </button>

        {!initialData && (
          <button
            type="submit"
            onClick={() => setKeepOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-bold text-sm transition-all flex items-center justify-center gap-2 min-h-touch border border-primary/20">
            <span className="material-icons-round text-lg">playlist_add</span>
            <span>حفظ وإضافة آخر</span>
          </button>
        )}

        <button
          type="submit"
          onClick={() => setKeepOpen(false)}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-touch">
          <span className="material-icons-round text-lg">save</span>
          <span>{initialData ? "حفظ التغييرات" : "حفظ وإغلاق"}</span>
        </button>
      </div>
    </form>
  );
};

const CategoryManager = () => {
  const columns = [
    { header: "رقم التصنيف", accessor: "id" },
    { header: "الاسم", accessor: "name" },
  ];

  return (
    <GenericPageManager
      title="إدارة التصنيفات"
      subtitle="إضافة وتعديل تصنيفات المنتجات"
      icon="category"
      service={categoryService}
      columns={columns}
      FormComponent={CategoryForm}
      emptyMessage="لا توجد تصنيفات مضافة"
      backPath="/creates"
      hideAddButton={!AuthService.hasPermission("CREATES_CATEGORIES")}
    />
  );
};

export default CategoryManager;
