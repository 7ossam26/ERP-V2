import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { deliveryService } from "../../services/deliveryService";
import { branchService } from "../../services/branchService";
import AuthService from "../../services/authService";
import { validateEgyptianPhone } from "../../utils/validationUtils";
import toast from "react-hot-toast";
import DeliverySettlementModal from "./DeliverySettlementModal";

const DeliveryManForm = ({ initialData, onClose, onSave, isSaving, data, showToast }) => {
  // Calculate next ID if creating new delivery man
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    branchId: initialData?.branchId || "",
    phone: initialData?.phone || "",
    nationalId: initialData?.nationalId || "",
    vehicleType: initialData?.vehicleType || "",
  });
  const [keepOpen, setKeepOpen] = useState(false);

  React.useEffect(() => {
    const fetchBranches = async () => {
      try {
        const data = await branchService.getAll();
        setBranches(data);
      } catch (error) {
        console.error("Failed to fetch branches", error);
      }
    };
    fetchBranches();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === "branchId" ? parseInt(value) || "" : value,
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

    // Phone validation
    const phoneValidation = validateEgyptianPhone(formData.phone);
    if (!phoneValidation.isValid) {
      if (showToast) {
        showToast(phoneValidation.message, "error");
      }
      return;
    }

    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        phone: "",
        nationalId: "",
        vehicleType: "",
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
          الفرع
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="branchId"
            value={formData.branchId}
            onChange={handleChange}
            required>
            <option value="">اختر الفرع...</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            store
          </span>
          <span className="material-icons-round absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      <div className="space-y-2 col-span-1 md:col-span-1">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اسم الطيار
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم الطيار"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            delivery_dining
          </span>
        </div>
      </div>

      <div className="space-y-2 col-span-1 md:col-span-1">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          نوع المركبة
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="vehicleType"
            value={formData.vehicleType}
            onChange={handleChange}>
            <option value="">اختر نوع المركبة...</option>
            <option value="motorcycle">موتوسيكل</option>
            <option value="car">سيارة</option>
            <option value="van">فان</option>
            <option value="bicycle">دراجة</option>
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            two_wheeler
          </span>
          <span className="material-icons-round absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          رقم البطاقة
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="nationalId"
            value={formData.nationalId}
            onChange={handleChange}
            placeholder="رقم البطاقة"
            type="text"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            fingerprint
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
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            call
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

const DeliveryMenPage = () => {
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSettleClick = (deliveryMan) => {
    setSelectedDeliveryMan(deliveryMan);
    setIsSettlementModalOpen(true);
  };

  const handleSettleSubmit = async (data) => {
    await deliveryService.settle(data);
    toast.success("تمت التسوية بنجاح");
    setRefreshTrigger((prev) => prev + 1); // Refresh the table
    setIsSettlementModalOpen(false);
  };

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
      header: "الاسم",
      accessor: "name",
      render: (item) => (
        <div>
          <div className="font-bold text-gray-900 dark:text-white">
            {item.name}
          </div>
          <div className="text-xs text-gray-500">
            {item.branch?.name || "-"}
          </div>
        </div>
      ),
    },
    {
      header: "نوع المركبة",
      accessor: "vehicleType",
      render: (item) => {
        const vehicleIcons = {
          motorcycle: "🏍️",
          car: "🚗",
          van: "🚐",
          bicycle: "🚲",
        };
        const vehicleNames = {
          motorcycle: "موتوسيكل",
          car: "سيارة",
          van: "فان",
          bicycle: "دراجة",
        };
        return (
          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
            {vehicleIcons[item.vehicleType] || "🛵"}{" "}
            {vehicleNames[item.vehicleType] || "-"}
          </span>
        );
      },
    },
    {
      header: "المديونية (Wallet)",
      accessor: "walletBalance",
      render: (item) => {
        const balance = parseFloat(item.walletBalance || 0);
        return (
          <div className="flex flex-col items-start">
            <span
              className={`font-mono font-bold text-sm ${balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                }`}>
              {balance.toLocaleString("en-US")} ج.م
            </span>
            {balance > 0 && (
              <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md mt-1">
                مستحق الدفع
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "إجراءات التسوية",
      accessor: "actions",
      render: (item) => (
        <button
          onClick={() => handleSettleClick(item)}
          disabled={!item.isActive}
          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
          <span className="material-icons-round text-sm">payments</span>
          تسوية
        </button>
      ),
    },
    {
      header: "رقم الهاتف",
      accessor: "phone",
      render: (item) => (
        <span
          dir="ltr"
          className="text-gray-600 dark:text-gray-300 font-mono text-xs">
          {item.phone}
        </span>
      ),
    },
    {
      header: "رقم البطاقة",
      accessor: "nationalId",
      render: (item) => (
        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
          {item.nationalId || "-"}
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
    <>
      <GenericPageManager
        key={refreshTrigger} // Force re-mount to refresh data
        title="إدارة الطيارين"
        subtitle="قائمة بجميع الطيارين المسجلين في النظام"
        icon="delivery_dining"
        service={deliveryService}
        columns={columns}
        FormComponent={DeliveryManForm}
        emptyMessage="لا يوجد طيارين."
        hideAddButton={!AuthService.hasPermission("CREATES_DELIVERY_MEN")}
        className="pb-20" // Add padding for bottom
      />

      {isSettlementModalOpen && (
        <DeliverySettlementModal
          deliveryMan={selectedDeliveryMan}
          onClose={() => setIsSettlementModalOpen(false)}
          onSettle={handleSettleSubmit}
        />
      )}
    </>
  );
};

export default DeliveryMenPage;
