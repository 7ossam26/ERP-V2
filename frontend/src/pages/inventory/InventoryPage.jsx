import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GenericDataTable from "../../components/shared/GenericDataTable";

import { categoryService, branchService } from "../../services/domainServices";
import { inventoryService } from "../../services/inventoryService";

const InventoryPage = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("الكل");
  const [stockFilter, setStockFilter] = useState("all"); // all, below-reorder, zero
  const [branches, setBranches] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");

  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalValue: 0,
  });

  const [categories, setCategories] = useState(["الكل"]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchesData, categoriesData] = await Promise.all([
          branchService.getAll(),
          categoryService.getAll(),
        ]);
        setBranches(branchesData);
        setCategories(["الكل", ...categoriesData.map((c) => c.name)]);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch when filters change
  useEffect(() => {
    const fetchData = async () => {
      try {
        const filters = {};
        if (selectedWarehouse !== "all")
          filters.warehouseId = selectedWarehouse;
        if (filter !== "الكل") filters.category = filter;

        const [inventoryData, statsData] = await Promise.all([
          inventoryService.getInventory(filters),
          inventoryService.getStats(filters),
        ]);

        setInventoryItems(inventoryData);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [filter, selectedWarehouse]);

  // Data is now already filtered by backend, so we just use inventoryItems
  // But searching is client side for now
  const [searchQuery, setSearchQuery] = useState("");

  const displayedItems = inventoryItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toString().includes(searchQuery));
    if (!matchesSearch) return false;
    if (stockFilter === "below-reorder") return item.quantity <= item.reorderPoint;
    if (stockFilter === "zero") return item.quantity <= 0;
    return true;
  });

  // Column Definitions for GenericDataTable
  const columns = [
    {
      header: "اسم الصنف",
      accessor: "name",
      render: (item) => (
        <div
          className="flex items-center gap-3 justify-end text-right"
          dir="ltr">
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
                  <span className="material-symbols-outlined text-[14px]">
                    warning
                  </span>
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
      header: "متوسط سعر الشراء",
      accessor: "purchasePrice",
      render: (item) => (
        <span className="text-text-muted dark:text-gray-400">
          {item.purchasePrice} ج.م
        </span>
      ),
    },
    {
      header: "سعر التكلفة (الأخير)",
      accessor: "costPrice",
      render: (item) => (
        <span className="text-text-muted dark:text-gray-400 font-medium">
          {item.costPrice || 0} ج.م
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
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                isLowStock
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                إجمالي الأصناف
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.totalItems || 0}
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
                  {stats.lowStockCount || 0}
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
                إجمالي سعر الشراء
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                  {stats.totalValue ? stats.totalValue.toLocaleString() : 0}{" "}
                  <span className="text-sm font-normal text-text-muted dark:text-gray-400 mr-1">
                    ج.م
                  </span>
                </h3>
              </div>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="material-icons-round text-green-600 dark:text-green-400 text-xl">
                attach_money
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                إجمالي سعر البيع
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                  {stats.totalSellingPrice
                    ? stats.totalSellingPrice.toLocaleString()
                    : 0}{" "}
                  <span className="text-sm font-normal text-text-muted dark:text-gray-400 mr-1">
                    ج.م
                  </span>
                </h3>
              </div>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="material-icons-round text-blue-600 dark:text-blue-400 text-xl">
                point_of_sale
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-purple-600 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                الأرباح المتوقعة
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                  {stats.totalProfit ? stats.totalProfit.toLocaleString() : 0}{" "}
                  <span className="text-sm font-normal text-text-muted dark:text-gray-400 mr-1">
                    ج.م
                  </span>
                </h3>
                <span className="text-purple-800 text-xs font-medium flex items-center bg-purple-100 px-1.5 py-0.5 rounded">
                  <span className="material-symbols-outlined text-[14px]">
                    trending_up
                  </span>
                </span>
              </div>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span className="material-icons-round text-purple-600 dark:text-purple-400 text-xl">
                savings
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips + Links */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {[
          { key: "all", label: "الكل", icon: "list" },
          { key: "below-reorder", label: "تحت حد الطلب", icon: "warning", color: "text-orange-600" },
          { key: "zero", label: "نفذ المخزون", icon: "error", color: "text-red-600" },
        ].map((chip) => (
          <button key={chip.key} onClick={() => setStockFilter(chip.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              stockFilter === chip.key
                ? "bg-primary text-white border-primary"
                : "bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}>
            <span className={`material-icons-round text-[16px] ${stockFilter !== chip.key ? (chip.color || "") : ""}`}>{chip.icon}</span>
            {chip.label}
          </button>
        ))}
        <div className="mr-auto flex gap-2">
          <button onClick={() => navigate("/inventory/alerts")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 hover:bg-orange-100">
            <span className="material-icons-round text-[16px]">notifications</span>
            تنبيهات إعادة الطلب
          </button>
          <button onClick={() => navigate("/inventory/dead-stock")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100">
            <span className="material-icons-round text-[16px]">inventory</span>
            المخزون الراكد
          </button>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Filter */}
            <div className="relative">
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  // Trigger fetch with new warehouse
                }}
                className="appearance-none bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl py-2.5 pl-10 pr-10 text-sm font-bold text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer">
                <option value="all">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.warehouseId}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">
                store
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-1 bg-background-light dark:bg-background-dark p-1 rounded-full border border-border-light dark:border-border-dark">
            <button
              onClick={() => {
                const container = document.getElementById(
                  "category-scroll-container",
                );
                if (container)
                  container.scrollBy({ left: 100, behavior: "smooth" });
              }}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <span className="material-symbols-outlined text-sm">
                chevron_right
              </span>
            </button>
            <div
              id="category-scroll-container"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border transition-all duration-200 ${
                    filter === cat
                      ? "bg-primary text-surface-light border-transparent shadow-sm"
                      : "bg-transparent text-text-muted dark:text-gray-400 hover:text-primary hover:bg-[#EFEBE9] dark:hover:bg-primary/10 border-transparent"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const container = document.getElementById(
                  "category-scroll-container",
                );
                if (container)
                  container.scrollBy({ left: -100, behavior: "smooth" });
              }}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <span className="material-symbols-outlined text-sm">
                chevron_left
              </span>
            </button>
          </div>
        </div>

        {/* Generic Data Table */}
        <GenericDataTable
          columns={columns}
          data={displayedItems}
          loading={false}
          emptyMessage="لا توجد عناصر في المخزون"
        />
      </div>
    </div>
  );
};

export default InventoryPage;
