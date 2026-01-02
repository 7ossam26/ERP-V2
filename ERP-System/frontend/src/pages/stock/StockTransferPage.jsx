import React, { useState } from "react";

const StockTransferPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [destBranch, setDestBranch] = useState("");

  // Mock data for available products
  const products = [
    {
      id: 1022,
      name: "بن برازيلي (شوال)",
      code: "CODE-1022",
      stock: 1200,
      unit: "كجم",
      category: "بن خام",
    },
    {
      id: 1023,
      name: "بن كولومبي وسط",
      code: "CODE-1023",
      stock: 850,
      unit: "كجم",
      category: "بن خام",
    },
    {
      id: 5001,
      name: "اكواب ورقية (وسط)",
      code: "CODE-5001",
      stock: 5000,
      unit: "قطعة",
      category: "معدات",
    },
    {
      id: 5002,
      name: "مناديل مطبوعة",
      code: "CODE-5002",
      stock: 200,
      unit: "كرتونة",
      category: "معدات",
    },
    {
      id: 1024,
      name: "بن حبش فاتح",
      code: "CODE-1024",
      stock: 400,
      unit: "كجم",
      category: "بن خام",
    },
    {
      id: 2001,
      name: "كرواسون مجمد (كرتونة)",
      code: "CODE-2001",
      stock: 15,
      unit: "كرتونة",
      category: "مخبوزات",
    },
    {
      id: 5003,
      name: "أكياس تعبئة 250جم",
      code: "CODE-5003",
      stock: 10000,
      unit: "قطعة",
      category: "معدات",
    },
    {
      id: 3001,
      name: "سكر أبيض (بالتة)",
      code: "CODE-3001",
      stock: 50,
      unit: "بالتة",
      category: "خامات",
    },
    {
      id: 2040,
      name: "هيل حب (درجة أولى)",
      code: "CODE-2040",
      stock: 60,
      unit: "كجم",
      category: "خامات",
    },
    {
      id: 5004,
      name: "علبة حفظ بن معدنية",
      code: "CODE-5004",
      stock: 35,
      unit: "قطعة",
      category: "معدات",
    },
  ];

  // Initial Selected Items (Mocking the HTML state)
  const [selectedItems, setSelectedItems] = useState([
    {
      id: 1022,
      name: "بن برازيلي (شوال)",
      code: "CODE-1022",
      stock: 1200,
      unit: "كجم",
      transferQty: 50,
    },
    {
      id: 5001,
      name: "أكواب ورقية (وسط)",
      code: "CODE-5001",
      stock: 5000,
      unit: "قطعة",
      transferQty: 500,
    },
    {
      id: 2040,
      name: "هيل حب (درجة أولى)",
      code: "CODE-2040",
      stock: 60,
      unit: "كجم",
      transferQty: 5,
    },
  ]);

  // Handlers
  const handleAddItem = (product) => {
    // Check if already selected
    if (selectedItems.find((item) => item.id === product.id)) return;

    setSelectedItems([...selectedItems, { ...product, transferQty: 1 }]);
  };

  const handleRemoveItem = (id) => {
    setSelectedItems(selectedItems.filter((item) => item.id !== id));
  };

  const handleQtyChange = (id, change) => {
    setSelectedItems(
      selectedItems.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, (item.transferQty || 0) + change);
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
          return { ...item, transferQty: Math.max(0, qty) };
        }
        return item;
      })
    );
  };

  // Calculations
  const totalItems = selectedItems.length;
  const totalQuantity = selectedItems.reduce(
    (sum, item) => sum + (item.transferQty || 0),
    0
  );

  return (
    <div
      className="flex h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-sm"
      dir="rtl">
      {/* Product Selection Area (Left Side) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-zinc-900 relative border-l border-gray-200 dark:border-zinc-700">
        {/* Search Bar */}
        <div className="flex items-center justify-between p-4 bg-card-light dark:bg-card-dark shadow-sm z-10 shrink-0">
          <div className="flex items-center text-gray-500 dark:text-gray-400">
            <span className="font-bold text-lg text-primary dark:text-primary-dark ml-2">
              اختيار المنتجات
            </span>
            <span className="mx-2 text-gray-300">|</span>
            <button className="flex items-center hover:text-primary transition-colors">
              <span className="material-symbols-outlined ml-1">apps</span>
              <span className="font-medium">الكل</span>
            </button>
          </div>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input
              className="pr-10 pl-4 py-2 w-64 md:w-80 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-400 text-sm shadow-sm transition-all font-sans"
              placeholder="بحث عن صنف..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories (Horizontal Scroll) */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
            {[
              "كل الأصناف",
              "بن خام",
              "بن محوج",
              "مشروبات جاهزة",
              "مخبوزات",
              "معدات واكسسوارات",
            ].map((cat, idx) => (
              <div
                key={idx}
                className={`flex-shrink-0 px-4 py-2 rounded-lg shadow-sm cursor-pointer text-sm font-bold transition-colors ${
                  idx === 0
                    ? "bg-primary text-white shadow"
                    : "bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                }`}>
                {cat}
              </div>
            ))}
          </div>

          {/* Grid of Products */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products
              .filter((p) => p.name.includes(searchQuery))
              .map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleAddItem(product)}
                  className="bg-card-light dark:bg-card-dark rounded shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col h-28 group relative">
                  <span className="absolute top-1 left-1 text-gray-300 hover:text-gray-500 dark:text-gray-500 cursor-help">
                    <span className="material-symbols-outlined text-sm">
                      info
                    </span>
                  </span>
                  <div className="p-3 flex flex-col flex-1 justify-between h-full">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1 leading-tight">
                      {product.name}
                    </h3>
                    <div className="mt-auto border-t border-gray-100 dark:border-zinc-700 pt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">مخزن رئيسي</span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${
                            product.stock < 50
                              ? "text-red-600 bg-red-50"
                              : product.stock < 200
                              ? "text-orange-600 bg-orange-50"
                              : "text-green-600 bg-green-50"
                          }`}>
                          {product.stock} {product.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Transfer Details Sidebar (Right Side) */}
      <div className="w-[450px] lg:w-[600px] flex flex-col h-full bg-card-light dark:bg-card-dark shadow-xl z-20 shrink-0 border-r border-gray-200 dark:border-zinc-700">
        {/* Header Form */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-bold text-primary dark:text-primary mb-3 flex items-center">
            <span className="material-symbols-outlined ml-2">
              local_shipping
            </span>
            بيانات التحويل
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                رقم مرجع التحويل
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                  <span className="material-symbols-outlined text-sm">tag</span>
                </span>
                <input
                  className="w-full rounded p-2 pr-9 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 focus:ring-primary focus:border-primary text-sm font-semibold shadow-sm placeholder-gray-400"
                  placeholder="ID Auto"
                  type="text"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                من الفرع
              </label>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded p-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-zinc-600 cursor-not-allowed text-sm font-medium">
                المخزن الرئيسي (Main Warehouse)
              </div>
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-primary mb-1">
                إلى الفرع (الفرع المستلم)
              </label>
              <select
                className="w-full rounded p-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-primary focus:ring-primary focus:border-primary text-sm font-bold shadow-sm"
                value={destBranch}
                onChange={(e) => setDestBranch(e.target.value)}>
                <option value="">-- اختر الفرع --</option>
                <option value="br1">فرع المهندسين</option>
                <option value="br2">فرع مدينة نصر</option>
                <option value="br3">فرع التجمع الخامس</option>
                <option value="br4">فرع وسط البلد</option>
              </select>
            </div>
          </div>
        </div>

        {/* List Header */}
        <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-500 dark:text-gray-400 grid grid-cols-12 gap-2">
          <div className="col-span-5">الصنف</div>
          <div className="col-span-2 text-center">رصيد المصدر</div>
          <div className="col-span-3 text-center">كمية التحويل</div>
          <div className="col-span-2 text-center">الوحدة</div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-0 flex flex-col">
          {selectedItems.map((item) => (
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
                  {item.stock}
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
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-lg">
                    delete
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Summary & Actions */}
        <div className="mt-auto bg-card-light dark:bg-card-dark border-t border-gray-200 dark:border-zinc-700 p-4 shadow-lg z-30">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button className="flex items-center justify-center gap-2 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-600 py-3 rounded-lg font-bold shadow-sm transition-colors">
              <span className="material-symbols-outlined">add_circle</span>
              إضافة صنف
            </button>
            <button className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 py-3 rounded-lg font-bold shadow-sm transition-colors">
              <span className="material-symbols-outlined">cancel</span>
              إلغاء
            </button>
            <button className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold shadow-md transition-colors transform active:scale-95">
              <span className="material-symbols-outlined">check_circle</span>
              تأكيد التحويل
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockTransferPage;
