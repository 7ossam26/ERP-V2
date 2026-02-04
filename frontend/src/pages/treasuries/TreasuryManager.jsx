import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { treasuryService } from "../../services/domainServices";
import AuthService from "../../services/authService";

const TreasuryForm = ({ initialData, onClose, onSave, data = [] }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
  });
  const [keepOpen, setKeepOpen] = useState(false);

  // Calculate next ID for new treasury
  const getNextId = () => {
    if (initialData?.id) {
      return initialData.id; // Editing existing treasury
    }
    if (data.length === 0) {
      return 1; // First treasury
    }
    const maxId = Math.max(...data.map((item) => item.id || 0));
    return maxId + 1;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        name: "",
      }));
    }
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
            value={getNextId()}
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
          اسم الخزينة
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم الخزينة"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            savings
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

const TreasuryManager = () => {
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
      header: "الخزينة",
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
      title="إدارة الخزائن"
      subtitle="الخزائن والمالية"
      icon="savings"
      service={treasuryService}
      columns={columns}
      FormComponent={TreasuryForm}
      emptyMessage="لا توجد خزائن مسجلة."
      hideAddButton={!AuthService.hasPermission("CREATES_TREASURIES")}
    />
  );
};

export default TreasuryManager;
