import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import POSReportModal from "./POSReportModal";
import StartShiftModal from "./StartShiftModal";
import ShiftBlockedModal from "./ShiftBlockedModal";
import EndShiftModal from "../../components/pos/EndShiftModal";
import ShiftVerificationModal from "../../components/pos/ShiftVerificationModal";
import DeliveryModal from "../../components/pos/DeliveryModal";
import DeliveryDebtsModal from "../../components/pos/DeliveryDebtsModal";
import Modal from "../../components/ui/Modal";
import RefundModal from "./RefundModal";
import OrdersHistoryModal from "./OrdersHistoryModal";
import { FaHistory, FaRedo } from "react-icons/fa";
import { ClientForm } from "../clients/ClientManager";
import {
  clientService,
  itemService,
  categoryService,
  salesService,
  inventoryService,
  settingsService,
  shiftService,
  deliveryService,
} from "../../services/domainServices";
import AuthService from "../../services/authService";
import PendingDeliveriesModal from "./components/PendingDeliveriesModal";

const POSPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartItems, setCartItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const clientInputRef = useRef(null);

  // User & Shift State
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [currentShiftId, setCurrentShiftId] = useState(null);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [isShiftBlocked, setIsShiftBlocked] = useState(false); // Added state
  const [blockingShiftDetails, setBlockingShiftDetails] = useState(null); // Added state
  const [currentShift, setCurrentShift] = useState("صباحية");
  const [currentDate, setCurrentDate] = useState(
    new Date().toLocaleDateString("en-CA"),
  ); // YYYY-MM-DD
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString("en-US", { hour12: false }),
  );

  // Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState("products"); // 'products' or 'cart'

  // System Settings State
  const [taxRate, setTaxRate] = useState(0.14);

  useEffect(() => {
    if (currentUser) {
      checkActiveShift(currentUser);
    }

    //## Implementation Phase (10 Granular Phases)
    //- [/] **Phase 1**: Foundation - Global styles & utilities (2 files) 🟢
    //- [ ] **Phase 2**: Core Layout - Header & Navigation (2 files) 🟡

    // Initial calculation
    const calculateTimeData = () => {
      const now = new Date();
      const hour = now.getHours();

      // Shift Logic:
      // Morning: 06:00 - 14:00 (2 PM)
      // Evening: 14:00 - 22:00 (10 PM)
      // Night: 22:00 - 06:00
      let shift = "صباحية";
      if (hour >= 14 && hour < 22) shift = "مسائية";
      if (hour >= 22 || hour < 6) shift = "ليلية";

      setCurrentShift(shift);
      setCurrentDate(now.toLocaleDateString("en-CA"));
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };

    calculateTimeData();

    // Update time every second
    const interval = setInterval(calculateTimeData, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkActiveShift = async (user) => {
    try {
      console.log("🔍 Checking active shift for user:", user.id);

      // 1. Check for active shift specifically for THIS user
      const activeShift = await shiftService.checkActive(user.id);
      console.log("🔍 Active Shift Result:", activeShift);

      if (activeShift) {
        console.log("✅ Found active shift:", activeShift);
        setCurrentShiftId(activeShift.id);
        setCurrentShift(activeShift.type === "MORNING" ? "صباحية" : "مسائية");

        // Notify user about their own existing shift
        toast.success(
          `يوجد وردية مفتوحة بالفعل\n\n` +
            `👤 بدأها: ${user.name}\n` +
            `💰 رصيد البداية: ${activeShift.startCash || 0} ج.م`,
          {
            duration: 5000,
            icon: "ℹ️",
            position: "top-center",
            id: "active-shift-notification",
          },
        );
      } else {
        // 2. User has no active shift. Check if the BRANCH is blocked by someone else.
        console.log("ℹ️ No active shift for user. Checking branch status...");

        // We use the pending endpoint which now returns ANY blocking shift (Open or Pending)
        const blockingShift = await shiftService.getPending(user.branch.id);
        console.log("🔍 Branch Blocking Shift Result:", blockingShift);

        if (blockingShift) {
          console.log("⚠️ Found blocking shift:", blockingShift);

          const isPending = blockingShift.status === "PENDING_REVIEW";
          const isMyShift = blockingShift.userId === user.id;

          // STRICT BLOCKING:
          // 1. If OPEN shift by ANOTHER user -> BLOCK
          // 2. If PENDING shift by ANYONE (even me) -> BLOCK (waiting for approval)

          if ((blockingShift.status === "OPEN" && !isMyShift) || isPending) {
            console.log(
              `⛔ ACCESS DENIED: Branch occupied by ${isMyShift ? "MY pending" : "ANOTHER user's"} shift`,
            );
            setBlockingShiftDetails(blockingShift);
            setIsShiftBlocked(true);
            return;
          }
        } else {
          // 3. No active shift for user, and no blocking shift in branch -> Open Modal
          console.log(
            "✨ No active or pending shift. Opening StartShiftModal...",
          );

          toast(
            `مرحباً ${user.name} 👋\n` +
              `لا توجد وردية نشطة. يرجى بدء وردية جديدة.`,
            { duration: 4000, icon: "🆕", position: "top-center" },
          );

          setIsStartShiftModalOpen(true);
        }
      }
    } catch (error) {
      console.error("❌ Error checking shift:", error);
      toast.error("حدث خطأ في التحقق من الورديات");
    }
  };

  const handleStartShift = async (startCash) => {
    if (!currentUser || !currentUser.branch) {
      toast.error("خطأ: المستخدم غير مرتبط بفرع");
      return;
    }

    try {
      const newShift = await shiftService.start({
        userId: currentUser.id,
        branchId: currentUser.branch.id,
        startCash: startCash, // Can be undefined - backend will use rolling balance
      });
      console.log("Started new shift:", newShift);
      setCurrentShiftId(newShift.id);
      setCurrentShift(newShift.type === "MORNING" ? "صباحية" : "مسائية");
      setIsStartShiftModalOpen(false);
      toast.success(
        `تم بدء الوردية ${newShift.type === "MORNING" ? "الصباحية" : "المسائية"} بنجاح`,
      );
    } catch (error) {
      console.error("Error starting shift:", error);

      // Handle specific blocking error
      if (error.response?.data?.previousShiftStatus) {
        const message =
          error.response.data.message || "الوردية السابقة تحتاج موافقة المدير";
        toast.error(message);
        setIsStartShiftModalOpen(false);
      } else {
        toast.error(error.response?.data?.error || "فشل بدء الوردية");
      }
    }
  };

  const [isPendingDeliveriesModalOpen, setIsPendingDeliveriesModalOpen] =
    useState(false);
  const [pendingDeliveries, setPendingDeliveries] = useState(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Delivery Man State
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState(null);

  // Delivery Modal State
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryData, setDeliveryData] = useState(null); // {riderId, riderName, zoneId, zoneName, zoneFee, address}
  const [isDeliveryDebtsModalOpen, setIsDeliveryDebtsModalOpen] =
    useState(false);

  useEffect(() => {
    const fetchDeliveryMen = async () => {
      try {
        const params = {};
        if (currentUser?.branch?.id) {
          params.branchId = currentUser.branch.id;
        }
        const data = await deliveryService.getAll(params);
        setDeliveryMen(data || []);
      } catch (error) {
        console.error("Failed to fetch delivery men", error);
        setDeliveryMen([]);
      }
    };
    fetchDeliveryMen();
  }, []);

  // Hold Cart State
  const [heldCarts, setHeldCarts] = useState(() => {
    try {
      const saved = localStorage.getItem("heldCarts");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load held carts", e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("heldCarts", JSON.stringify(heldCarts));
  }, [heldCarts]);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null);
  const [cashPaidAmount, setCashPaidAmount] = useState(""); // For cash payment input

  // Quantity/Weight Selection State
  const [keypadMode, setKeypadMode] = useState("default"); // 'default', 'piece', 'weight', 'payment'
  const [selectedProductForQuantity, setSelectedProductForQuantity] =
    useState(null);

  // Custom input state
  const [customInputValue, setCustomInputValue] = useState("");

  // Print Modal State - NOT USED, keeping for now
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const fetchedClients = await clientService.getAll();
        setClients(fetchedClients);

        // Auto-select "عميل نقدي" if no client is selected
        if (!selectedClient) {
          const defaultClient = fetchedClients.find(
            (c) =>
              c.name.includes("عميل نقدي") ||
              c.name.toLowerCase().includes("walk-in"),
          );
          if (defaultClient) {
            setSelectedClient(defaultClient);
            // setClientSearchTerm(defaultClient.name); // Optional: if we want the input filled
          }
        }
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

    // Address Notification Logic - TOAST REMOVED in favor of UI display
    // if (client) {
    //   if (!client.address || client.address.trim() === "") {
    //     toast("لا يوجد عنوان مسجل لهذا العميل", { icon: "ℹ️" });
    //   }
    // }

    // On mobile, switch to cart to see client details if needed, or stay.
    // Usually selecting a client is part of cart operations.
  };

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const loadInventory = async () => {
    try {
      // Fetch Settings Global Config (Tax, etc.)
      let settings = null;
      try {
        settings = await settingsService.get();
        if (settings) {
          if (settings.taxRate !== undefined) {
            setTaxRate(Number(settings.taxRate) / 100);
            console.log("💰 Applied Tax Rate:", settings.taxRate + "%");
          }
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }

      // Fetch Settings to know which warehouse to check
      let warehouseId = null;

      // PRIORITIZE: User's assigned branch warehouse
      const user = AuthService.getCurrentUser();
      if (user && user.branch && user.branch.warehouseId) {
        warehouseId = user.branch.warehouseId;
        console.log(
          "🏭 Loading Inventory for Branch Warehouse ID:",
          warehouseId,
        );
      } else {
        // FALLBACK: System Main Warehouse
        if (settings && settings.mainWarehouseId) {
          warehouseId = settings.mainWarehouseId;
          console.log(
            "🏭 Loading Inventory for Main Warehouse ID (Settings):",
            warehouseId,
          );
        }
      }

      const [inventoryItems, dbCategories] = await Promise.all([
        inventoryService.getInventory({ warehouseId }),
        categoryService.getAll(),
      ]);

      setProducts(inventoryItems);

      // Build categories from database with "All" option
      const allCategories = [
        { id: "All", name: "كل المنتجات" },
        ...dbCategories
          .filter((cat) => cat.showInPos !== false)
          .map((cat) => ({
            id: cat.id,
            name: cat.name,
          })),
      ];
      setCategories(allCategories);
    } catch (error) {
      console.error("Failed to fetch products and categories", error);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredProducts = products.filter((product) => {
    // Check if product is allowed in POS
    if (product.showInPos === false) return false;

    // Check if product belongs to selected category (many-to-many)
    const matchesCategory =
      activeCategory === "All" ||
      (product.categories && product.categories.includes(activeCategory));

    const productName = product.name ? product.name.toLowerCase() : "";
    const matchesSearch = productName.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle product clicks - check unit type and show appropriate selector
  const handleProductClick = (product) => {
    // Check stock availability first
    if (!product.quantity || product.quantity <= 0) {
      toast.error(`الكمية غير متوفرة! المتاح: ${product.quantity || 0}`);
      return;
    }

    const unit = product.unit?.toLowerCase();

    setSelectedProductForQuantity(product);
    setCustomInputValue(""); // Clear custom input

    if (unit === "kg" || unit === "kilo" || unit === "kilogram") {
      // Show weight selector inline
      setKeypadMode("weight");
    } else {
      // Show piece quantity selector inline
      setKeypadMode("piece");
    }
    // Switch to cart tab on mobile to show keypad/cart
    if (window.innerWidth < 768) {
      setActiveMobileTab("cart");
    }
  };

  // Handle custom input submission
  const handleCustomInputSubmit = () => {
    const value = parseFloat(customInputValue);
    if (isNaN(value) || value <= 0) {
      toast.error("الرجاء إدخال قيمة صحيحة");
      return;
    }

    if (keypadMode === "piece") {
      handleQuantitySelected(value);
    } else if (keypadMode === "weight") {
      handleWeightSelected(value);
    }
    setCustomInputValue("");
  };

  // Add product to cart with specified quantity
  const addToCartWithQuantity = (product, quantity) => {
    const rawPrice =
      product.sellPrice || product.purchasePrice || product.price || 0; // inventory.js returns purchasePrice currently, need to ensure sellPrice available or fallback
    // Note: inventory.js returns purchasePrice. Frontend might need sellPrice.
    // Ideally inventory API should return sellPrice.
    // Fallback: Use purchasePrice if sellPrice is missing/placeholder for now to avoid nan.

    // Validate Stock
    const currentStock = product.quantity || 0;
    const existingItem = cartItems.find((item) => item.id === product.id);
    const existingQty = existingItem ? existingItem.quantity : 0;
    const totalRequested = existingQty + quantity;

    // Skip stock check for BOM items (auto-manufactured)
    if (!product.hasBom && totalRequested > currentStock) {
      toast.error(`الكمية غير متوفرة! المتاح: ${currentStock}`);
      return false; // Return failure
    }

    // Warning for Reorder Point
    const reorderPoint = product.reorderPoint || 0;
    const remainingAfterSale = currentStock - totalRequested;

    if (!product.hasBom && remainingAfterSale <= reorderPoint) {
      toast(`تحذير: المخزون سيصبح منخفض (${remainingAfterSale})`, {
        icon: "⚠️",
      });
    }

    const price = Number(rawPrice);

    setCartItems((prevItems) => {
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: (item.quantity + quantity) * price,
              }
            : item,
        );
      } else {
        return [
          ...prevItems,
          {
            ...product, // product from inventory has updated fields
            price: price, // Ensure price is set
            quantity: quantity,
            total: price * quantity,
          },
        ];
      }
    });

    return true; // Return success
  };

  // Legacy function kept for compatibility - defaults to quantity 1
  const addToCart = (product) => {
    addToCartWithQuantity(product, 1);
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedItemId(null);
  };

  const handleItemClick = (id) => {
    setSelectedItemId(id === selectedItemId ? null : id);
  };

  // Remove item from cart
  const removeFromCart = (itemId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    setSelectedItemId(null);
    toast.success("تم حذف الصنف من السلة");
  };

  // Helper function to round amounts for cash payments only
  const roundForCash = (amount, paymentMethod) => {
    if (paymentMethod === "cash") {
      return Math.round(amount);
    }
    return amount;
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  // taxRate comes from state now
  const tax = subtotal * taxRate;
  const deliveryFee = deliveryData?.zoneFee
    ? parseFloat(deliveryData.zoneFee)
    : 0;
  const total = subtotal + tax + deliveryFee; // Total includes delivery fee if set

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [shiftReportData, setShiftReportData] = useState(null);

  // New multi-step end shift state
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [pendingShiftData, setPendingShiftData] = useState(null);

  // Refund & History State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [refundSaleId, setRefundSaleId] = useState(null); // Pre-fill sale ID for refund

  const openRefundForSale = (saleNumber) => {
    setRefundSaleId(saleNumber);
    setIsHistoryModalOpen(false); // Close history
    setIsRefundModalOpen(true); // Open refund
  };

  const handleEndShift = async () => {
    if (!currentShiftId) {
      toast.error("لا توجد وردية مفتوحة حالياً");
      return;
    }
    // Step 1: Open blind cash count modal
    setIsEndShiftModalOpen(true);
  };

  // Step 2: Submit blind cash count
  const handleBlindCashSubmit = async (actualCash) => {
    try {
      // Call end shift with blind amount
      const updatedShift = await shiftService.end({
        shiftId: currentShiftId,
        actualCash: actualCash,
      });

      console.log("Shift ended:", updatedShift);

      // Show detailed toast (Twist)
      const shortage = updatedShift.shortage;
      const amountColor =
        shortage === 0
          ? "text-green-600"
          : shortage > 0
            ? "text-green-600"
            : "text-red-600";
      const statusText =
        shortage === 0 ? "متطابق تماماً" : shortage > 0 ? "زيادة" : "عجز";

      const breakdown = updatedShift.calculationBreakdown || {};

      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? "animate-enter" : "animate-leave"
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 font-cairo`}
            dir="rtl">
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5 ml-3">
                  <span className="text-3xl">🧾</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 border-b pb-2 mb-2">
                    تم إغلاق الوردية بنجاح
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    {breakdown.startCash !== undefined && (
                      <div className="flex justify-between">
                        <span>رصيد البداية:</span>
                        <span className="font-mono">{breakdown.startCash}</span>
                      </div>
                    )}
                    {breakdown.cashSales !== undefined && (
                      <div className="flex justify-between text-green-600">
                        <span>+ مبيعات كاش:</span>
                        <span className="font-mono">{breakdown.cashSales}</span>
                      </div>
                    )}
                    {breakdown.cashExpenses !== undefined && (
                      <div className="flex justify-between text-red-600">
                        <span>- مصروفات:</span>
                        <span className="font-mono">
                          {breakdown.cashExpenses}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-dashed my-1"></div>
                    <div className="flex justify-between font-bold text-gray-700">
                      <span>= المتوقع:</span>
                      <span className="font-mono">
                        {updatedShift.systemExpectedCash} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>الفعلي (العد):</span>
                      <span className="font-mono font-bold text-blue-600">
                        {updatedShift.actualCash} ج.م
                      </span>
                    </div>
                    <div
                      className={`flex justify-between font-bold mt-2 pt-2 border-t ${amountColor}`}>
                      <span>الفرق ({statusText}):</span>
                      <span>{Math.abs(shortage)} ج.م</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                إغلاق
              </button>
            </div>
          </div>
        ),
        { duration: 6000 },
      );

      // Close blind count modal
      setIsEndShiftModalOpen(false);

      // Redirect to dashboard immediately
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to end shift:", error);

      // Check for pending deliveries error
      if (error.response?.data?.pendingOrders) {
        setIsEndShiftModalOpen(false); // Close the blind count modal
        setPendingDeliveries(error.response.data.pendingOrders);
        setIsPendingDeliveriesModalOpen(true); // Open the blocking modal
        return;
      }

      toast.error(error.response?.data?.error || "فشل إغلاق الوردية");
    }
  };

  // Step 3: Manager verification and final approval
  const handleManagerVerification = async (username, password) => {
    try {
      const approvedShift = await shiftService.approve({
        shiftId: currentShiftId,
        managerUsername: username,
        managerPassword: password,
      });

      console.log("Shift approved and closed:", approvedShift);

      // Success - show final report
      const report = await shiftService.getReport(currentShiftId);
      setShiftReportData(report);

      // Clean up
      setIsVerificationModalOpen(false);
      setPendingShiftData(null);
      setCurrentShiftId(null);

      // Show report
      setIsReportOpen(true);
      toast.success("تم إغلاق الوردية بنجاح");
    } catch (error) {
      console.error("Manager verification failed:", error);
      const errorMsg =
        error.response?.data?.error || "فشلت المصادقة. تحقق من بيانات المدير";
      toast.error(errorMsg);
      throw error; // Re-throw to keep modal open
    }
  };

  // Handle quantity selection for piece items
  const handleQuantitySelected = (quantity) => {
    if (selectedProductForQuantity) {
      const success = addToCartWithQuantity(
        selectedProductForQuantity,
        quantity,
      );
      if (success) {
        toast.success(
          `تمت إضافة ${quantity} ${selectedProductForQuantity.name} إلى السلة`,
        );
      }
      setKeypadMode("default");
      setSelectedProductForQuantity(null);
    }
  };

  // Handle weight selection for kg items
  const handleWeightSelected = (weight) => {
    if (selectedProductForQuantity) {
      const success = addToCartWithQuantity(selectedProductForQuantity, weight);
      if (success) {
        toast.success(
          `تمت إضافة ${weight} كجم من ${selectedProductForQuantity.name} إلى السلة`,
        );
      }
      setKeypadMode("default");
      setSelectedProductForQuantity(null);
    }
  };

  // Helper function to convert unit to Arabic
  const getArabicUnit = (unit) => {
    if (!unit) return "";
    const unitLower = unit.toLowerCase();
    if (unitLower === "piece" || unitLower === "pc" || unitLower === "pcs") {
      return "قطعة";
    }
    if (
      unitLower === "kg" ||
      unitLower === "kilo" ||
      unitLower === "kilogram"
    ) {
      return "كيلو";
    }
    return unit; // Return original if not recognized
  };

  // Handle print button - prints current cart or last sale
  const handlePrintClick = () => {
    if (cartItems.length > 0) {
      window.print();
    } else if (lastSale) {
      toast.success("طباعة آخر فاتورة...");
      window.print();
    } else {
      toast.error("لا توجد مبيعات لطباعتها");
    }
  };

  // Handle payment method selection
  const handlePaymentSelected = (method) => {
    toast.success(`تم اختيار الدفع ${method === "cash" ? "نقدي" : "بالبطاقة"}`);
    setKeypadMode("default");
    // Optionally clear cart after payment
    clearCart();
  };

  // Handle quick payment with confirmation
  const handleQuickPayment = (method) => {
    if (!selectedClient) {
      toast.error("يرجى اختيار العميل أولاً");
      if (clientInputRef.current) {
        clientInputRef.current.focus();
      }
      return;
    }
    if (cartItems.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    setPendingPaymentMethod(method);
    setCashPaidAmount(""); // Reset cash paid amount
    setIsPaymentConfirmOpen(true);
  };

  // Main sale completion function
  const handleCompleteSale = async (
    paymentMethod,
    deliveryDataOverride = null,
    paidAmount = null,
    changeAmount = null,
  ) => {
    // Use override if provided, otherwise use state
    const activeDeliveryData = deliveryDataOverride || deliveryData;
    console.log("🛒 Processing Sale with Delivery Data:", activeDeliveryData);

    // Determine payment amounts
    let finalPaidAmount, finalChangeAmount;
    if (paidAmount !== null && changeAmount !== null) {
      finalPaidAmount = paidAmount;
      finalChangeAmount = changeAmount;
    } else {
      // Auto-calculate for delivery orders (always CASH with exact amount)
      finalPaidAmount = parseFloat(total.toFixed(2));
      finalChangeAmount = 0;
    }

    // Prepare sale data for backend
    // Normalize payment method: if not CASH, treat as CARD (covers VISA, MASTERCARD, etc.)
    const normalizedPaymentMethod =
      typeof paymentMethod === "string"
        ? paymentMethod.toUpperCase() === "CASH"
          ? "CASH"
          : "CARD"
        : "CASH"; // Default to CASH for delivery orders

    const currentUser = AuthService.getCurrentUser();
    const saleData = {
      clientId: selectedClient ? selectedClient.id : 1, // Default to walk-in client (ID: 1)
      userId: currentUser ? currentUser.id : null,
      // employeeId: 7, // REMOVED hardcoded employee
      paymentMethod: normalizedPaymentMethod,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxRate: taxRate,
      taxAmount: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      paidAmount: finalPaidAmount,
      changeAmount: finalChangeAmount,
      status: "COMPLETED",
      deliveryManId: activeDeliveryData?.riderId,
      deliveryZoneId: activeDeliveryData?.zoneId,
      deliveryFee: activeDeliveryData?.zoneFee
        ? parseFloat(activeDeliveryData.zoneFee)
        : null,
      deliveryAddress: activeDeliveryData?.address,
      deliveryStatus: activeDeliveryData ? "OUT_FOR_DELIVERY" : null,
      items: cartItems.map((item) => ({
        itemId: item.id,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
      })),
    };

    try {
      // Create sale via API
      const createdSale = await salesService.create(saleData);
      console.log("✅ Sale created successfully:", createdSale);

      // Determine method name for display
      const methodName = normalizedPaymentMethod === "CASH" ? "نقدي" : "بطاقة";

      toast.success(
        `تم تأكيد الدفع ${methodName} - رقم الفاتورة: ${createdSale.saleNumber}`,
      );
      if (createdSale.warnings && createdSale.warnings.length > 0) {
        createdSale.warnings.forEach((warning) =>
          toast(warning, { icon: "⚠️", duration: 5000 }),
        );
      }

      // REFRESH INVENTORY
      await loadInventory();

      // Save for last sale printing
      setLastSale({
        ...saleData,
        id: createdSale.id,
        saleNumber: createdSale.saleNumber,
        items: cartItems, // Use cartItems for rich display names
        clientName: selectedClient?.name || "عميل نقدي",
        branchName: currentUser?.branch?.name || "الفرع الرئيسي",
        employeeName: currentUser?.name || currentUser?.username,
        date: new Date().toLocaleString("ar-EG"),
        // Delivery information
        riderName: activeDeliveryData?.riderName,
        zoneName: activeDeliveryData?.zoneName,
        deliveryFee: activeDeliveryData?.zoneFee,
        deliveryAddress: activeDeliveryData?.address,
      });

      setIsPaymentConfirmOpen(false);
      setPendingPaymentMethod(null);
      setCashPaidAmount("");
      setCashPaidAmount("");
      clearCart();
      setSelectedClient(null);
      setSelectedDeliveryMan(null);
      setDeliveryData(null); // Always clear delivery data after sale

      // Auto-print after successful payment
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (error) {
      console.error("❌ Error creating sale:", error);
      showErrorToast(error, "حدث خطأ أثناء حفظ الفاتورة");
    }
  };

  // Wrapper for payment confirmation (original flow)
  const handleConfirmPayment = async () => {
    const methodName = pendingPaymentMethod === "cash" ? "نقدي" : "بطاقة";

    // For cash, validate paid amount
    if (pendingPaymentMethod === "cash") {
      const paid = parseFloat(cashPaidAmount);
      if (isNaN(paid) || paid < total) {
        toast.error("المبلغ المدفوع أقل من الإجمالي");
        return;
      }
    }

    // Calculate final amounts with rounding for cash only
    let finalPaidAmount, finalChangeAmount;
    if (pendingPaymentMethod === "cash") {
      const paid = parseFloat(cashPaidAmount);
      finalPaidAmount = Math.round(paid);
      finalChangeAmount = Math.round(paid - total);
    } else {
      finalPaidAmount = parseFloat(total.toFixed(2));
      finalChangeAmount = 0;
    }

    // Call main completion function
    const normalizedPaymentMethod =
      pendingPaymentMethod.toUpperCase() === "CASH" ? "CASH" : "CARD";
    await handleCompleteSale(
      normalizedPaymentMethod,
      null,
      finalPaidAmount,
      finalChangeAmount,
    );
  };

  const handleConfirmShift = async () => {
    if (!currentShiftId) return;

    try {
      await shiftService.end({
        shiftId: currentShiftId,
        endCash: 0,
      });
      toast.success("تم إغلاق الوردية بنجاح");
      setIsReportOpen(false);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to end shift", error);
      toast.error("فشل إغلاق الوردية");
    }
  };

  const handleSaveClient = async (formData) => {
    try {
      const savedClient = await clientService.create(formData, {
        checkIfExists: true,
      });
      setIsClientModalOpen(false);

      // Auto-select the client
      handleSelectClient(savedClient);

      // Determine message based on whether it was created or found
      // We can infer it was found if We sent checkIfExists and got a result.
      // The backend adds _isExisting flag if found.
      const isExisting =
        savedClient.id && clients.find((c) => c.id === savedClient.id);

      // Note: Since we fetch all clients on mount/modal open, if it was just created it won't be in 'clients' state yet unless we update it.
      // But we just want to show a relevant toast.

      if (savedClient._isExisting || isExisting) {
        toast.success(`تم اختيار العميل الموجود: ${savedClient.name}`);
      } else {
        toast.success("تم إضافة العميل واختياره بنجاح");
        // Add to local list so it appears in search immediately without refetch
        setClients((prev) => [...prev, savedClient]);
      }
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

    const proceedRetrieval = () => {
      setCartItems(cartToRetrieve.items);
      setHeldCarts((prev) => prev.filter((c) => c.id !== cartId));
      setIsHeldCartsModalOpen(false);
      toast.success("تم استرجاع الفاتورة");
    };

    if (cartItems.length > 0) {
      confirmAction(
        "يوجد أصناف في السلة الحالية. هل تريد استبدالها بالفاتورة المعلقة؟",
        proceedRetrieval,
      );
    } else {
      proceedRetrieval();
    }
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark overflow-hidden h-screen flex flex-col text-sm font-sans"
      dir="rtl">
      <StartShiftModal
        isOpen={isStartShiftModalOpen}
        onConfirm={handleStartShift}
        branchName={currentUser?.branch?.name}
        user={currentUser}
      />

      {shiftReportData && (
        <POSReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          onConfirm={handleConfirmShift}
          reportData={shiftReportData}
        />
      )}

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

      {/* End Shift Modal (Step 1: Blind Count) */}
      <EndShiftModal
        isOpen={isEndShiftModalOpen}
        onClose={() => setIsEndShiftModalOpen(false)}
        onSubmit={handleBlindCashSubmit}
        systemExpectedCash={0} // Hidden in blind count
      />

      {/* Pending Deliveries Blocking Modal */}
      <PendingDeliveriesModal
        isOpen={isPendingDeliveriesModalOpen}
        onClose={() => setIsPendingDeliveriesModalOpen(false)}
        pendingOrders={pendingDeliveries}
      />

      {/* Manager Verification Modal (Step 2) */}
      <ShiftVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        onVerify={handleManagerVerification}
        branchId={currentUser?.branch?.id}
        shiftData={pendingShiftData}
      />

      {/* Refund Modal */}
      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => {
          setIsRefundModalOpen(false);
          setRefundSaleId(null);
        }}
        branchId={currentUser?.branch?.id}
        initialSaleId={refundSaleId}
      />

      {/* Orders History Modal */}
      <OrdersHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        shiftId={currentShiftId}
        onRefundClick={openRefundForSale}
      />

      {/* Payment Confirmation Modal */}
      <Modal
        isOpen={isPaymentConfirmOpen}
        onClose={() => setIsPaymentConfirmOpen(false)}
        title="تأكيد الدفع">
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-6 border border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600 dark:text-gray-400 text-lg">
                طريقة الدفع:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-3xl ${
                    pendingPaymentMethod === "cash"
                      ? "text-green-500"
                      : "text-blue-500"
                  }`}>
                  {pendingPaymentMethod === "cash" ? "payments" : "credit_card"}
                </span>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {pendingPaymentMethod === "cash" ? "نقدي" : "بطاقة"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-primary/20">
              <span className="text-gray-600 dark:text-gray-400 text-lg">
                المبلغ الإجمالي:
              </span>
              <span className="text-3xl font-bold text-primary">
                {total.toFixed(2)} ج.م
              </span>
            </div>
          </div>

          {/* Cash Payment Input Fields */}
          {pendingPaymentMethod === "cash" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  المبلغ المدفوع:
                </label>
                <input
                  type="number"
                  step="1"
                  value={cashPaidAmount}
                  onChange={(e) => setCashPaidAmount(e.target.value)}
                  className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-primary/30 rounded-lg focus:outline-none focus:border-primary dark:bg-zinc-800 dark:text-gray-100"
                  placeholder="أدخل المبلغ المدفوع"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  الباقي:
                </label>
                <div className="w-full px-4 py-3 text-xl font-bold text-center bg-gray-100 dark:bg-zinc-800 text-green-600 dark:text-green-400 border-2 border-gray-300 dark:border-zinc-600 rounded-lg">
                  {cashPaidAmount &&
                  !isNaN(parseFloat(cashPaidAmount)) &&
                  parseFloat(cashPaidAmount) >= total
                    ? Math.round(parseFloat(cashPaidAmount) - total)
                    : 0}{" "}
                  ج.م
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
                info
              </span>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-bold mb-1">
                  العميل: {selectedClient?.name || "عميل نقدي"}
                </p>
                <p>عدد الأصناف: {cartItems.length}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsPaymentConfirmOpen(false)}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">close</span>
              <span>إلغاء</span>
            </button>
            <button
              onClick={handleConfirmPayment}
              className={`flex-1 px-6 py-3 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                pendingPaymentMethod === "cash"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}>
              <span className="material-symbols-outlined">check_circle</span>
              <span>تأكيد الدفع</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delivery Modal */}
      <DeliveryModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        onConfirm={async (data) => {
          // Save delivery data first
          setDeliveryData(data);

          // Auto-complete sale with CASH payment method
          try {
            await handleCompleteSale("CASH", data);
            setIsDeliveryModalOpen(false);
            toast.success(
              `تم تأكيد طلب التوصيل: ${data.zoneName} - ${data.riderName}`,
            );
          } catch (error) {
            console.error("Failed to save delivery order:", error);
            toast.error("فشل حفظ طلب التوصيل");
          }
        }}
        selectedClient={selectedClient}
        deliveryMen={deliveryMen}
        currentShiftId={currentShiftId}
        branchId={currentUser?.branch?.id}
      />

      <DeliveryDebtsModal
        isOpen={isDeliveryDebtsModalOpen}
        onClose={() => setIsDeliveryDebtsModalOpen(false)}
        branchId={currentUser?.branch?.id}
        currentShiftId={currentShiftId}
      />

      {/* Header */}
      <div className="bg-primary dark:bg-primary text-white px-3 md:px-4 py-2 flex items-center justify-between shrink-0 shadow-sm z-30 print:hidden">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-1 md:gap-2">
            <span className="material-symbols-outlined text-lg">person</span>
            <span className="font-bold hidden md:inline">اسم الموظف:</span>
            <span className="text-sm md:text-base">
              {currentUser?.name || currentUser?.username || "Guest"}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">store</span>
            <span className="font-bold">اسم الفرع:</span>
            <span>{currentUser?.branch?.name || "غير محدد"}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="material-symbols-outlined text-lg">schedule</span>
            <span className="font-bold hidden md:inline">الوردية:</span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm md:text-base">{currentShift}</span>
              <span
                className="text-[10px] md:text-xs font-mono opacity-80 hidden md:block"
                dir="ltr">
                {currentTime}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              calendar_today
            </span>
            <span className="font-bold">التاريخ:</span>
            <span>{currentDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refund & History Buttons */}
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm">
            <FaHistory />
            <span className="hidden md:inline">سجل الفواتير</span>
          </button>

          <button
            onClick={() => setIsDeliveryDebtsModalOpen(true)}
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm">
            <span className="material-symbols-outlined text-sm">
              account_balance_wallet
            </span>
            <span className="hidden md:inline">ديون الطيارين</span>
          </button>

          <button
            onClick={() => setIsRefundModalOpen(true)}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm">
            <FaRedo />
            <span className="hidden md:inline">مرتجع</span>
          </button>

          <div className="h-6 w-px bg-white/20 mx-1"></div>

          <button
            onClick={handleEndShift}
            className="flex items-center gap-1 md:gap-2 bg-red-600 hover:bg-red-700 text-white px-2 md:px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm">
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="hidden md:inline">إنهاء الوردية</span>
            <span className="md:hidden">إنهاء</span>
          </button>
        </div>
      </div>

      {/* Blocking Modal - appears if another user has active shift */}
      <ShiftBlockedModal
        isOpen={isShiftBlocked}
        blockerInfo={blockingShiftDetails}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden print:hidden relative">
        {/* Mobile Tab Navigation */}
        <div className="md:hidden bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 flex text-xs font-bold shrink-0 z-50 order-last">
          <button
            onClick={() => setActiveMobileTab("products")}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeMobileTab === "products"
                ? "text-primary bg-primary/5 border-t-2 border-primary"
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800"
            }`}>
            <span className="material-symbols-outlined">grid_view</span>
            <span>المنتجات</span>
          </button>
          <button
            onClick={() => setActiveMobileTab("cart")}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors relative ${
              activeMobileTab === "cart"
                ? "text-primary bg-primary/5 border-t-2 border-primary"
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800"
            }`}>
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>السلة ({cartItems.length})</span>
            {cartItems.length > 0 && (
              <span className="absolute top-2 left-[55%] h-2 w-2 rounded-full bg-red-500"></span>
            )}
          </button>
        </div>
        {/* Product Grid Area - Hidden on mobile if tab is 'cart' */}
        <div
          className={`flex-1 flex flex-col overflow-hidden bg-background-light dark:bg-zinc-900 relative border-l border-gray-200 dark:border-zinc-700 ${
            activeMobileTab === "cart" ? "hidden md:flex" : "flex"
          }`}>
          {/* Top Bar */}
          <div className="flex items-center justify-between p-3 md:p-4 bg-card-light dark:bg-card-dark shadow-sm z-10 shrink-0 gap-2">
            <div className="flex items-center text-gray-500 dark:text-gray-400 gap-2">
              <button
                onClick={() => navigate(-1)}
                className="hover:text-primary transition-colors flex items-center p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="hover:text-primary transition-colors flex items-center hidden md:flex">
                <span className="material-symbols-outlined">home</span>
              </button>
              <span className="mx-2 text-gray-300 hidden md:inline">/</span>
              <a
                className="flex items-center hover:text-primary transition-colors hidden md:flex"
                href="#">
                <span className="material-symbols-outlined ml-1">apps</span>
                <span className="font-medium">كل المنتجات</span>
              </a>
            </div>
            <div className="relative flex-1 md:flex-none">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <span className="material-symbols-outlined text-lg">
                  search
                </span>
              </span>
              <input
                className="pr-10 pl-4 py-2 w-full md:w-80 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-400 text-sm shadow-sm transition-all font-sans"
                placeholder="بحث عن منتج..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Products Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Categories Slider */}
            <div className="flex items-center gap-2 mb-4">
              {/* Left Arrow */}
              <button
                onClick={() => {
                  const container =
                    document.getElementById("categories-slider");
                  container.scrollBy({ left: 200, behavior: "smooth" });
                }}
                className="flex-shrink-0 bg-white dark:bg-zinc-800 rounded-lg p-2 shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all border border-gray-200 dark:border-zinc-700">
                <span className="material-symbols-outlined text-primary text-xl">
                  chevron_right
                </span>
              </button>

              {/* Categories Container */}
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

              {/* Right Arrow */}
              <button
                onClick={() => {
                  const container =
                    document.getElementById("categories-slider");
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
                  className="bg-card-light dark:bg-card-dark rounded shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col h-24 group relative active:scale-95 transition-transform"
                  onClick={() => handleProductClick(product)}>
                  <span className="absolute top-1 left-1 text-gray-300 hover:text-gray-500 dark:text-gray-500 cursor-help">
                    <span className="material-symbols-outlined text-sm">
                      info
                    </span>
                  </span>
                  <div className="p-3 flex flex-col flex-1 justify-between h-full">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1 line-clamp-2 leading-tight">
                      {product.name}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                      المتاح: {Number(product.quantity || 0)}{" "}
                      {getArabicUnit(product.unit)}
                    </div>
                    <div className="mt-auto">
                      <span className="block text-primary dark:text-primary/90 font-bold text-base">
                        {Number(
                          product.sellPrice || product.price || 0,
                        ).toFixed(2)}{" "}
                        ج.م
                        {product.unit && (
                          <span className="text-[10px] text-gray-500 font-normal">
                            / {getArabicUnit(product.unit)}
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

        {/* Cart/Sidebar Area - Hidden on mobile if tab is 'products', full width on mobile */}
        <div
          className={`w-full md:w-[600px] flex flex-col flex-1 md:flex-none bg-card-light dark:bg-card-dark shadow-xl z-20 ${
            activeMobileTab === "products" ? "hidden md:flex" : "flex"
          }`}>
          {/* Client Selection */}
          <div className="p-4 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-card-dark shrink-0 z-20 relative">
            <div className="relative">
              <div
                className="relative"
                onClick={() =>
                  !isClientDropdownOpen && setIsClientDropdownOpen(true)
                }>
                <input
                  ref={clientInputRef}
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

              {/* Display Address if selected */}
              {selectedClient && (
                <div className="mt-3 px-1">
                  {selectedClient.address ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 flex items-start gap-3 transition-all animate-fade-in">
                      <span className="material-symbols-outlined text-blue-500 text-lg mt-0.5">
                        location_on
                      </span>
                      <div>
                        <div className="text-xs text-blue-400 font-bold mb-0.5">
                          العنوان
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200 leading-snug">
                          {selectedClient.address}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-zinc-800 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg p-3 flex items-center justify-center gap-2 text-gray-400 transition-all">
                      <span className="material-symbols-outlined text-lg">
                        location_off
                      </span>
                      <span className="text-xs font-medium">
                        لا يوجد عنوان مسجل
                      </span>
                    </div>
                  )}
                </div>
              )}

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

          <div
            className={`${
              keypadMode === "default" ? "flex-1" : "h-[45%]"
            } overflow-y-auto p-0 flex flex-col transition-all duration-300`}>
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
                    className={`p-3 border-b border-gray-100 dark:border-zinc-700 cursor-pointer transition-colors flex items-center gap-2 ${
                      selectedItemId === item.id
                        ? "bg-primary/10 border-r-4 border-r-primary dark:border-r-primary"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                    }`}>
                    {/* Delete icon - appears when selected */}
                    {selectedItemId === item.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.id);
                        }}
                        className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-full transition-colors"
                        title="حذف من السلة">
                        <span className="material-symbols-outlined text-xl">
                          delete
                        </span>
                      </button>
                    ) : (
                      <div className="w-9"></div>
                    )}

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {item.name}
                        </span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {item.total.toFixed(2)} ج.م
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.quantity.toFixed(2)} وحدة x{" "}
                        {item.price.toFixed(2)} ج.م / وحدة
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-auto">
              <div className="bg-card-light dark:bg-card-dark border-t border-gray-200 dark:border-zinc-700">
                {/* Payment Action Buttons - Only show when keypad is closed */}
                {keypadMode === "default" && (
                  <div className="grid grid-cols-4 gap-0 text-sm border-b border-gray-200 dark:border-zinc-700">
                    <button
                      onClick={handlePrintClick}
                      className="flex flex-col items-center justify-center p-3 bg-[#6F4E37] hover:bg-[#5D4030] text-white transition-all duration-300 border-l border-white/10 group">
                      <span className="material-symbols-outlined mb-1 group-hover:scale-110 transition-transform">
                        print
                      </span>
                      <span className="font-bold">طباعة</span>
                    </button>
                    <button
                      onClick={() => handleQuickPayment("cash")}
                      className="flex flex-col items-center justify-center p-3 bg-green-500 hover:bg-green-600 text-white transition-colors border-l border-white/10">
                      <span className="material-symbols-outlined mb-1">
                        payments
                      </span>
                      <span className="font-bold">نقدي</span>
                    </button>
                    <button
                      onClick={() => handleQuickPayment("visa")}
                      className="flex flex-col items-center justify-center p-3 bg-blue-500 hover:bg-blue-600 text-white transition-colors border-l border-white/10">
                      <span className="material-symbols-outlined mb-1">
                        credit_card
                      </span>
                      <span className="font-bold">بطاقة</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedClient) {
                          toast.error("يرجى اختيار العميل أولاً");
                          if (clientInputRef.current) {
                            clientInputRef.current.focus();
                          }
                          return;
                        }
                        setIsDeliveryModalOpen(true);
                      }}
                      className="flex flex-col items-center justify-center p-3 bg-orange-500 hover:bg-orange-600 text-white transition-colors">
                      <span className="material-symbols-outlined mb-1">
                        local_shipping
                      </span>
                      <span className="font-bold">توصيل</span>
                    </button>
                  </div>
                )}

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
                  {deliveryData && (
                    <div className="flex justify-end text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                      رسوم التوصيل ({deliveryData.zoneName}):{" "}
                      {parseFloat(deliveryData.zoneFee).toFixed(2)} ج.م
                    </div>
                  )}
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
                    <span>
                      {cartItems.length > 0 ? "تعليق" : "فواتير معلقة"}
                    </span>
                    {heldCarts.length > 0 && cartItems.length > 0 && (
                      <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Keypad Panel - Shows at bottom when mode is piece/weight/payment */}
          {keypadMode !== "default" && (
            <div className="h-[55%] flex flex-col bg-card-light dark:bg-card-dark border-t border-gray-200 dark:border-zinc-700 transition-all duration-300">
              {/* Dynamic Keypad Area - Changes based on mode */}
              <div
                className={`grid h-full bg-white dark:bg-zinc-800 ${
                  keypadMode === "piece"
                    ? "grid-cols-3 grid-rows-[auto_1fr_1fr_1fr_1fr_1fr]"
                    : keypadMode === "weight"
                      ? "grid-cols-2 grid-rows-[auto_1fr_1fr_1fr_1fr]"
                      : "grid-cols-5"
                }`}
                dir="ltr">
                {/* PIECE QUANTITY SELECTOR MODE */}
                {keypadMode === "piece" && selectedProductForQuantity && (
                  <>
                    {/* Header */}
                    <div className="col-span-3 bg-primary/10 dark:bg-primary/20 p-3 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {selectedProductForQuantity.name} - اختر الكمية (قطعة)
                      </div>
                      <button
                        onClick={() => setKeypadMode("default")}
                        className="text-red-500 hover:text-red-700">
                        <span className="material-icons-round">close</span>
                      </button>
                    </div>

                    {/* Number Pad for pieces - Rows 1-3 */}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleQuantitySelected(num)}
                        className="border border-gray-200 dark:border-zinc-700 text-2xl font-bold text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white transition-all">
                        {num}
                      </button>
                    ))}

                    {/* Row 4: Button 10 + Custom Input */}
                    <button
                      onClick={() => handleQuantitySelected(10)}
                      className="border border-gray-200 dark:border-zinc-700 text-2xl font-bold text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white transition-all">
                      10
                    </button>
                    <div className="col-span-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 flex items-center">
                      <input
                        type="number"
                        value={customInputValue}
                        onChange={(e) => setCustomInputValue(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleCustomInputSubmit()
                        }
                        placeholder="كمية"
                        className="w-full bg-transparent text-center text-lg font-bold text-gray-800 dark:text-gray-200 outline-none"
                        min="0"
                        step="any"
                      />
                    </div>

                    {/* Row 5: Cancel + Confirm */}
                    <button
                      onClick={() => setKeypadMode("default")}
                      className="bg-red-100 dark:bg-red-900/30 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 font-bold text-sm transition-all border border-gray-200 dark:border-zinc-700">
                      إلغاء
                    </button>
                    <button
                      onClick={handleCustomInputSubmit}
                      className="col-span-2 bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all flex items-center justify-center border border-gray-200 dark:border-zinc-700">
                      <span className="material-icons-round text-sm">done</span>
                    </button>
                  </>
                )}

                {/* WEIGHT SELECTOR MODE */}
                {keypadMode === "weight" && selectedProductForQuantity && (
                  <>
                    {/* Header */}
                    <div className="col-span-2 bg-primary/10 dark:bg-primary/20 p-3 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {selectedProductForQuantity.name} - اختر الوزن (كيلو)
                      </div>
                      <button
                        onClick={() => setKeypadMode("default")}
                        className="text-red-500 hover:text-red-700">
                        <span className="material-icons-round">close</span>
                      </button>
                    </div>

                    {/* Row 1: 1/8, 1/4 */}
                    <button
                      onClick={() => handleWeightSelected(0.125)}
                      className="border border-gray-200 dark:border-zinc-700 hover:bg-primary hover:text-white transition-all flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">1/8</span>
                      <span className="text-xs opacity-70">كيلو</span>
                    </button>
                    <button
                      onClick={() => handleWeightSelected(0.25)}
                      className="border border-gray-200 dark:border-zinc-700 hover:bg-primary hover:text-white transition-all flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">1/4</span>
                      <span className="text-xs opacity-70">كيلو</span>
                    </button>

                    {/* Row 2: 1/2, 1 */}
                    <button
                      onClick={() => handleWeightSelected(0.5)}
                      className="border border-gray-200 dark:border-zinc-700 hover:bg-primary hover:text-white transition-all flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">1/2</span>
                      <span className="text-xs opacity-70">كيلو</span>
                    </button>
                    <button
                      onClick={() => handleWeightSelected(1)}
                      className="border border-gray-200 dark:border-zinc-700 hover:bg-primary hover:text-white transition-all flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">1</span>
                      <span className="text-xs opacity-70">كيلو</span>
                    </button>

                    {/* Row 3: Custom Input */}
                    <div className="col-span-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 flex items-center">
                      <input
                        type="number"
                        value={customInputValue}
                        onChange={(e) => setCustomInputValue(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleCustomInputSubmit()
                        }
                        placeholder="وزن (كيلو)"
                        className="w-full bg-transparent text-center text-lg font-bold text-gray-800 dark:text-gray-200 outline-none"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {/* Row 4: Cancel + Confirm */}
                    <button
                      onClick={() => setKeypadMode("default")}
                      className="bg-red-100 dark:bg-red-900/30 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 font-bold text-sm transition-all border border-gray-200 dark:border-zinc-700">
                      إلغاء
                    </button>
                    <button
                      onClick={handleCustomInputSubmit}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all flex items-center justify-center border border-gray-200 dark:border-zinc-700">
                      <span className="material-icons-round text-sm">done</span>
                    </button>
                  </>
                )}

                {/* PAYMENT SELECTION MODE */}
                {keypadMode === "payment" && (
                  <>
                    {/* Header */}
                    <div className="col-span-5 bg-primary/10 dark:bg-primary/20 p-3 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        اختر طريقة الدفع
                      </div>
                      <button
                        onClick={() => setKeypadMode("default")}
                        className="text-red-500 hover:text-red-700">
                        <span className="material-icons-round">close</span>
                      </button>
                    </div>

                    {/* Total Display */}
                    <div className="col-span-5 bg-gray-50 dark:bg-zinc-700/50 p-4 flex justify-between items-center border-b border-gray-200 dark:border-zinc-700">
                      <span className="text-gray-600 dark:text-gray-400">
                        الإجمالي:
                      </span>
                      <span className="text-3xl font-bold text-primary">
                        {total.toFixed(2)} ج.م
                      </span>
                    </div>

                    {/* Payment Buttons */}
                    <button
                      onClick={() => handlePaymentSelected("cash")}
                      className="col-span-5 row-span-2 bg-green-500 hover:bg-green-600 text-white font-bold text-xl transition-all flex flex-col items-center justify-center gap-2 border border-gray-200 dark:border-zinc-700">
                      <span className="material-icons-round text-4xl">
                        payments
                      </span>
                      <span>نقدي (Cash)</span>
                    </button>

                    <button
                      onClick={() => handlePaymentSelected("visa")}
                      className="col-span-5 row-span-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl transition-all flex flex-col items-center justify-center gap-2 border border-gray-200 dark:border-zinc-700">
                      <span className="material-icons-round text-4xl">
                        credit_card
                      </span>
                      <span>بطاقة (Visa)</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Thermal Receipt Template - Invisible on screen, visible on print */}
      <div id="thermal-receipt" className="hidden print:block">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-2">
            <img
              src="/assets/logo.png"
              alt="Logo"
              className="w-[50mm] h-auto object-contain"
            />
          </div>
          <h2 className="text-xl font-bold uppercase tracking-wider">
            {currentUser?.branch?.name || "Elghonemy ERP"}
          </h2>
          <p className="text-xs opacity-80">
            {lastSale?.date || new Date().toLocaleString("ar-EG")}
          </p>
          <div className="border-b border-dashed border-black my-2"></div>
        </div>

        <div className="text-xs mb-3 space-y-1">
          <div className="flex justify-between">
            <span>رقم الفاتورة:</span>
            <span className="font-mono">{lastSale?.saleNumber || "Draft"}</span>
          </div>
          <div className="flex justify-between">
            <span>العميل:</span>
            <span>
              {selectedClient?.name || lastSale?.clientName || "عميل نقدي"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>البائع:</span>
            <span>
              {currentUser?.name || lastSale?.employeeName || "System"}
            </span>
          </div>
        </div>

        {/* Delivery Information - Only show if delivery data exists */}
        {(deliveryData || lastSale?.deliveryAddress) && (
          <>
            <div className="border-b border-gray-300 my-2"></div>
            <div className="text-xs mb-3 space-y-1 bg-gray-50 p-2 rounded">
              <div className="font-bold mb-1">🚚 معلومات التوصيل</div>
              {(deliveryData?.riderName || lastSale?.riderName) && (
                <div className="flex justify-between">
                  <span>الطيار:</span>
                  <span className="font-bold">
                    {deliveryData?.riderName || lastSale?.riderName}
                  </span>
                </div>
              )}
              {(deliveryData?.zoneName || lastSale?.zoneName) && (
                <div className="flex justify-between">
                  <span>المنطقة:</span>
                  <span>{deliveryData?.zoneName || lastSale?.zoneName}</span>
                </div>
              )}
              {(deliveryData?.address || lastSale?.deliveryAddress) && (
                <div className="mt-1">
                  <span className="font-semibold">العنوان:</span>
                  <p className="text-[10px] mt-0.5 pr-2">
                    {deliveryData?.address || lastSale?.deliveryAddress}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-b border-gray-300 my-2"></div>

        <table className="w-full text-xs text-right">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-1">الصنف</th>
              <th className="py-1 text-center">كمية</th>
              <th className="py-1 text-left">سعر</th>
            </tr>
          </thead>
          <tbody>
            {(cartItems.length > 0 ? cartItems : lastSale?.items || []).map(
              (item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-left">{item.total.toFixed(2)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 text-xs">
          <div className="flex justify-between font-bold text-sm">
            <span>الإجمالي</span>
            <span>
              {(
                (cartItems.length > 0
                  ? total
                  : parseFloat(lastSale?.total || 0)) +
                parseFloat(deliveryData?.zoneFee || lastSale?.deliveryFee || 0)
              ).toFixed(2)}{" "}
              ج.م
            </span>
          </div>
          <div className="flex justify-between opacity-80">
            <span>قيمة الضريبة</span>
            <span>
              {(cartItems.length > 0 ? tax : lastSale?.taxAmount || 0).toFixed(
                2,
              )}{" "}
              ج.م
            </span>
          </div>
          {/* Delivery Fee - Only show if delivery exists */}
          {(deliveryData?.zoneFee || lastSale?.deliveryFee) && (
            <div className="flex justify-between opacity-80">
              <span>رسوم التوصيل</span>
              <span>
                {parseFloat(
                  deliveryData?.zoneFee || lastSale?.deliveryFee || 0,
                ).toFixed(2)}{" "}
                ج.م
              </span>
            </div>
          )}
          <div className="flex justify-between opacity-80">
            <span>طريقة الدفع</span>
            <span>{lastSale?.paymentMethod === "CASH" ? "نقدي" : "بطاقة"}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black mt-6 mb-2"></div>
        <div className="text-center">
          <p className="text-xs font-bold italic">نأمل رؤيتكم مرة أخرى</p>
          <p className="text-[10px] mt-1">Elghonemy ERP System</p>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
