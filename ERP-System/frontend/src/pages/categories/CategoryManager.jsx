import React from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { categoryService } from "../../services/domainServices";

const CategoryForm = ({ initialData, onSave, onClose }) => {
  const [formData, setFormData] = React.useState(initialData || { name: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
          رقم التصنيف (ID)
        </label>
        <input
          type="text"
          value={initialData ? initialData.id : ""}
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
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          إلغاء
        </button>
        <button
          type="submit"
          className="px-6 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-colors shadow-lg shadow-primary/30">
          حفظ
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
    />
  );
};

export default CategoryManager;
