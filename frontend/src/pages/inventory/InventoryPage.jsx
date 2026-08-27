import React, { useState, useEffect, useMemo } from "react";
import GenericDataTable from "../../components/shared/GenericDataTable";
import { useBranch } from "../../contexts/BranchContext";
import InitialInventoryTab from "./InitialInventoryTab";
import StockWriteOffTab from "./StockWriteOffTab";
import AuthService from "../../services/authService";

import { categoryService, branchService } from "../../services/domainServices";
import { inventoryService } from "../../services/inventoryService";
import { printInventoryCount } from "../../utils/printInventoryCount";
import { exportInventoryToCsv } from "../../utils/exportInventory";

const InventoryPage = () => {
  const { activeBranchId, isGlobalRole, activeBranch } = useBranch();
  const [activeTab, setActiveTab] = useState("inventory");
  const [filter, setFilter] = useState("الكل");
  const [branches, setBranches] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    isGlobalRole ? "all" : (activeBranch?.warehouseId?.toString() || ""),
  );

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
    // A non-global user with no resolved warehouse must not fall back to "all" —
    // that widens the scope instead of narrowing it. Hold the initial empty state
    // and wait for the branch to resolve instead.
    if (!isGlobalRole && !activeBranch?.warehouseId) return;

    const fetchData = async () => {
      try {
        const filters = {};
        // Non-global users are pinned to their active branch's warehouse —
        // ignore any stale selectedWarehouse and use the active branch directly.
        const effectiveWarehouse = isGlobalRole
          ? selectedWarehouse
          : activeBranch.warehouseId.toString();
        if (effectiveWarehouse !== "all")
          filters.warehouseId = effectiveWarehouse;
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
  }, [filter, selectedWarehouse, activeBranchId, isGlobalRole, activeBranch]);

  // Non-global users can only see their accessible branches — the inventory
  // API enforces this server-side, so showing other branches would silently
  // return zero stock.
  const visibleBranches = useMemo(() => {
    if (isGlobalRole) return branches;
    if (!activeBranch?.warehouseId) return [];
    return branches.filter((b) => b.warehouseId === activeBranch.warehouseId);
  }, [isGlobalRole, activeBranch, branches]);

  // For non-global users, the dropdown reflects the active branch's warehouse,
  // not the local selectedWarehouse state (which may be stale).
  const dropdownValue = isGlobalRole
    ? selectedWarehouse
    : activeBranch?.warehouseId?.toString() || "";

  // Data is now already filtered by backend, so we just use inventoryItems
  // But searching is client side for now
  const [searchQuery, setSearchQuery] = useState("");
  // Toggle to hide items with zero available quantity (out of stock).
  const [hideZero, setHideZero] = useState(false);

  // The warehouse actually in effect: global users follow the dropdown, others
  // are pinned to their active branch (mirrors the fetch effect above).
  const resolveSelectedWarehouse = () =>
    isGlobalRole ? selectedWarehouse : activeBranch?.warehouseId?.toString();

  // Human-readable name for the selected branch (or "all branches").
  const resolveBranchName = (effectiveWarehouse) => {
    if (!effectiveWarehouse || effectiveWarehouse === "all") return "كل الفروع";
    return (
      branches.find((b) => b.warehouseId?.toString() === effectiveWarehouse)
        ?.name ||
      activeBranch?.name ||
      ""
    );
  };

  // Print the full stocktake (جرد) sheet for the selected branch. Intentionally
  // fetches the complete item set (no category/search/hide-zero) so the printed
  // sheet is a full جرد regardless of the on-screen filters.
  const [isPrinting, setIsPrinting] = useState(false);
  // After clicking "طباعة الجرد" we ask whether to include the price columns.
  const [showPricesPrompt, setShowPricesPrompt] = useState(false);
  const runPrint = async (includePrices) => {
    setShowPricesPrompt(false);
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const effectiveWarehouse = resolveSelectedWarehouse();

      const filters = {};
      if (effectiveWarehouse && effectiveWarehouse !== "all")
        filters.warehouseId = effectiveWarehouse;

      const items = await inventoryService.getInventory(filters);
      const branchName = resolveBranchName(effectiveWarehouse);

      printInventoryCount({ items, branchName, includePrices });
    } catch (error) {
      console.error("Failed to print inventory count:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const displayedItems = inventoryItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toString().includes(searchQuery));
    const matchesStock = !hideZero || Number(item.quantity) !== 0;
    return matchesSearch && matchesStock;
  });

  // Export the currently displayed rows to CSV — respects every active filter
  // (branch, category, search, hide-zero) so "what you see is what you export".
  const handleExport = () => {
    const branchName = resolveBranchName(resolveSelectedWarehouse());
    exportInventoryToCsv({ items: displayedItems, branchName });
  };

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
                  {parseFloat(Number(item.quantity).toFixed(4))}
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
                  {parseFloat(Number(item.quantity).toFixed(4))}
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
      header: "إجمالي التكلفة",
      accessor: "totalCost",
      render: (item) => {
        // Total Price (cost basis) = quantity (kg) × last cost price per kg.
        // Recomputed on render, so it tracks any change to quantity/costPrice.
        const total = Number(item.quantity) * Number(item.costPrice || 0);
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md font-medium bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30">
            {Number(total.toFixed(2)).toLocaleString()} ج.م
          </span>
        );
      },
    },
    {
      header: "إجمالي سعر البيع",
      accessor: "totalSell",
      render: (item) => {
        // Total Price (sale basis) = quantity (kg) × sale price per kg.
        // sellPrice may be "-" when no price is set — keep it as "-" then.
        const hasSellPrice =
          item.sellPrice !== "-" && !isNaN(Number(item.sellPrice));
        const total = hasSellPrice
          ? Number(item.quantity) * Number(item.sellPrice)
          : null;
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md font-medium bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30">
            {total === null
              ? "-"
              : `${Number(total.toFixed(2)).toLocaleString()} ج.م`}
          </span>
        );
      },
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

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6 bg-surface-light dark:bg-surface-dark p-1.5 rounded-xl border border-border-light dark:border-border-dark w-fit shadow-sm">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "inventory"
              ? "bg-primary text-white shadow-sm"
              : "text-text-muted dark:text-gray-400 hover:text-primary hover:bg-primary/10"
          }`}>
          <span className="material-symbols-outlined text-base">inventory_2</span>
          المخزون
        </button>
        <button
          onClick={() => setActiveTab("initial")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "initial"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-text-muted dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          }`}>
          <span className="material-symbols-outlined text-base">history_edu</span>
          المخزون الافتتاحي
        </button>
        {/* إهلاك removes stock and charges its cost to COGS, so it is gated on
            its own permission rather than on INVENTORY_COUNT. Rose, not amber:
            it must never be mistaken for the opening tab, which ADDS stock. */}
        {AuthService.hasPermission("STOCK_WRITE_OFF") && (
          <button
            onClick={() => setActiveTab("writeoff")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "writeoff"
                ? "bg-rose-500 text-white shadow-sm"
                : "text-text-muted dark:text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            }`}>
            <span className="material-symbols-outlined text-base">
              delete_sweep
            </span>
            إهلاك
          </button>
        )}
      </div>

      {/* Initial Inventory Tab */}
      {activeTab === "initial" && <InitialInventoryTab />}

      {/* Stock Write-Off Tab */}
      {activeTab === "writeoff" && <StockWriteOffTab />}

      {/* Main Inventory. Gated on an explicit === "inventory": a `!== "initial"`
          test renders this whole page underneath every tab added after the
          second one. */}
      {activeTab === "inventory" && <>

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

      {/* Filters & Table Section */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-3xl shadow-2xl p-6 border border-border-light dark:border-border-dark">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          {/* Search + controls grouped so they never get pushed off-screen */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] lg:w-72 lg:flex-none group">
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

            {/* Hide zero-stock toggle */}
            <button
              onClick={() => setHideZero((v) => !v)}
              aria-pressed={hideZero}
              title="إخفاء الأصناف ذات الكمية صفر"
              className={`inline-flex items-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold border transition-all outline-none ${
                hideZero
                  ? "bg-primary text-white border-transparent shadow-sm"
                  : "bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border-border-light dark:border-border-dark hover:text-primary hover:border-primary"
              }`}>
              <span className="material-symbols-outlined text-[20px]">
                {hideZero ? "visibility_off" : "visibility"}
              </span>
              إخفاء الصفرية
            </button>

            {/* Branch Filter */}
            <div className="relative">
              <select
                value={dropdownValue}
                disabled={!isGlobalRole && visibleBranches.length <= 1}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  // Trigger fetch with new warehouse
                }}
                className="appearance-none bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl py-2.5 pl-10 pr-10 text-sm font-bold text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                {isGlobalRole && <option value="all">كل الفروع</option>}
                {visibleBranches.map((branch) => (
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

            {/* Print inventory count (جرد) sheet — asks about prices first */}
            <button
              onClick={() => setShowPricesPrompt(true)}
              disabled={isPrinting}
              title="طباعة كشف الجرد للفرع المحدد"
              className="inline-flex items-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold border transition-all outline-none bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border-border-light dark:border-border-dark hover:text-primary hover:border-primary disabled:opacity-60 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-[20px]">
                {isPrinting ? "hourglass_top" : "print"}
              </span>
              طباعة الجرد
            </button>

            {/* Export displayed rows to CSV (respects active filters) */}
            <button
              onClick={handleExport}
              disabled={displayedItems.length === 0}
              title="تصدير الأصناف المعروضة إلى ملف Excel/CSV"
              className="inline-flex items-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold border transition-all outline-none bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border-border-light dark:border-border-dark hover:text-primary hover:border-primary disabled:opacity-60 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-[20px]">
                download
              </span>
              تصدير Excel
            </button>
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
          dense
          maxHeightClass="max-h-none"
        />
      </div>

      {/* Prices prompt shown after clicking "طباعة الجرد" */}
      {showPricesPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPricesPrompt(false)}>
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl border border-border-light dark:border-border-dark w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-text-main dark:text-text-dark mb-1">
              طباعة الجرد
            </h3>
            <p className="text-sm text-text-muted dark:text-gray-400 mb-5">
              هل تريد تضمين أسعار التكلفة والبيع في المطبوعة؟
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => runPrint(true)}
                disabled={isPrinting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-60 transition-all">
                <span className="material-symbols-outlined text-[20px]">
                  sell
                </span>
                طباعة بالأسعار
              </button>
              <button
                onClick={() => runPrint(false)}
                disabled={isPrinting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:text-primary hover:border-primary disabled:opacity-60 transition-all">
                <span className="material-symbols-outlined text-[20px]">
                  print
                </span>
                طباعة بدون أسعار
              </button>
              <button
                onClick={() => setShowPricesPrompt(false)}
                className="w-full rounded-xl py-2 px-4 text-sm font-bold text-text-muted dark:text-gray-400 hover:text-text-main dark:hover:text-text-dark transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      </>}
    </div>
  );
};

export default InventoryPage;
