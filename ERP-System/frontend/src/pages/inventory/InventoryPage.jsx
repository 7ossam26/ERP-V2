import React, { useState, useEffect } from "react";
import GenericDataTable from "../../components/shared/GenericDataTable";

import { warehouseService } from "../../services/domainServices";

const InventoryPage = () => {
  const [filter, setFilter] = useState("الكل");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const data = await warehouseService.getAll();
        setWarehouses(data);
      } catch (error) {
        console.error("Failed to fetch warehouses:", error);
      }
    };
    fetchWarehouses();
  }, []);

  // Mock Data
  const inventoryItems = [
    {
      id: 1,
      name: "اسبريسو غامق",
      code: "CF-001",
      category: "بن القهوة",
      categoryColor: "bg-primary",
      quantity: 45,
      unit: "كجم",
      purchasePrice: 280,
      sellPrice: 450,
      status: "متوفر",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAZAoZmkwZyH2TdUSGj3-yPf895fUr3F-u-s9LLWqaTONineDda9iXdLONis9YgeCYtotWHHDIZF1Ie8b7wCISWbURtKN7GWcSAmW6m3AuHsxSAGYnWxF59DzNtTs7E1-PKXhNnrBxTyQN1E8ZKUVdHPfcNaO0mt7rUQaMyckXYzvMP8Wn7CpZWdpH6t_KQj04mhA_M5uhpHcN5On3Dk7HKIaEhdCuQuanYi3gFUk6jXfdiTRPW4er9rDAUlJdFh_uGimu-gTpqIi4N",
    },
    {
      id: 2,
      name: "شراب الفانيليا",
      code: "SY-042",
      category: "مستلزمات",
      categoryColor: "bg-blue-700",
      quantity: 2,
      unit: "نقص بالمخزون",
      unitIsAlert: true,
      purchasePrice: 120,
      sellPrice: 180,
      status: "نقص بالمخزون",
      statusColor:
        "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuB0d9jLSepehzP-XfUpMlaxyPFCK5yERbmAiXOFfSouYTiB39FlQkNNqiVc2QJ1IE5KW9Cgrbxv_i93IMKDfdNS2Ict03pi7fs3g5lnRCGJS77WBuusuMsNB57wTEKw6zQSh616lF79VNvBtFjC02ZawpiwCsTmy-y4uo4du3WGxx7yNT47kNs0G93VWxpxH83NVtufCYyHH4t2eHbxAi6lI-IxVwXr9-bUeWd6_78B_8i76gB6-EslV3ynjM4sNZ3H6maSUPPNCU57",
    },
    {
      id: 3,
      name: "كرواسون بالزبدة",
      code: "PA-105",
      category: "مخبوزات",
      categoryColor: "bg-yellow-600",
      quantity: 12,
      unit: "قطعة",
      purchasePrice: 15,
      sellPrice: 35,
      status: "متوفر",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA6iJfh0cXzI4NNeSoTl0uZI-O0OwgdbNf-6kmTBKZtoRrQIWRcFRb7Xz9v-Ut_30mTZAi8xIEZ0ZbMlMvmI7tx2gtca7Puo8ujDB7OGxkyx6PFiqZopLmB_tt5ci3224-1R1ZY73k-_xpW42siFyEDBirT99Z6DIteF_f2SD9W_uUe8nYtgYvqfOBcxXR_JQovfxxHVyF4X9VEggqgl8ls7zbiSo_XR5YYb5BR7BXnGaWSSF0SPLsk4HKqOs9nyJVE4FTyd1dp_nfN",
    },
    {
      id: 4,
      name: "أكواب تيك أواي (12oz)",
      code: "SU-882",
      category: "مستلزمات",
      categoryColor: "bg-blue-700",
      quantity: 500,
      unit: "قطعة",
      purchasePrice: 2.5,
      sellPrice: "-",
      status: "متوفر",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuB25LHJMYmjYVyTpzw6pENRhQ4_zihPoPWr0Giw8yELR_6cG05jkENK8qBkI0LntbFxCbTS48ILLgsySuIT-P6qXv2YhcluKHvg-RtoYaI6ODIOh7KfpW0Qt1M00Kizbej0uGLc6HO4FelPdo2YCl4dVpuRN4rNbT5wlbegr9T6DjKEjK-A8FmTLnvbU2K4zJxynJFsVgKpLI4r0lyc3YxnugwMCYS6RJamA7WYPZnWXLWx1eIcBkTDyfVmcNzM5lsQ7OteAumWiImc",
    },
    {
      id: 5,
      name: "كولومبي وسط",
      code: "CF-003",
      category: "بن القهوة",
      categoryColor: "bg-primary",
      quantity: 22,
      unit: "كجم",
      purchasePrice: 310,
      sellPrice: 520,
      status: "متوفر",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDuGUI0zrmKbp5GHC-q-0BghLmvY6XYEF41CYyu3YFZ329xs3tvlB0w4GW9yoZJpS6cJH5XgyClBxiEcUFxYASFx-vLOo_HoF_CjdGrA74Fd0CuKopL3Ok2g7ZcKNcBMkFxwoNP9swlYkc5I5Jp7hGHU8J7kgNxJcGa7v5uPwsrlruGHZvffco3J-91fBIZw5k4BAClA0rhUHNmkNK5OahW3Hqdk81p7bLK8YBW2nXnOZzZ2_Ax6I4WONgK-HHnyrsVZ5cVHZZ5Rf-y",
    },
  ];

  const categories = ["الكل", "بن القهوة", "مخبوزات", "مشروبات", "مستلزمات"];

  const filteredItems =
    filter === "الكل"
      ? inventoryItems
      : inventoryItems.filter((item) => item.category === filter);

  // Column Definitions for GenericDataTable
  const columns = [
    {
      header: "اسم الصنف",
      accessor: "name",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div>
            <p className="text-text-main dark:text-text-dark font-medium">
              {item.name}
            </p>
            <p className="text-text-muted dark:text-gray-400 text-xs">
              كود: {item.code}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "التصنيف",
      accessor: "category",
      render: (item) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EFEBE9] dark:bg-primary/10 text-text-muted dark:text-gray-300 text-xs font-medium border border-[#D7CCC8] dark:border-primary/20">
          <span
            className={`w-1.5 h-1.5 rounded-full ${item.categoryColor}`}></span>
          {item.category}
        </span>
      ),
    },
    {
      header: "الكمية المتاحة",
      accessor: "quantity",
      render: (item) => {
        const isLowStock = item.quantity <= 10;
        return (
          <div className="text-center">
            {isLowStock ? (
              <div className="flex flex-col items-center animate-pulse">
                <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                  {item.quantity}
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                </span>
                <span className="text-[10px] text-red-600 dark:text-red-400 uppercase font-bold">
                  {item.unit}
                </span>
              </div>
            ) : (
              <>
                <span className="text-text-main dark:text-text-dark font-bold">
                  {item.quantity}
                </span>
                <span className="text-xs text-text-muted dark:text-gray-400 mr-1">
                  {item.unit}
                </span>
              </>
            )}
          </div>
        );
      },
    },
    {
      header: "سعر الشراء",
      accessor: "purchasePrice",
      render: (item) => (
        <span className="text-text-muted dark:text-gray-400">
          {item.purchasePrice} ج.م
        </span>
      ),
    },
    {
      header: "سعر البيع",
      accessor: "sellPrice",
      render: (item) => (
        <span className="text-text-main dark:text-text-dark font-medium">
          {item.sellPrice === "-" ? "-" : `${item.sellPrice} ج.م`}
        </span>
      ),
    },
    {
      header: "الحالة",
      accessor: "status",
      render: (item) => {
        const isLowStock = item.quantity <= 10;
        return (
          <div className="text-center">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${isLowStock
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200"
                  : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200"
                }`}>
              {isLowStock ? "نقص بالمخزون" : "متوفر"}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div
      className="bg-background-light dark:bg-background-dark min-h-screen text-text-light dark:text-text-dark font-body transition-colors duration-300 p-4 sm:p-8"
      dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-main dark:text-text-dark mb-2 flex items-center gap-2">
            إدارة المخزون
            <span className="text-text-muted dark:text-gray-400 font-normal text-xl opacity-80">
              - الجرد
            </span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            إدارة مستويات المخزون، الأسعار وتفاصيل المنتجات
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                إجمالي الأصناف
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  145
                </h3>
                <span className="text-green-800 text-xs font-medium flex items-center bg-green-100 px-1.5 py-0.5 rounded">
                  <span className="material-symbols-outlined text-[14px]">
                    trending_up
                  </span>
                  12%
                </span>
              </div>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-icons-round text-primary text-xl">
                dataset
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-red-600 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                نواقص المخزون
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  3
                </h3>
                <span className="text-red-800 text-xs font-medium flex items-center bg-red-100 px-1.5 py-0.5 rounded">
                  إجراء مطلوب
                </span>
              </div>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <span className="material-icons-round text-red-600 dark:text-red-400 text-xl">
                warning
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-green-600 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                القيمة الإجمالية
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                  45 ألف{" "}
                  <span className="text-sm font-normal text-text-muted dark:text-gray-400 mr-1">
                    ج.م
                  </span>
                </h3>
                <span className="text-green-800 text-xs font-medium flex items-center bg-green-100 px-1.5 py-0.5 rounded">
                  +5%
                </span>
              </div>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="material-icons-round text-green-600 dark:text-green-400 text-xl">
                attach_money
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Table Section */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-3xl shadow-2xl p-6 border border-border-light dark:border-border-dark">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          {/* Search */}
          <div className="relative w-full lg:max-w-md group">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-text-muted dark:text-gray-400 group-focus-within:text-primary transition-colors">
                search
              </span>
            </div>
            <input
              className="block w-full pr-10 pl-3 py-2.5 rounded-lg leading-5 bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark placeholder-text-muted/60 dark:placeholder-gray-500 border border-border-light dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm shadow-sm text-right transition-all"
              placeholder="ابحث بالاسم، الكود، أو التصنيف..."
              type="text"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Warehouse Filter */}
            <div className="relative">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="appearance-none bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer">
                <option value="all">كل المخازن</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">
                warehouse
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${filter === cat
                    ? "bg-primary text-surface-light border-transparent shadow-md shadow-[#3E2723]/10 transform scale-105"
                    : "bg-background-light dark:bg-background-dark text-text-muted dark:text-gray-400 hover:text-primary hover:bg-[#EFEBE9] dark:hover:bg-primary/10 border-border-light dark:border-border-dark"
                  }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Generic Data Table */}
        <GenericDataTable
          columns={columns}
          data={filteredItems}
          loading={false}
          emptyMessage="لا توجد عناصر في المخزون"
        />
      </div>
    </div>
  );
};

export default InventoryPage;
