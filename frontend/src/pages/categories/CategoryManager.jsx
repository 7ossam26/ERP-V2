import React from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { categoryService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import Icon from "../../components/ui/Icon";

const CategoryForm = ({ initialData, onSave, onClose, data, showToast }) => {
  // Calculate next ID if creating new category
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = React.useState(
    initialData || { name: "", id: nextId, showInPos: true },
  );
  const [keepOpen, setKeepOpen] = React.useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Manual HTML5 Validation Check
    if (!e.target.checkValidity()) {
      if (showToast) {
        showToast("برجاء ملء جميع الحقول المطلوبة بشكل صحيح", "error");
      }
      return;
    }

    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        showInPos: true,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

      <div>
        <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
          إظهار في نقطة البيع (POS)
        </label>
        <div className="relative flex items-center mt-3">
          <label className="relative inline-flex items-center cursor-pointer group gap-3">
            <input
              type="checkbox"
              name="showInPos"
              checked={formData.showInPos !== false}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-primary transition-colors">
              {formData.showInPos !== false ? "ظاهر في POS" : "مخفي من POS"}
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

        {!initialData && (
          <button
            type="submit"
            onClick={() => setKeepOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-bold text-sm transition-all flex items-center justify-center gap-2 min-h-touch border border-primary/20">
            <Icon name="playlist_add" className="text-lg" />
            <span>حفظ وإضافة آخر</span>
          </button>
        )}

        <button
          type="submit"
          onClick={() => setKeepOpen(false)}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-touch">
          <Icon name="save" className="text-lg" />
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
    {
      header: "POS",
      accessor: "showInPos",
      render: (cat) => (
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${cat.showInPos !== false
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
            }`}>
          {cat.showInPos !== false ? "ظاهر" : "مخفي"}
        </span>
      ),
    },
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
