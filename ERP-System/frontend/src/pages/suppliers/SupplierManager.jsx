import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { supplierService } from "../../services/domainServices";

const SupplierForm = ({ initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    code: initialData?.code || "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اسم المورد
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="اسم المورد أو الشركة"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            local_shipping
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          رقم الهاتف
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            dir="ltr"
            placeholder="01xxxxxxxxx"
            type="tel"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            call
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الرقم التعريفي (اختياري)
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow opacity-70 cursor-not-allowed"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="مثال: 1001"
            type="text"
            readOnly
            disabled
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            tag
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
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

const SupplierManager = () => {
  const columns = [
    {
      header: "الرقم التعريفي",
      accessor: "code",
      render: (item) => (
        <span className="font-mono text-gray-900 dark:text-white font-bold text-sm">
          {item.code || "-"}
        </span>
      ),
    },
    {
      header: "المورد",
      accessor: "name",
      render: (item) => (
        <div className="font-bold text-gray-900 dark:text-white">
          {item.name}
        </div>
      ),
    },
    {
      header: "رقم الهاتف",
      accessor: "phone",
      render: (item) => (
        <span dir="ltr" className="text-gray-600 dark:text-gray-300">
          {item.phone}
        </span>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة الموردين"
      subtitle="سجلات الموردين والشركاء"
      icon="local_shipping"
      service={supplierService}
      columns={columns}
      FormComponent={SupplierForm}
      emptyMessage="لا يوجد موردين مسجلين."
    />
  );
};

export default SupplierManager;
