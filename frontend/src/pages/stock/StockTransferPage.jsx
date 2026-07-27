import React, { useState, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { useBranch } from "../../contexts/BranchContext";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import KgQuantityInput from "../../components/ui/KgQuantityInput";
import {
  inventoryService,
  warehouseService,
  settingsService,
  stockTransferService,
  categoryService,
} from "../../services/domainServices";
import authService from "../../services/authService";
import printStockTransfer from "../../utils/printStockTransfer";

const DRAFT_KEY = (fromWH) => `stockTransferDraft_${fromWH}`;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const StockTransferPage = () => {
  const navigate = useNavigate();
  const { activeBranchId, isGlobalRole, activeBranch } = useBranch();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");

  // Transfer state
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Multi-select / bulk state
  const [bulkSelectedIds, setBulkSelectedIds] = useState(new Set());
  const [bulkQty, setBulkQty] = useState(1);
  const [flaggedItemIds, setFlaggedItemIds] = useState(new Set());
  const flaggedTimerRef = useRef(null);

  // Draft restore state
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  // Clean up stale drafts (>7 days) on mount
  useEffect(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("stockTransferDraft_")) {
        try {
          const d = JSON.parse(localStorage.getItem(key));
          if (d?.savedAt && d.savedAt < weekAgo) keysToRemove.push(key);
        } catch {}
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const settings = await settingsService.get();
        const warehousesList = await warehouseService.getAll(true);
        setAllWarehouses(warehousesList);

        const user = authService.getCurrentUser();
        let initialSourceId = "";

        if (!isGlobalRole && activeBranch?.warehouseId) {
          initialSourceId = activeBranch.warehouseId.toString();
        } else if (!isGlobalRole && user?.branch?.warehouseId) {
          // Belt and braces: BranchContext now resolves activeBranch on login
          // rather than only after a refresh, so this rarely fires — but a
          // branch-scoped user must never fall through to the main warehouse.
          initialSourceId = user.branch.warehouseId.toString();
        } else if (settings && settings.mainWarehouseId) {
          initialSourceId = settings.mainWarehouseId.toString();
        } else if (warehousesList.length > 0) {
          initialSourceId = warehousesList[0].id.toString();
        }

        if (initialSourceId) {
          setFromWarehouseId(initialSourceId);
          const inventoryItems = await inventoryService.getInventory({
            warehouseId: initialSourceId,
          });
          setProducts(inventoryItems);
          checkForDraft(initialSourceId);
        }

        const dbCategories = await categoryService.getAll();
        setCategories([
          { id: "All", name: "كل الأصناف" },
          ...dbCategories.map((cat) => ({ id: cat.id, name: cat.name })),
        ]);
      } catch (error) {
        console.error("Failed to fetch data", error);
        toast.error(error.message || "فشل في تحميل البيانات");
      }
    };
    fetchData();
  }, [activeBranchId, isGlobalRole, activeBranch?.warehouseId]);

  // Auto-save draft on state changes.
  // Guard: if pendingDraft is set, the restore banner is showing and the user
  // hasn't decided yet — don't touch localStorage or the draft gets wiped on
  // the first render after page load (React batches fetchData + checkForDraft
  // state updates into one render, then this effect fires with selectedItems=[]).
  useEffect(() => {
    if (!fromWarehouseId) return;
    if (pendingDraft !== null) return;
    if (selectedItems.length === 0 && !notes && !selectedWarehouse) {
      localStorage.removeItem(DRAFT_KEY(fromWarehouseId));
      return;
    }
    localStorage.setItem(
      DRAFT_KEY(fromWarehouseId),
      JSON.stringify({
        savedAt: Date.now(),
        fromWarehouseId,
        selectedWarehouse,
        notes,
        selectedItems,
      })
    );
  }, [fromWarehouseId, selectedWarehouse, notes, selectedItems, pendingDraft]);

  const checkForDraft = (sourceId) => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(sourceId));
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.savedAt) return;
      if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(DRAFT_KEY(sourceId));
        return;
      }
      if (draft.selectedItems?.length > 0 || draft.notes || draft.selectedWarehouse) {
        setPendingDraft(draft);
        setShowRestoreBanner(true);
      }
    } catch {}
  };

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    const validItems = (pendingDraft.selectedItems || []).filter((di) =>
      products.some((p) => p.id === di.id)
    );
    const droppedCount = (pendingDraft.selectedItems?.length || 0) - validItems.length;
    setSelectedItems(validItems);
    if (pendingDraft.selectedWarehouse) setSelectedWarehouse(pendingDraft.selectedWarehouse);
    if (pendingDraft.notes) setNotes(pendingDraft.notes);
    if (droppedCount > 0) toast.error(`تم حذف ${droppedCount} صنف غير متاح من المسودة`);
    else toast.success("تم استرجاع التحويل السابق");
    setShowRestoreBanner(false);
    setPendingDraft(null);
  };

  const handleDiscardDraft = () => {
    if (fromWarehouseId) localStorage.removeItem(DRAFT_KEY(fromWarehouseId));
    setShowRestoreBanner(false);
    setPendingDraft(null);
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === "All" ||
      (product.categories && product.categories.includes(activeCategory));
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Single-click add (existing fast path)
  const handleAddItem = (product) => {
    if (selectedItems.find((item) => item.id === product.id)) {
      toast.error("الصنف موجود بالفعل في القائمة");
      return;
    }
    if (product.quantity <= 0) {
      toast.error("لا يوجد مخزون متاح لهذا الصنف");
      return;
    }
    setSelectedItems([...selectedItems, { ...product, transferQty: 1 }]);
    toast.success(`تمت إضافة ${product.name}`);
  };

  // Bulk selection handlers
  const handleToggleBulkSelect = (e, product) => {
    e.stopPropagation();
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const eligibleIds = filteredProducts.filter((p) => p.quantity > 0).map((p) => p.id);
    setBulkSelectedIds(new Set(eligibleIds));
  };

  const handleSelectCategory = () => {
    const eligibleIds = filteredProducts.filter((p) => p.quantity > 0).map((p) => p.id);
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      eligibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleClearBulkSelection = () => {
    setBulkSelectedIds(new Set());
    setBulkQty(1);
  };

  // Apply bulk qty — skips items where qty > available stock, flags them
  const handleApplyBulkQty = () => {
    if (!bulkQty || bulkQty <= 0) {
      toast.error("يرجى إدخال كمية صحيحة");
      return;
    }

    const skipped = [];
    const toAdd = [];
    const toUpdateIds = [];

    for (const productId of bulkSelectedIds) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;

      if (bulkQty > product.quantity) {
        skipped.push(product);
        continue;
      }

      if (selectedItems.find((si) => si.id === productId)) {
        toUpdateIds.push(productId);
      } else {
        toAdd.push({ ...product, transferQty: bulkQty });
      }
    }

    setSelectedItems((prev) => {
      const updated = prev.map((si) =>
        toUpdateIds.includes(si.id) ? { ...si, transferQty: bulkQty } : si
      );
      return [...updated, ...toAdd];
    });

    const appliedCount = toAdd.length + toUpdateIds.length;

    if (skipped.length > 0) {
      const names = skipped.slice(0, 3).map((p) => p.name).join("، ");
      const extra = skipped.length > 3 ? ` و${skipped.length - 3} آخرين` : "";
      toast.error(
        `${skipped.length} صنف تجاوزوا الرصيد المتاح: ${names}${extra}`,
        { duration: 6000 }
      );

      setFlaggedItemIds(new Set(skipped.map((p) => p.id)));
      if (flaggedTimerRef.current) clearTimeout(flaggedTimerRef.current);
      flaggedTimerRef.current = setTimeout(() => setFlaggedItemIds(new Set()), 10000);

      setTimeout(() => {
        const el = document.getElementById(`product-card-${skipped[0].id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }

    if (appliedCount > 0) {
      toast.success(`تم تطبيق الكمية على ${appliedCount} صنف`);
    }

    setBulkSelectedIds(new Set());
    setBulkQty(1);
  };

  const handleRemoveItem = (id) => {
    setSelectedItems(selectedItems.filter((item) => item.id !== id));
  };

  const isDecimalUnit = (unit) => {
    return unit && (unit.includes("كيلو") || unit.toLowerCase().includes("kg"));
  };

  const handleQtyChange = (id, direction) => {
    setSelectedItems(
      selectedItems.map((item) => {
        if (item.id === id) {
          const isDecimal = isDecimalUnit(item.unit);
          const step = isDecimal ? 0.1 : 1;
          let newQty = (item.transferQty || 0) + direction * step;
          const minQty = isDecimal ? 0.1 : 1;
          newQty = Math.max(minQty, Math.min(item.quantity, newQty));
          if (isDecimal) newQty = parseFloat(newQty.toFixed(2));
          return { ...item, transferQty: newQty };
        }
        return item;
      })
    );
  };

  const handleManualQtyChange = (id, value) => {
    setSelectedItems(
      selectedItems.map((item) => {
        if (item.id === id) {
          let qty;
          if (isDecimalUnit(item.unit)) {
            qty = parseFloat(value);
            if (isNaN(qty)) qty = 0;
          } else {
            qty = parseInt(value) || 0;
          }
          return { ...item, transferQty: Math.max(0, Math.min(item.quantity, qty)) };
        }
        return item;
      })
    );
  };

  const handleFromWarehouseChange = async (newId) => {
    setFromWarehouseId(newId);
    setSelectedItems([]);
    setBulkSelectedIds(new Set());
    setShowRestoreBanner(false);
    setPendingDraft(null);

    if (newId) {
      try {
        const inventoryItems = await inventoryService.getInventory({ warehouseId: newId });
        setProducts(inventoryItems);
        checkForDraft(newId);
      } catch (error) {
        console.error("Failed to update inventory", error);
        toast.error(error.message || "فشل تحديث المخزون");
      }
    } else {
      try {
        const inventoryItems = await inventoryService.getInventory({});
        setProducts(inventoryItems);
      } catch (error) {
        console.error("Failed to fetch all inventory", error);
        toast.error(error.message || "فشل تحديث المخزون");
      }
    }
  };

  const handleConfirmTransfer = async () => {
    if (!fromWarehouseId) {
      toast.error("يرجى اختيار المخزن المصدر (من)");
      return;
    }
    if (!selectedWarehouse) {
      toast.error("يرجى اختيار المخزن المستلم (إلى)");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("يرجى إضافة أصناف للتحويل");
      return;
    }
    for (const item of selectedItems) {
      if (item.transferQty > item.quantity) {
        toast.error(`الكمية المطلوبة لـ ${item.name} أكبر من المتاح`);
        return;
      }
    }
    setIsConfirmModalOpen(true);
  };

  const handleSubmitTransfer = async () => {
    try {
      const user = authService.getCurrentUser();
      const transferData = {
        userId: user.id,
        fromWarehouseId: parseInt(fromWarehouseId),
        toWarehouseId: parseInt(selectedWarehouse),
        notes,
        items: selectedItems.map((item) => ({
          itemId: item.id,
          quantity: item.transferQty,
        })),
      };

      const result = await stockTransferService.create(transferData);

      const fromWh = allWarehouses.find((w) => w.id === parseInt(fromWarehouseId));
      const toWh = allWarehouses.find((w) => w.id === parseInt(selectedWarehouse));
      const transferForPrint = {
        ...result,
        fromWarehouseName: fromWh?.name || "مخزن",
        toWarehouseName: toWh?.name || "مخزن",
        notes,
        items: selectedItems.map((i) => ({ name: i.name, quantity: i.transferQty, unit: i.unit })),
      };

      toast.success(`تم التحويل بنجاح - رقم: ${result.transferNumber}`);

      // Clear draft after successful submit
      if (fromWarehouseId) localStorage.removeItem(DRAFT_KEY(fromWarehouseId));

      setSelectedItems([]);
      setSelectedWarehouse("");
      setNotes("");
      setBulkSelectedIds(new Set());
      setIsConfirmModalOpen(false);

      printStockTransfer(transferForPrint);

      const inventoryItems = await inventoryService.getInventory({ warehouseId: fromWarehouseId });
      setProducts(inventoryItems);
    } catch (error) {
      console.error("Error creating transfer:", error);
      const errorMessage = error.message || error.data?.message || "حدث خطأ أثناء التحويل";
      toast.error(errorMessage);
    }
  };

  // Calculations
  const totalItems = selectedItems.length;
  const quantityByUnit = selectedItems.reduce((acc, item) => {
    const u = item.unit || "—";
    acc[u] = (acc[u] || 0) + (item.transferQty || 0);
    return acc;
  }, {});

  const sourceWarehouseName = useMemo(() => {
    if (!fromWarehouseId) return "";
    return allWarehouses.find((w) => w.id === parseInt(fromWarehouseId))?.name || "مخزن الفرع";
  }, [fromWarehouseId, allWarehouses]);

  return (
    <>
      <div
        className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-6rem)] overflow-y-auto lg:overflow-hidden bg-background-light dark:bg-background-dark text-sm print:hidden"
        dir="rtl">

        {/* Confirmation Modal */}
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="تأكيد التحويل المخزني">
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-6 border border-primary/20">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">من المخزن:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">
                    {allWarehouses.find((w) => w.id === parseInt(fromWarehouseId))?.name || "..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">إلى المخزن:</span>
                  <span className="font-bold text-primary">
                    {allWarehouses.find((w) => w.id === parseInt(selectedWarehouse))?.name}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-primary/20">
                  <span className="text-gray-600 dark:text-gray-400">عدد الأصناف:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">{totalItems}</span>
                </div>
                {Object.entries(quantityByUnit).map(([unit, qty]) => (
                  <div key={unit} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">إجمالي ({unit}):</span>
                    <span className="font-bold text-gray-800 dark:text-gray-100">
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 rounded-lg font-bold transition-colors">
                إلغاء
              </button>
              <button
                onClick={handleSubmitTransfer}
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">check_circle</span>
                <span>تأكيد التحويل</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* Product Selection Area */}
        <div className="order-2 lg:order-1 flex-1 flex flex-col h-[500px] lg:h-full overflow-hidden bg-background-light dark:bg-zinc-900 relative border-l border-gray-200 dark:border-zinc-700">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 bg-card-light dark:bg-card-dark shadow-sm z-10 shrink-0 gap-3 md:gap-0">
            <div className="flex items-center justify-between md:justify-start text-gray-500 dark:text-gray-400 gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="hover:text-primary transition-colors flex items-center p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="hover:text-primary transition-colors flex items-center">
                  <span className="material-symbols-outlined">home</span>
                </button>
                <span className="mx-2 text-gray-300">/</span>
              </div>
              <span className="font-bold text-lg text-primary dark:text-primary-dark">تحويل مخزني</span>
            </div>
            <button
              onClick={() => navigate("/reports/custom/stock-transfers")}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold transition-colors border border-gray-200 dark:border-zinc-600">
              <span className="material-symbols-outlined text-lg">history</span>
              سجل التحويلات
            </button>
            <div className="relative w-full md:w-auto">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <span className="material-symbols-outlined text-lg">search</span>
              </span>
              <input
                className="pr-10 pl-4 py-2 w-full md:w-80 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-400 text-sm shadow-sm transition-all font-sans"
                placeholder="بحث عن صنف..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Category pills */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  const container = document.getElementById("categories-slider");
                  container.scrollBy({ left: 200, behavior: "smooth" });
                }}
                className="flex-shrink-0 bg-white dark:bg-zinc-800 rounded-lg p-2 shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all border border-gray-200 dark:border-zinc-700">
                <span className="material-symbols-outlined text-primary text-xl">chevron_right</span>
              </button>
              <div
                id="categories-slider"
                className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg shadow-sm cursor-pointer text-sm font-bold transition-all duration-200 ${
                      activeCategory === cat.id
                        ? "bg-primary text-white shadow-md"
                        : "bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                    }`}>
                    {cat.name}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const container = document.getElementById("categories-slider");
                  container.scrollBy({ left: -200, behavior: "smooth" });
                }}
                className="flex-shrink-0 bg-white dark:bg-zinc-800 rounded-lg p-2 shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all border border-gray-200 dark:border-zinc-700">
                <span className="material-symbols-outlined text-primary text-xl">chevron_left</span>
              </button>
            </div>

            {/* Selection action buttons */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                onClick={handleSelectAllVisible}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                <span className="material-symbols-outlined text-sm">select_all</span>
                تحديد الكل
              </button>
              {activeCategory !== "All" && (
                <button
                  onClick={handleSelectCategory}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                  <span className="material-symbols-outlined text-sm">checklist</span>
                  تحديد الفئة
                </button>
              )}
              {bulkSelectedIds.size > 0 && (
                <button
                  onClick={handleClearBulkSelection}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors">
                  <span className="material-symbols-outlined text-sm">deselect</span>
                  إلغاء التحديد ({bulkSelectedIds.size})
                </button>
              )}
            </div>

            {/* Bulk quantity action bar */}
            {bulkSelectedIds.size > 0 && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  تم تحديد {bulkSelectedIds.size} صنف
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                    الكمية:
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={bulkQty}
                    onChange={(e) => setBulkQty(parseFloat(e.target.value) || 1)}
                    className="w-24 text-center border border-amber-300 dark:border-amber-600 rounded-lg py-1.5 px-2 text-sm font-bold bg-white dark:bg-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleApplyBulkQty}
                  className="flex items-center gap-1 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-sm">check</span>
                  تطبيق الكمية
                </button>
              </div>
            )}

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const isAlreadySelected = !!selectedItems.find((i) => i.id === product.id);
                const isBulkChecked = bulkSelectedIds.has(product.id);
                const isFlagged = flaggedItemIds.has(product.id);
                return (
                  <div
                    id={`product-card-${product.id}`}
                    key={product.id}
                    onClick={(e) =>
                      bulkSelectedIds.size > 0
                        ? handleToggleBulkSelect(e, product)
                        : handleAddItem(product)
                    }
                    className={`bg-card-light dark:bg-card-dark rounded shadow-sm border overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col h-28 group relative active:scale-95 transition-transform ${
                      isFlagged
                        ? "border-red-400 dark:border-red-500 ring-1 ring-red-400"
                        : isBulkChecked
                        ? "border-amber-400 dark:border-amber-500 ring-1 ring-amber-400"
                        : "border-gray-200 dark:border-zinc-700"
                    }`}>

                    {/* Checkbox / already-added indicator */}
                    <div
                      className="absolute top-1 right-1 z-10"
                      onClick={(e) => handleToggleBulkSelect(e, product)}>
                      {isAlreadySelected ? (
                        <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-lg transition-colors ${
                            isBulkChecked
                              ? "text-amber-500"
                              : "text-gray-300 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300"
                          }`}>
                          {isBulkChecked ? "check_box" : "check_box_outline_blank"}
                        </span>
                      )}
                    </div>

                    {/* Flagged badge */}
                    {isFlagged && (
                      <div className="absolute top-1 left-1 z-10">
                        <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded leading-tight">
                          تجاوز الرصيد ({product.quantity})
                        </span>
                      </div>
                    )}

                    <div className="p-3 flex flex-col flex-1 justify-between h-full pt-6">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1 leading-tight line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="mt-auto border-t border-gray-100 dark:border-zinc-700 pt-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">متاح</span>
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded ${
                                product.quantity <= product.reorderPoint
                                  ? "text-red-600 bg-red-50 dark:bg-red-900/20"
                                  : product.quantity < 50
                                  ? "text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                                  : "text-green-600 bg-green-50 dark:bg-green-900/20"
                              }`}>
                              {product.quantity} {product.unit}
                            </span>
                          </div>
                          {!fromWarehouseId && product.warehouses && product.warehouses.length > 0 && (
                            <div
                              className="text-[10px] text-gray-400 mt-1 truncate"
                              title={product.warehouses.join(", ")}>
                              في: {product.warehouses.join("، ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Transfer Details Sidebar */}
        <div className="contents lg:flex lg:flex-col lg:w-[450px] xl:w-[600px] lg:h-full lg:bg-card-light lg:dark:bg-card-dark lg:shadow-xl lg:z-20 lg:shrink-0 lg:border-r lg:border-gray-200 lg:dark:border-zinc-700 order-1 lg:order-2">
          {/* Header Form */}
          <div className="order-1 lg:order-none p-4 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
            <h2 className="text-lg font-bold text-primary dark:text-primary mb-3 flex items-center">
              <span className="material-symbols-outlined ml-2">local_shipping</span>
              بيانات التحويل
            </h2>
            <div className="flex gap-4 mb-3">
              {/* Source warehouse: read-only label for non-global, dropdown for global */}
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">من المخزن</label>
                {isGlobalRole ? (
                  <select
                    className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-primary focus:ring-primary focus:border-primary text-sm font-bold shadow-sm"
                    value={fromWarehouseId}
                    onChange={(e) => handleFromWarehouseChange(e.target.value)}>
                    <option value="">-- اختر المخزن --</option>
                    {allWarehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full rounded p-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 text-sm font-bold flex items-center gap-2 min-h-[38px]">
                    <span className="material-symbols-outlined text-sm text-gray-400">lock</span>
                    <span>{sourceWarehouseName || "..."}</span>
                  </div>
                )}
              </div>
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-primary mb-1">إلى المخزن *</label>
                <select
                  className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-primary focus:ring-primary focus:border-primary text-sm font-bold shadow-sm"
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}>
                  <option value="">-- اختر المخزن --</option>
                  {allWarehouses
                    .filter((wh) => wh.id.toString() !== fromWarehouseId.toString())
                    .map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ملاحظات</label>
              <textarea
                className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 focus:ring-primary focus:border-primary text-sm shadow-sm resize-none"
                rows="2"
                placeholder="ملاحظات إضافية (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Items list area */}
          <div className="order-3 lg:order-none flex flex-col lg:flex lg:flex-col lg:flex-1 lg:overflow-hidden bg-card-light dark:bg-card-dark">
            {/* Draft restore banner */}
            {showRestoreBanner && pendingDraft && (
              <div className="mx-3 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-lg flex-shrink-0">restore</span>
                <span className="flex-1 text-xs text-blue-800 dark:text-blue-200 font-medium">
                  يوجد تحويل غير مكتمل ({pendingDraft.selectedItems?.length || 0} صنف)
                </span>
                <button
                  onClick={handleRestoreDraft}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
                  استرجاع
                </button>
                <button
                  onClick={handleDiscardDraft}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition-colors">
                  تجاهل
                </button>
              </div>
            )}

            {/* List Header */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-500 dark:text-gray-400 grid grid-cols-12 gap-2 mt-2">
              <div className="col-span-5">الصنف</div>
              <div className="col-span-2 text-center">رصيد المصدر</div>
              <div className="col-span-3 text-center">كمية التحويل</div>
              <div className="col-span-2 text-center">الوحدة</div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-0 flex flex-col min-h-[200px] lg:min-h-0">
              {selectedItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 py-8 lg:py-0">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-6xl mb-2">inventory_2</span>
                    <p>لم يتم اختيار أي أصناف بعد</p>
                  </div>
                </div>
              ) : (
                selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 group grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{item.name}</div>
                      <div className="text-[10px] text-gray-400">#{item.code}</div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-1">
                      {isDecimalUnit(item.unit) ? (
                        <KgQuantityInput
                          value={item.transferQty || 0}
                          onChange={(v) =>
                            setSelectedItems((prev) =>
                              prev.map((si) =>
                                si.id === item.id
                                  ? { ...si, transferQty: Math.min(v, si.quantity) }
                                  : si
                              )
                            )
                          }
                          unit="kg"
                          min={0}
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => handleQtyChange(item.id, -1)}
                            className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 rounded text-gray-600 dark:text-gray-200 font-bold">
                            -
                          </button>
                          <input
                            className="w-14 text-center border border-gray-300 dark:border-zinc-600 rounded py-1 px-1 text-sm font-bold bg-white dark:bg-zinc-800 focus:border-primary focus:ring-0"
                            type="number"
                            step="1"
                            value={item.transferQty}
                            onChange={(e) => handleManualQtyChange(item.id, e.target.value)}
                          />
                          <button
                            onClick={() => handleQtyChange(item.id, 1)}
                            className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 rounded text-gray-600 dark:text-gray-200 font-bold">
                            +
                          </button>
                        </>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-between pl-2">
                      <span className="text-xs font-medium text-gray-500">{item.unit}</span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-400 hover:text-red-600 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary & Actions */}
            <div className="mt-auto bg-card-light dark:bg-card-dark border-t border-gray-200 dark:border-zinc-700 p-4 shadow-lg z-30 sticky bottom-0 lg:static">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                  عدد الأصناف:
                  <span className="text-gray-900 dark:text-white text-lg mr-1">{totalItems}</span>
                </span>
                {Object.entries(quantityByUnit).map(([unit, qty]) => (
                  <span key={unit} className="text-sm font-bold text-gray-600 dark:text-gray-400">
                    إجمالي ({unit}):
                    <span className="text-gray-900 dark:text-white text-lg mr-1">
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}
                    </span>
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setSelectedItems([]);
                    setSelectedWarehouse("");
                    setNotes("");
                    setBulkSelectedIds(new Set());
                  }}
                  className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 py-3 rounded-lg font-bold shadow-sm transition-colors">
                  <span className="material-symbols-outlined">cancel</span>
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold shadow-md transition-colors transform active:scale-95">
                  <span className="material-symbols-outlined">check_circle</span>
                  تأكيد التحويل
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
};

export default StockTransferPage;
