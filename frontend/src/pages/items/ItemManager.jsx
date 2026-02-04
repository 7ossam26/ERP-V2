import React, { useState, useEffect } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import {
  itemService,
  supplierService,
  categoryService,
} from "../../services/domainServices";
import AuthService from "../../services/authService";

export const ItemForm = ({ initialData, onClose, onSave, data }) => {
  // Calculate next ID if creating new item
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    code: initialData?.code || "",
    price: initialData?.price || "",
    unit: initialData?.unit || "piece",
    reorderPoint: initialData?.reorderPoint ?? 10,
    suppliers: initialData?.suppliers || [],
    categories: initialData?.categories || [],
  });
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [suppliers, categories] = await Promise.all([
        supplierService.getAll(),
        categoryService.getAll(),
      ]);
      setAvailableSuppliers(suppliers);
      setAvailableCategories(categories);
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSupplierChange = (supplierId) => {
    setFormData((prev) => {
      const currentSuppliers = prev.suppliers || [];
      if (currentSuppliers.includes(supplierId)) {
        return {
          ...prev,
          suppliers: currentSuppliers.filter((id) => id !== supplierId),
        };
      } else {
        return { ...prev, suppliers: [...currentSuppliers, supplierId] };
      }
    });
  };

  const handleCategoryChange = (categoryId) => {
    setFormData((prev) => {
      const currentCategories = prev.categories || [];
      if (currentCategories.includes(categoryId)) {
        return {
          ...prev,
          categories: currentCategories.filter((id) => id !== categoryId),
        };
      } else {
        return { ...prev, categories: [...currentCategories, categoryId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData, !keepOpen);
    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        code: "",
        price: "",
      }));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
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
          اسم الصنف
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم الصنف"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            category
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          سعر البيع
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right"
            name="price"
            value={formData.price}
            onChange={handleChange}
            dir="ltr"
            placeholder="0.00"
            type="number"
            step="0.01"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            attach_money
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الوحدة
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="unit"
            value={formData.unit}
            onChange={handleChange}>
            <option value="piece">قطعة</option>
            <option value="kg">كيلو جرام</option>
            <option value="box">علبة</option>
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            scale
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          نقطة إعادة الطلب
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
            name="reorderPoint"
            value={formData.reorderPoint}
            onChange={handleChange}
            placeholder="10"
            type="number"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            notification_important
          </span>
        </div>
      </div>

      <div className="md:col-span-2 space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الموردين
        </label>
        <div className="bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl p-4 max-h-48 overflow-y-auto">
          {availableSuppliers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableSuppliers.map((supplier) => (
                <label
                  key={supplier.id}
                  className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.suppliers.includes(supplier.id)}
                    onChange={() => handleSupplierChange(supplier.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-gray-700 dark:text-gray-200 font-medium">
                    {supplier.name}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-2">
              لا يوجد موردين متاحين
            </p>
          )}
        </div>
      </div>

      <div className="md:col-span-2 space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          التصنيفات
        </label>
        <div className="bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl p-4 max-h-48 overflow-y-auto">
          {availableCategories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableCategories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.categories.includes(category.id)}
                    onChange={() => handleCategoryChange(category.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-gray-700 dark:text-gray-200 font-medium">
                    {category.name}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-2">
              لا توجد تصنيفات متاحة
            </p>
          )}
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

const ItemManager = () => {
  const [suppliersMap, setSuppliersMap] = useState({});
  const [categoriesMap, setCategoriesMap] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliers, categories] = await Promise.all([
          supplierService.getAll(),
          categoryService.getAll(),
        ]);

        const sMap = suppliers.reduce((acc, s) => {
          acc[s.id] = s.name;
          return acc;
        }, {});
        setSuppliersMap(sMap);

        const cMap = categories.reduce((acc, c) => {
          acc[c.id] = c.name;
          return acc;
        }, {});
        setCategoriesMap(cMap);
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
      header: "الصنف",
      accessor: "name",
      render: (item) => (
        <div className="font-bold text-gray-900 dark:text-white">
          {item.name}
        </div>
      ),
    },
    {
      header: "السعر",
      accessor: "price",
      render: (item) => (
        <span className="font-bold text-primary">{item.price} ج.م</span>
      ),
    },
    {
      header: "الوحدة",
      accessor: "unit",
      render: (item) => (
        <span className="text-gray-500">
          {item.unit === "piece" ? "قطعة" : item.unit === "kg" ? "كجم" : "علبة"}
        </span>
      ),
    },
    {
      header: "نقطة إعادة الطلب",
      accessor: "reorderPoint",
      render: (item) => (
        <span className="text-gray-900 dark:text-white font-medium">
          {item.reorderPoint ?? 10}
        </span>
      ),
    },
    {
      header: "الموردين",
      accessor: "suppliers",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.suppliers && item.suppliers.length > 0 ? (
            item.suppliers.map((supplierId) => (
              <span
                key={supplierId}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                {suppliersMap[supplierId] || "مورد غير معروف"}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </div>
      ),
    },
    {
      header: "التصنيفات",
      accessor: "categories",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.categories && item.categories.length > 0 ? (
            item.categories.map((catId) => (
              <span
                key={catId}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                {categoriesMap[catId] || catId}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة الأصناف"
      subtitle="المنتجات والأسعار والمخزون"
      icon="category"
      service={itemService}
      columns={columns}
      FormComponent={ItemForm}
      emptyMessage="لا توجد أصناف مسجلة."
      hideAddButton={!AuthService.hasPermission("CREATES_ITEMS")}
    />
  );
};

export default ItemManager;
