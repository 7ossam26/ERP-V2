import React, { useState, useEffect } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { deliveryZoneService } from "../../services/deliveryZoneService";
import { branchService } from "../../services/branchService";
import AuthService from "../../services/authService";
import toast from "react-hot-toast";

const DeliveryZoneForm = ({ initialData, onClose, onSave, isSaving, data, showToast }) => {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    branchService.getAll().then(setBranches).catch(console.error);
  }, []);

  // Calculate next ID if creating new delivery zone
  // Calculate next ID if creating new delivery zone
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    fee: initialData?.fee || "",
    driverShare: initialData?.driverShare || 0,
    branchId: initialData?.branchId || "",
  });
  const [keepOpen, setKeepOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
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

    // Validate that driver share cannot exceed delivery fee
    const parsedFee = parseFloat(formData.fee);
    const parsedDriverShare = parseFloat(formData.driverShare || 0);

    if (parsedDriverShare > parsedFee) {
      toast.error("حصة الطيار لا يمكن أن تتجاوز رسوم التوصيل");
      return;
    }

    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        fee: "",
        driverShare: 0,
        // Keep branch sticky
      }));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          اسم المنطقة
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم المنطقة"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            map
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الفرع
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-10 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="branchId"
            value={formData.branchId}
            onChange={handleChange}
            required>
            <option value="">اختر الفرع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            store
          </span>
          <span className="material-icons-round absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          رسوم التوصيل (ج.م)
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="fee"
            value={formData.fee}
            onChange={handleChange}
            placeholder="أدخل رسوم التوصيل"
            type="number"
            step="0.01"
            min="0"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            payments
          </span>
        </div>
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          حصة الطيار (ج.م)
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="driverShare"
            value={formData.driverShare}
            onChange={handleChange}
            placeholder="أدخل حصة الطيار"
            type="number"
            step="0.01"
            min="0"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            motorcycle
          </span>
        </div>
      </div>

      <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          إلغاء
        </button>

        {!initialData && (
          <button
            type="submit"
            onClick={() => setKeepOpen(true)}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-bold text-sm transition-all flex items-center justify-center gap-2 min-h-touch border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <span className="material-icons-round text-lg">playlist_add</span>
            <span>حفظ وإضافة آخر</span>
          </button>
        )}

        <button
          type="submit"
          onClick={() => setKeepOpen(false)}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? (
            <>
              <span className="material-icons-round text-lg animate-spin">
                refresh
              </span>
              <span>جاري الحفظ...</span>
            </>
          ) : (
            <>
              <span className="material-icons-round text-lg">save</span>
              <span>{initialData ? "حفظ التغييرات" : "حفظ وإغلاق"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

const DeliveryZonesPage = () => {
  const columns = [
    {
      header: "الرقم",
      accessor: "id",
      render: (item) => (
        <span className="font-mono text-gray-900 dark:text-white font-bold text-sm">
          {item.id}
        </span>
      ),
    },
    {
      header: "اسم المنطقة",
      accessor: "name",
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="material-icons-round text-primary text-lg">
            location_on
          </span>
          <span className="font-bold text-gray-900 dark:text-white">
            {item.name}
          </span>
        </div>
      ),
    },
    {
      header: "الفرع",
      accessor: "branch",
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="material-icons-round text-gray-400 text-lg">
            store
          </span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {item.branch?.name || "غير محدد"}
          </span>
        </div>
      ),
    },
    {
      header: "رسوم التوصيل",
      accessor: "fee",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 font-bold text-sm">
          {parseFloat(item.fee).toFixed(2)} ج.م
        </span>
      ),
    },
    {
      header: "حصة الطيار",
      accessor: "driverShare",
      render: (item) => (
        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
          {parseFloat(item.driverShare || 0).toFixed(2)} ج.م
        </span>
      ),
    },
    {
      header: "الحالة",
      accessor: "isActive",
      render: (item) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${item.isActive
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}>
          {item.isActive ? "نشط" : "غير نشط"}
        </span>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة مناطق التوصيل"
      subtitle="قائمة بجميع مناطق التوصيل والرسوم المرتبطة بها"
      icon="map"
      service={deliveryZoneService}
      columns={columns}
      FormComponent={DeliveryZoneForm}
      emptyMessage="لا توجد مناطق توصيل."
      hideAddButton={!AuthService.hasPermission("CREATES_DELIVERY_ZONES")}
    />
  );
};

export default DeliveryZonesPage;
