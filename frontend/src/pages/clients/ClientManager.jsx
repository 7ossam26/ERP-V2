import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { clientService } from "../../services/domainServices";
import AuthService from "../../services/authService";

export const ClientForm = ({ initialData, onClose, onSave, data }) => {
  // Calculate next ID if creating new client
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
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
          الرقم التعريفي
        </label>
        <div className="relative">
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-500 dark:text-gray-400 focus:ring-0 cursor-not-allowed"
            name="id"
            value={formData.id}
            readOnly
            placeholder="ID تلقائي"
            type="text"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            tag
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اسم العميل
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم العميل"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            person
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
          العنوان
        </label>
        <div className="relative">
          <textarea
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-y min-h-[80px]"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="أدخل عنوان العميل (اختياري)"
            rows={3}
          />
          <span className="material-icons-round absolute left-4 top-3 text-gray-400">
            location_on
          </span>
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
          <span>حفظ التغييرات</span>
        </button>
      </div>
    </form>
  );
};

const ClientManager = () => {
  const columns = [
    {
      header: "الرقم التعريفي",
      accessor: "id",
      render: (item) => (
        <span className="font-mono text-gray-900 dark:text-white font-bold text-sm">
          {item.id || "#"}
        </span>
      ),
    },
    {
      header: "العميل",
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
    {
      header: "العنوان",
      accessor: "address",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {item.address || "-"}
        </span>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة العملاء"
      subtitle="قاعدة بيانات العملاء"
      icon="groups"
      service={clientService}
      columns={columns}
      FormComponent={ClientForm}
      emptyMessage="لا يوجد عملاء مسجلين."
      hideAddButton={!AuthService.hasPermission("CREATES_CLIENTS")}
    />
  );
};

export default ClientManager;
