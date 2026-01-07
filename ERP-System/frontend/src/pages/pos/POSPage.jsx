import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import POSReportModal from "./POSReportModal";
import Modal from "../../components/ui/Modal";
import { ClientForm } from "../clients/ClientManager";
import {
  clientService,
  itemService,
  categoryService,
} from "../../services/domainServices";

const POSPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartItems, setCartItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Hold Cart State
  const [heldCarts, setHeldCarts] = useState([]);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const fetchedClients = await clientService.getAll();
        setClients(fetchedClients);
      } catch (error) {
        console.error("Failed to fetch clients", error);
      }
    };
    fetchClients();
  }, [isClientModalOpen]);

  const filteredClients = clients.filter((client) => {
    const search = clientSearchTerm.toLowerCase();
    const name = client.name ? client.name.toLowerCase() : "";
    const phone = client.phone ? client.phone : "";
    const id = client.id ? client.id.toString() : "";

    return (
      name.includes(search) || phone.includes(search) || id.includes(search)
    );
  });

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearchTerm(client ? client.name : "");
    setIsClientDropdownOpen(false);
  };

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [items, dbCategories] = await Promise.all([
          itemService.getAll(),
          categoryService.getAll(),
        ]);

        setProducts(items);

        // Build categories from database with "All" option
        const allCategories = [
          { id: "All", name: "كل المنتجات" },
          ...dbCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
          })),
        ];
        setCategories(allCategories);
      } catch (error) {
        console.error("Failed to fetch products and categories", error);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = products.filter((product) => {
    // Check if product belongs to selected category (many-to-many)
    const matchesCategory =
      activeCategory === "All" ||
      (product.categories && product.categories.includes(activeCategory));

    const productName = product.name ? product.name.toLowerCase() : "";
    const matchesSearch = productName.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product) => {
    const rawPrice = product.sellPrice || product.price || 0;
    const price = Number(rawPrice);
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * price,
              }
            : item
        );
      } else {
        return [
          ...prevItems,
          {
            ...product,
            quantity: 1,
            total: price,
            price: price, // Ensure price is set
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

  const handleSaveClient = async (formData) => {
    try {
      await clientService.create(formData);
      setIsClientModalOpen(false);
      toast.success("تم إضافة العميل بنجاح");
    } catch (error) {
      console.error("Failed to save client", error);
      toast.error("حدث خطأ أثناء حفظ العميل");
    }
  };

  const handleHoldCart = () => {
    if (cartItems.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    const newHeldCart = {
      id: Date.now(),
      items: cartItems,
      customerName: selectedClient ? selectedClient.name : "عميل نقدي",
      timestamp: new Date().toLocaleTimeString("ar-EG"),
      total: total.toFixed(2),
      itemsCount: cartItems.reduce((acc, item) => acc + item.quantity, 0),
    };
    setHeldCarts((prev) => [newHeldCart, ...prev]);
    setCartItems([]);
    setSelectedClient(null);
    toast.success("تم تعليق الفاتورة بنجاح");
  };

  const handleRetrieveCart = (cartId) => {
    const cartToRetrieve = heldCarts.find((c) => c.id === cartId);
    if (!cartToRetrieve) return;

    if (cartItems.length > 0) {
      if (
        !window.confirm(
          "يوجد أصناف في السلة الحالية. هل تريد استبدالها بالفاتورة المعلقة؟"
        )
      ) {
        return;
      }
    }

    setCartItems(cartToRetrieve.items);
    setHeldCarts((prev) => prev.filter((c) => c.id !== cartId));
    setIsHeldCartsModalOpen(false);
    toast.success("تم استرجاع الفاتورة");
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

      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="تكويد عميل جديد">
        <ClientForm
          data={clients}
          onClose={() => setIsClientModalOpen(false)}
          onSave={handleSaveClient}
        />
      </Modal>

      <Modal
        isOpen={isHeldCartsModalOpen}
        onClose={() => setIsHeldCartsModalOpen(false)}
        title="الفواتير المعلقة">
        <div className="space-y-4">
          {heldCarts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              لا توجد فواتير معلقة
            </p>
          ) : (
            heldCarts.map((cart) => (
              <div
                key={cart.id}
                className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 flex justify-between items-center group hover:border-primary/50 transition-colors">
                <div>
                  <div className="font-bold text-gray-800 dark:text-gray-200 mb-1">
                    {cart.customerName || "عميل نقدي"}
                  </div>
                  <div className="text-xs text-gray-500 flex gap-3">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        schedule
                      </span>
                      {cart.timestamp}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        shopping_cart
                      </span>
                      {cart.itemsCount} أصناف
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg text-primary">
                    {cart.total} ج.م
                  </span>
                  <button
                    onClick={() => handleRetrieveCart(cart.id)}
                    className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">
                    استرجاع
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

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
            <div className="flex items-center text-gray-500 dark:text-gray-400 gap-2">
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
                        {Number(
                          product.sellPrice || product.price || 0
                        ).toFixed(2)}{" "}
                        ج.م
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
          {/* Client Selection */}
          <div className="p-4 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-card-dark shrink-0 z-20 relative">
            <div className="relative">
              <div
                className="relative"
                onClick={() =>
                  !isClientDropdownOpen && setIsClientDropdownOpen(true)
                }>
                <input
                  type="text"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg py-2.5 pr-10 pl-10 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-sm font-bold placeholder-gray-400"
                  placeholder="بحث عن عميل (الاسم أو الرقم)..."
                  value={
                    isClientDropdownOpen
                      ? clientSearchTerm
                      : selectedClient
                      ? selectedClient.name
                      : ""
                  }
                  onChange={(e) => {
                    setClientSearchTerm(e.target.value);
                    setIsClientDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setIsClientDropdownOpen(true);
                    setClientSearchTerm(""); // Clear on focus to search
                  }}
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                  {isClientDropdownOpen ? "search" : "expand_more"}
                </span>
                <span className="material-symbols-outlined absolute right-3 top-1/2 transform -translate-y-1/2 text-primary pointer-events-none">
                  person
                </span>
              </div>

              {isClientDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsClientDropdownOpen(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-20">
                    <div
                      className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-700/50 font-bold"
                      onClick={() => handleSelectClient(null)}>
                      عميل نقدي (Walk-in)
                    </div>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer border-b border-gray-100 dark:border-zinc-700/50 last:border-0"
                          onClick={() => handleSelectClient(client)}>
                          <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                            {client.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                            <span>{client.phone || "لا يوجد رقم"}</span>
                            <span>#{client.id}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                        لا توجد نتائج
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

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
                    onClick={() => setIsClientModalOpen(true)}
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
                  <button
                    onClick={() => {
                      if (cartItems.length > 0) {
                        handleHoldCart();
                      } else {
                        setIsHeldCartsModalOpen(true);
                      }
                    }}
                    className="flex flex-col items-center justify-center p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 relative">
                    <span className="material-symbols-outlined mb-1">
                      {cartItems.length > 0 ? "pause_circle" : "history"}
                    </span>
                    <span>{cartItems.length > 0 ? "تعليق" : "استرجاع"}</span>
                    {heldCarts.length > 0 && cartItems.length > 0 && (
                      <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    )}
                  </button>
                </div>

                {/* Keypad */}
                <div
                  className="grid grid-cols-5 h-[350px] bg-white dark:bg-zinc-800"
                  dir="ltr">
                  <button
                    onClick={() => window.print()}
                    className="col-span-1 border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-700/50 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 flex flex-col items-center justify-center p-1 transition-colors">
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

                  <button className="border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
                    +/-
                  </button>
                  <button className="col-span-2 border border-gray-200 dark:border-zinc-700 text-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-gray-100 font-sans">
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
