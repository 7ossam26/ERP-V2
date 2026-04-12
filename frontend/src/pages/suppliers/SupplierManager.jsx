import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { supplierService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import { validateEgyptianPhone } from "../../utils/validationUtils";

const SupplierForm = ({ initialData, onClose, onSave, data, showToast }) => {
  // Calculate next ID if creating new supplier
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    phone: initialData?.phone || "",
  });
  const [keepOpen, setKeepOpen] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

    // Phone validation (Optional)
    if (formData.phone) {
      const phoneValidation = validateEgyptianPhone(formData.phone);
      if (!phoneValidation.isValid) {
        if (showToast) {
          showToast(phoneValidation.message, "error");
        }
        return;
      }
    }

    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        phone: "",
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6">
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
            disabled
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
            maxLength={100}
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
            placeholder="01xxxxxxxxx (اختياري)"
            type="tel"
            maxLength={14}
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            call
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

const SupplierManager = () => {
  const columns = [
    {
      header: "الرقم التعريفي",
      accessor: "id",
      render: (item) => (
        <span className="font-mono text-gray-900 dark:text-white font-bold text-sm">
          {item.id || "-"}
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
      hideAddButton={!AuthService.hasPermission("CREATES_SUPPLIERS")}
    />
  );
};

export default SupplierManager;
