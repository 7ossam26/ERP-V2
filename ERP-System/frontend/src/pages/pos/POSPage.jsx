import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import POSReportModal from "./POSReportModal";

const POSPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartItems, setCartItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const categories = [
    { id: "All", name: "كل المنتجات" },
    { id: "HotDrinks", name: "مشروبات ساخنة" },
    { id: "ColdDrinks", name: "مشروبات باردة" },
    { id: "Pastries", name: "معجنات" },
    { id: "CoffeeBeans", name: "حبوب بن" },
    { id: "Accessories", name: "اكسسوارات" },
  ];

  const products = [
    { id: 1, name: "كابتشينو (وسط)", price: 65.0, category: "HotDrinks" },
    { id: 2, name: "لاتيه", price: 70.0, category: "HotDrinks" },
    {
      id: 3,
      name: "اسبريسو سنجل",
      price: 40.0,
      unit: "فنجان",
      category: "HotDrinks",
    },
    { id: 4, name: "قهوة تركي", price: 35.0, category: "HotDrinks" },
    {
      id: 5,
      name: "ماكينة قهوة منزلية",
      price: 2240.0,
      category: "Accessories",
    },
    {
      id: 6,
      name: "مياه معدنية صغيرة",
      price: 10.0,
      unit: "زجاجة",
      category: "ColdDrinks",
    },
    {
      id: 7,
      name: "كرواسون سادة",
      price: 35.0,
      unit: "قطعة",
      category: "Pastries",
    },
    {
      id: 8,
      name: "بار شوكولاتة داكنة",
      price: 25.0,
      unit: "قطعة",
      category: "Pastries",
    },
    {
      id: 9,
      name: "قهوة أمريكي",
      price: 50.0,
      unit: "كوب",
      category: "HotDrinks",
    },
    { id: 10, name: "حامل مجلات خشبي", price: 120.0, category: "Accessories" },
    { id: 11, name: "موكا مثلج", price: 85.0, category: "ColdDrinks" },
    {
      id: 12,
      name: "بن برازيلي (250 جرام)",
      price: 110.0,
      category: "CoffeeBeans",
    },
    {
      id: 13,
      name: "شاي إيرل جراي",
      price: 30.0,
      unit: "كوب",
      category: "HotDrinks",
    },
    { id: 14, name: "علبة حفظ بن", price: 150.0, category: "Accessories" },
  ];

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === "All" || product.category === activeCategory;
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.price,
              }
            : item
        );
      } else {
        return [
          ...prevItems,
          {
            ...product,
            quantity: 1,
            total: product.price,
          },
        ];
      }
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedItemId(null);
  };

  const handleItemClick = (id) => {
    setSelectedItemId(id === selectedItemId ? null : id);
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = 0.14;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const [isReportOpen, setIsReportOpen] = useState(false);

  const handleEndShift = () => {
    setIsReportOpen(true);
  };

  const handleConfirmShift = () => {
    setIsReportOpen(false);
    navigate("/dashboard");
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark overflow-hidden h-screen flex flex-col text-sm font-sans"
      dir="rtl">
      <POSReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onConfirm={handleConfirmShift}
        totalSales={total.toFixed(2)}
      />

      {/* Header */}
      <div className="bg-primary dark:bg-primary text-white px-4 py-2 flex items-center justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">person</span>
            <span className="font-bold">اسم الموظف:</span>
            <span>أحمد محمد</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">store</span>
            <span className="font-bold">اسم الفرع:</span>
            <span>الفرع الرئيسي</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">schedule</span>
            <span className="font-bold">الوردية:</span>
            <span>صباحية</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              calendar_today
            </span>
            <span className="font-bold">التاريخ:</span>
            <span>2024-05-20</span>
          </div>
        </div>
        <button
          onClick={handleEndShift}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm">
          <span className="material-symbols-outlined text-sm">logout</span>
          <span>إنهاء الوردية</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Product Grid Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-zinc-900 relative border-l border-gray-200 dark:border-zinc-700">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 bg-card-light dark:bg-card-dark shadow-sm z-10 shrink-0">
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <button
                onClick={() => navigate("/dashboard")}
                className="hover:text-primary transition-colors flex items-center">
                <span className="material-symbols-outlined">home</span>
              </button>
              <span className="mx-2 text-gray-300">/</span>
              <a
                className="flex items-center hover:text-primary transition-colors"
                href="#">
                <span className="material-symbols-outlined ml-1">apps</span>
                <span className="font-medium">كل المنتجات</span>
              </a>
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <span className="material-symbols-outlined text-lg">
                  search
                </span>
              </span>
              <input
                className="pr-10 pl-4 py-2 w-64 md:w-80 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-400 text-sm shadow-sm transition-all font-sans"
                placeholder="بحث عن منتج..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Products Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Categories */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg shadow-sm cursor-pointer text-sm font-bold transition-colors ${
                    activeCategory === cat.id
                      ? "bg-primary text-white shadow"
                      : "bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                  }`}>
                  {cat.name}
                </div>
              ))}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-card-light dark:bg-card-dark rounded shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col h-24 group relative active:scale-95 transition-transform"
                  onClick={() => addToCart(product)}>
                  <span className="absolute top-1 left-1 text-gray-300 hover:text-gray-500 dark:text-gray-500 cursor-help">
                    <span className="material-symbols-outlined text-sm">
                      info
                    </span>
                  </span>
                  <div className="p-3 flex flex-col flex-1 justify-between h-full">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1 line-clamp-2 leading-tight">
                      {product.name}
                    </h3>
                    <div className="mt-auto">
                      <span className="block text-primary dark:text-primary/90 font-bold text-base">
                        {product.price.toFixed(2)} ج.م
                        {product.unit && (
                          <span className="text-[10px] text-gray-500 font-normal">
                            /{product.unit}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart/Sidebar Area */}
        <div className="w-[600px] flex flex-col h-full bg-card-light dark:bg-card-dark shadow-xl z-20 shrink-0">
          <div className="flex-1 overflow-y-auto p-0 flex flex-col">
            <div className="flex flex-col flex-shrink min-h-0 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400 h-64">
                  <span className="material-symbols-outlined text-6xl mb-2">
                    shopping_cart
                  </span>
                  <span>السلة فارغة</span>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`p-3 border-b border-gray-100 dark:border-zinc-700 cursor-pointer transition-colors ${
                      selectedItemId === item.id
                        ? "bg-primary/10 border-r-4 border-r-primary dark:border-r-primary"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                    }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {item.name}
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {item.total.toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.quantity.toFixed(2)} وحدة x {item.price.toFixed(2)}{" "}
                      ج.م / وحدة
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-auto">
              <div className="bg-card-light dark:bg-card-dark border-t border-gray-200 dark:border-zinc-700">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-2xl font-bold text-gray-800 dark:text-white">
                      الإجمالي:
                    </span>
                    <span className="text-2xl font-bold text-gray-800 dark:text-white">
                      {total.toFixed(2)} ج.م
                    </span>
                  </div>
                  <div className="flex justify-end text-xs text-gray-500 dark:text-gray-400">
                    الضريبة ({(taxRate * 100).toFixed(0)}%): {tax.toFixed(2)}{" "}
                    ج.م
                  </div>
                  <div className="flex justify-end text-xs text-gray-500 dark:text-gray-400 mt-1">
                    المجموع الفرعي: {subtotal.toFixed(2)} ج.م
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-0 border-b border-gray-200 dark:border-zinc-700 text-sm">
                  <button
                    onClick={clearCart}
                    className="flex flex-col items-center justify-center p-2 text-primary dark:text-primary-dark hover:bg-gray-100 dark:hover:bg-zinc-700 border-l border-gray-200 dark:border-zinc-700">
                    <span className="material-symbols-outlined mb-1">
                      person_add
                    </span>
                    <span>تكويد عميل جديد</span>
                  </button>
                  <button
                    onClick={clearCart}
                    className="flex flex-col items-center justify-center p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-l border-gray-200 dark:border-zinc-700">
                    <span className="material-symbols-outlined mb-1">
                      cancel
                    </span>
                    <span>إلغاء</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">
                    <span className="material-symbols-outlined mb-1">
                      assignment_return
                    </span>
                    <span>استرجاع</span>
                  </button>
                </div>

                {/* Keypad */}
                <div
                  className="grid grid-cols-5 h-[350px] bg-white dark:bg-zinc-800"
                  dir="ltr">
                  <button className="col-span-1 border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-700/50 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 flex flex-col items-center justify-center p-1 transition-colors">
                    <span className="material-symbols-outlined text-3xl mb-1">
                      print
                    </span>
                    <span className="font-bold text-sm">طباعة</span>
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    1
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    2
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    3
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-700/50 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-600">
                    الكمية
                  </button>

                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col items-center justify-center p-1 border border-emerald-700 dark:border-zinc-900 shadow-inner transition-colors">
                    <span className="material-symbols-outlined text-3xl mb-1">
                      payments
                    </span>
                    <span className="font-bold text-sm">نقد</span>
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    4
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    5
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    6
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-700/50 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-600">
                    خصم
                  </button>

                  <button className="bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center p-1 border border-blue-700 dark:border-zinc-900 shadow-inner transition-colors">
                    <span className="material-symbols-outlined text-3xl mb-1">
                      credit_card
                    </span>
                    <span className="font-bold text-sm">فيزا</span>
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    7
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    8
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    9
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-700/50 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-600">
                    سعر
                  </button>

                  <button className="bg-amber-500 hover:bg-amber-600 text-white flex flex-col items-center justify-center p-1 border border-amber-600 dark:border-zinc-900 shadow-inner transition-colors">
                    <span className="material-symbols-outlined text-3xl mb-1">
                      edit
                    </span>
                    <span className="font-bold text-sm">تعديل</span>
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    +/-
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    0
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    .
                  </button>
                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100">
                    <span className="material-symbols-outlined text-xl">
                      backspace
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
