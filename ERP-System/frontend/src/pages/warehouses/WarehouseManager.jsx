import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { warehouseService } from "../../services/warehouseService";
import AuthService from "../../services/authService";

const WarehouseForm = ({ initialData, onClose, onSave, data = [] }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
  });

  // Calculate next ID for new warehouse
  const getNextId = () => {
    if (initialData?.id) {
      return initialData.id; // Editing existing warehouse
    }
    if (data.length === 0) {
      return 1; // First warehouse
    }
    const maxId = Math.max(...data.map((item) => item.id || 0));
    return maxId + 1;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-6">
      <div className="col-span-1">
        <label
          className="block text-sm font-bold text-text-light dark:text-text-dark mb-2"
          htmlFor="code">
          الرقم التعريفي
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-light/40 dark:text-text-dark/40">
            <span className="material-icons-round text-lg">tag</span>
          </span>
          <input
            className="block w-full pr-10 pl-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm text-text-light dark:text-text-dark placeholder-text-light/30 dark:placeholder-text-dark/30 transition-shadow opacity-70 cursor-not-allowed"
            id="code"
            name="code"
            value={getNextId()}
            placeholder="ID تلقائي"
            type="text"
            readOnly
            disabled
          />
        </div>
      </div>
      <div className="col-span-1">
        <label
          className="block text-sm font-bold text-text-light dark:text-text-dark mb-2"
          htmlFor="name">
          اسم المخزن
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-light/40 dark:text-text-dark/40">
            <span className="material-icons-round text-lg">inventory_2</span>
          </span>
          <input
            className="block w-full pr-10 pl-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm text-text-light dark:text-text-dark placeholder-text-light/30 dark:placeholder-text-dark/30 transition-shadow"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم المخزن"
            type="text"
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all">
          إلغاء
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2">
          <span className="material-icons-round text-lg">save</span>
          <span>حفظ التغييرات</span>
        </button>
      </div>
    </form>
  );
};

const WarehouseManager = () => {
  const columns = [
    {
      header: "الرقم التعريفي",
      accessor: "code",
      render: (item) => (
        <span className="font-mono text-gray-600 dark:text-gray-300">
          {item.code || `${item.id}`}
        </span>
      ),
    },
    {
      header: "اسم المخزن",
      accessor: "name",
      render: (item) => (
        <div className="font-bold text-gray-900 dark:text-white">
          {item.name}
        </div>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="عرض المخازن"
      subtitle="قائمة بجميع المخازن المسجلين في نظام الغنيمي"
      icon="warehouse"
      service={warehouseService}
      columns={columns}
      FormComponent={WarehouseForm}
      emptyMessage="لا توجد مخازن مضافة بعد."
      hideAddButton={!AuthService.hasPermission("CREATES_WAREHOUSES")}
    />
  );
};

export default WarehouseManager;
