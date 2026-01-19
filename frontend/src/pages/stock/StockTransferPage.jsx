import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import {
  inventoryService,
  warehouseService,
  settingsService,
  stockTransferService,
  categoryService,
} from "../../services/domainServices";
import authService from "../../services/authService";

const StockTransferPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allWarehouses, setAllWarehouses] = useState([]); // Store all for selection
  const [fromWarehouseId, setFromWarehouseId] = useState("");


  // Transfer state
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch system settings to get main warehouse default
        const settings = await settingsService.get();
        const warehousesList = await warehouseService.getAll();
        setAllWarehouses(warehousesList);

        let initialSourceId = "";

        if (settings && settings.mainWarehouseId) {
          initialSourceId = settings.mainWarehouseId.toString();
        } else if (warehousesList.length > 0) {
          initialSourceId = warehousesList[0].id.toString();
        }

        if (initialSourceId) {
          setFromWarehouseId(initialSourceId);
          // Fetch inventory from initial source
          const inventoryItems = await inventoryService.getInventory({
            warehouseId: initialSourceId,
          });
          setProducts(inventoryItems);
        }

        // Fetch categories
        const dbCategories = await categoryService.getAll();
        setCategories([
          { id: "All", name: "كل الأصناف" },
          ...dbCategories.map((cat) => ({ id: cat.id, name: cat.name })),
        ]);
      } catch (error) {
        console.error("Failed to fetch data", error);
        toast.error("فشل في تحميل البيانات");
      }
    };
    fetchData();
  }, []);

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === "All" ||
      (product.categories && product.categories.includes(activeCategory));
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch; // Show all items regardless of stock
  });

  // Handlers
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

  const handleRemoveItem = (id) => {
    setSelectedItems(selectedItems.filter((item) => item.id !== id));
  };

  const handleQtyChange = (id, change) => {
    setSelectedItems(
      selectedItems.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(
            1,
            Math.min(item.quantity, (item.transferQty || 0) + change)
          );
          return { ...item, transferQty: newQty };
        }
        return item;
      })
    );
  };

  const handleManualQtyChange = (id, value) => {
    const qty = parseInt(value) || 0;
    setSelectedItems(
      selectedItems.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            transferQty: Math.max(0, Math.min(item.quantity, qty)),
          };
        }
        return item;
      })
    );
  };

  const handleFromWarehouseChange = async (newId) => {
    setFromWarehouseId(newId);
    setSelectedItems([]); // Clear selected items when changing source to limit confusion

    if (newId) {
      try {
        const inventoryItems = await inventoryService.getInventory({
          warehouseId: newId,
        });
        setProducts(inventoryItems);
      } catch (error) {
        console.error("Failed to update inventory", error);
        toast.error("فشل تحديث المخزون");
      }
    } else {
      try {
        const inventoryItems = await inventoryService.getInventory({});
        setProducts(inventoryItems);
      } catch (error) {
        console.error("Failed to fetch all inventory", error);
        toast.error("فشل تحديث المخزون");
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

    // Validate quantities
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

      toast.success(`تم التحويل بنجاح - رقم: ${result.transferNumber}`);

      // Reset form
      setSelectedItems([]);
      setSelectedWarehouse("");
      setNotes("");
      setIsConfirmModalOpen(false);

      // Refresh inventory
      const inventoryItems = await inventoryService.getInventory({
        warehouseId: fromWarehouseId,
      });
      setProducts(inventoryItems);
    } catch (error) {
      console.error("Error creating transfer:", error);
      // APIClient throws APIError with message and data properties
      const errorMessage =
        error.message || error.data?.message || "حدث خطأ أثناء التحويل";
      toast.error(errorMessage);
    }
  };

  // Calculations
  const totalItems = selectedItems.length;
  const totalQuantity = selectedItems.reduce(
    (sum, item) => sum + (item.transferQty || 0),
    0
  );

  return (
    <div
      className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-6rem)] overflow-y-auto lg:overflow-hidden bg-background-light dark:bg-background-dark text-sm"
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
                <span className="text-gray-600 dark:text-gray-400">
                  من المخزن:
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-100">
                  {allWarehouses.find(w => w.id === parseInt(fromWarehouseId))?.name || "..."}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  إلى المخزن:
                </span>
                <span className="font-bold text-primary">
                  {
                    allWarehouses.find((w) => w.id === parseInt(selectedWarehouse))
                      ?.name
                  }
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-primary/20">
                <span className="text-gray-600 dark:text-gray-400">
                  عدد الأصناف:
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-100">
                  {totalItems}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  إجمالي الكميات:
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-100">
                  {totalQuantity}
                </span>
              </div>
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

      {/* Product Selection Area (Center/Left) - Order 2 on Mobile, Order 1 on Desktop */}
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
            <span className="font-bold text-lg text-primary dark:text-primary-dark">
              تحويل مخزني
            </span>
          </div>
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
          {/* Categories */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                const container = document.getElementById("categories-slider");
                container.scrollBy({ left: 200, behavior: "smooth" });
              }}
              className="flex-shrink-0 bg-white dark:bg-zinc-800 rounded-lg p-2 shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all border border-gray-200 dark:border-zinc-700">
              <span className="material-symbols-outlined text-primary text-xl">
                chevron_right
              </span>
            </button>

            <div
              id="categories-slider"
              className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg shadow-sm cursor-pointer text-sm font-bold transition-all duration-200 ${activeCategory === cat.id
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
              <span className="material-symbols-outlined text-primary text-xl">
                chevron_left
              </span>
            </button>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleAddItem(product)}
                className="bg-card-light dark:bg-card-dark rounded shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col h-28 group relative active:scale-95 transition-transform">
                <span className="absolute top-1 left-1 text-gray-300 hover:text-gray-500 dark:text-gray-500 cursor-help">
                  <span className="material-symbols-outlined text-sm">
                    info
                  </span>
                </span>
                <div className="p-3 flex flex-col flex-1 justify-between h-full">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1 leading-tight line-clamp-2">
                    {product.name}
                  </h3>
                  <div className="mt-auto border-t border-gray-100 dark:border-zinc-700 pt-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">متاح</span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${product.quantity <= product.reorderPoint
                            ? "text-red-600 bg-red-50 dark:bg-red-900/20"
                            : product.quantity < 50
                              ? "text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                              : "text-green-600 bg-green-50 dark:bg-green-900/20"
                            }`}>
                          {product.quantity} {product.unit}
                        </span>
                      </div>

                      {/* Show available branches if no source warehouse selected */}
                      {!fromWarehouseId && product.warehouses && product.warehouses.length > 0 && (
                        <div className="text-[10px] text-gray-400 mt-1 truncate" title={product.warehouses.join(", ")}>
                          في: {product.warehouses.join("، ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transfer Details Sidebar (Right Side) - Wrapper behaves as contents on mobile to split children */}
      <div className="contents lg:flex lg:flex-col lg:w-[450px] xl:w-[600px] lg:h-full lg:bg-card-light lg:dark:bg-card-dark lg:shadow-xl lg:z-20 lg:shrink-0 lg:border-r lg:border-gray-200 lg:dark:border-zinc-700 order-1 lg:order-2">
        {/* Header Form - Order 1 on Mobile */}
        <div className="order-1 lg:order-none p-4 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-bold text-primary dark:text-primary mb-3 flex items-center">
            <span className="material-symbols-outlined ml-2">
              local_shipping
            </span>
            بيانات التحويل
          </h2>
          <div className="flex gap-4 mb-3">
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                من المخزن
              </label>
              <select
                className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-primary focus:ring-primary focus:border-primary text-sm font-bold shadow-sm"
                value={fromWarehouseId}
                onChange={(e) => handleFromWarehouseChange(e.target.value)}>
                <option value="">-- اختر المخزن --</option>
                {allWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-primary mb-1">
                إلى المخزن *
              </label>
              <select
                className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-primary focus:ring-primary focus:border-primary text-sm font-bold shadow-sm"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}>
                <option value="">-- اختر المخزن --</option>
                {allWarehouses
                  .filter(wh => wh.id.toString() !== fromWarehouseId.toString())
                  .map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              ملاحظات
            </label>
            <textarea
              className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 focus:ring-primary focus:border-primary text-sm shadow-sm resize-none"
              rows="2"
              placeholder="ملاحظات إضافية (اختياري)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Details Wrapper - Order 3 on Mobile */}
        <div className="order-3 lg:order-none flex flex-col lg:flex lg:flex-col lg:flex-1 lg:overflow-hidden bg-card-light dark:bg-card-dark">
          {/* List Header */}
          <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-500 dark:text-gray-400 grid grid-cols-12 gap-2">
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
                  <span className="material-symbols-outlined text-6xl mb-2">
                    inventory_2
                  </span>
                  <p>لم يتم اختيار أي أصناف بعد</p>
                </div>
              </div>
            ) : (
              selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 group grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-gray-400">#{item.code}</div>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleQtyChange(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 rounded text-gray-600 dark:text-gray-200 font-bold">
                      -
                    </button>
                    <input
                      className="w-14 text-center border border-gray-300 dark:border-zinc-600 rounded py-1 px-1 text-sm font-bold bg-white dark:bg-zinc-800 focus:border-primary focus:ring-0"
                      type="number"
                      value={item.transferQty}
                      onChange={(e) =>
                        handleManualQtyChange(item.id, e.target.value)
                      }
                    />
                    <button
                      onClick={() => handleQtyChange(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 rounded text-gray-600 dark:text-gray-200 font-bold">
                      +
                    </button>
                  </div>
                  <div className="col-span-2 flex items-center justify-between pl-2">
                    <span className="text-xs font-medium text-gray-500">
                      {item.unit}
                    </span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-400 hover:text-red-600 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-lg">
                        delete
                      </span>
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
                <span className="text-gray-900 dark:text-white text-lg mr-1">
                  {totalItems}
                </span>
              </span>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                إجمالي الكميات:
                <span className="text-gray-900 dark:text-white text-lg mr-1">
                  {totalQuantity}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setSelectedItems([]);
                  setSelectedWarehouse("");
                  setNotes("");
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
  );
};

export default StockTransferPage;
