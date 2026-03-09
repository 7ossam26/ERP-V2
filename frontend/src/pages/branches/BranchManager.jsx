import React, { useState, useEffect } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { branchService, treasuryService } from "../../services/domainServices";
import { warehouseService } from "../../services/warehouseService";
import AuthService from "../../services/authService";

const BranchForm = ({ initialData, onClose, onSave, data, showToast }) => {
  // Calculate next ID if creating new branch
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    address: initialData?.address || "",
    warehouseId: initialData?.warehouseId || "",
    treasuryId: initialData?.treasuryId || "",
  });
  const [warehouses, setWarehouses] = useState([]);
  const [treasuries, setTreasuries] = useState([]);
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedWarehouses, fetchedTreasuries] = await Promise.all([
          warehouseService.getAll(),
          treasuryService.getAll(),
        ]);
        setWarehouses(fetchedWarehouses);
        setTreasuries(fetchedTreasuries);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

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

    await onSave(formData, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        address: "",
        // Keep warehouse and treasury sticky
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
          اسم الفرع
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم الفرع"
            type="text"
            required
            maxLength={100}
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            storefront
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          العنوان
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="عنوان الفرع"
            type="text"
            maxLength={200}
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            location_on
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          المخزن
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="warehouseId"
            value={formData.warehouseId}
            onChange={handleChange}
            required>
            <option value="">اختر المخزن...</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            warehouse
          </span>
          <span className="material-icons-round absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الخزينة
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="treasuryId"
            value={formData.treasuryId}
            onChange={handleChange}
            required>
            <option value="">اختر الخزينة...</option>
            {treasuries.map((treasury) => (
              <option key={treasury.id} value={treasury.id}>
                {treasury.name}
              </option>
            ))}
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            savings
          </span>
          <span className="material-icons-round absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
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

const BranchManager = () => {
  const [warehousesMap, setWarehousesMap] = useState({});
  const [treasuriesMap, setTreasuriesMap] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedWarehouses, fetchedTreasuries] = await Promise.all([
          warehouseService.getAll(),
          treasuryService.getAll(),
        ]);
        const wMap = fetchedWarehouses.reduce(
          (acc, item) => ({ ...acc, [item.id]: item.name }),
          {}
        );
        const tMap = fetchedTreasuries.reduce(
          (acc, item) => ({ ...acc, [item.id]: item.name }),
          {}
        );
        setWarehousesMap(wMap);
        setTreasuriesMap(tMap);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

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
      header: "الفرع",
      accessor: "name",
      render: (item) => (
        <div className="font-bold text-gray-900 dark:text-white">
          {item.name}
        </div>
      ),
    },
    {
      header: "العنوان",
      accessor: "address",
      render: (item) => (
        <span className="text-gray-500">{item.address || "-"}</span>
      ),
    },
    {
      header: "المخزن",
      accessor: "warehouseId",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300">
          {warehousesMap[item.warehouseId] || "-"}
        </span>
      ),
    },
    {
      header: "الخزينة",
      accessor: "treasuryId",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300">
          {treasuriesMap[item.treasuryId] || "-"}
        </span>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة الفروع"
      subtitle="أفرع المتجر"
      icon="storefront"
      service={branchService}
      columns={columns}
      FormComponent={BranchForm}
      emptyMessage="لا توجد فروع مسجلة."
      hideAddButton={!AuthService.hasPermission("CREATES_BRANCHES")}
    />
  );
};

export default BranchManager;
