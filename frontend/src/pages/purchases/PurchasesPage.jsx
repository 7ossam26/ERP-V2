import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import KgQuantityInput from "../../components/ui/KgQuantityInput";
import {
  supplierService,
  itemService,
  treasuryService,
  warehouseService,
  purchaseService,
  settingsService,
} from "../../services/domainServices";
import Modal from "../../components/ui/Modal";
import { ItemForm } from "../items/ItemManager";
import PurchaseDetailsModal from "../reports/history/PurchaseDetailsModal";
import PurchaseReturnModal from "./PurchaseReturnModal";

const PurchasesPage = () => {
  const [paymentMethod, setPaymentMethod] = useState("CASH"); // CASH, CREDIT, DEFERRED, MIXED
  const [items, setItems] = useState([
    {
      id: Date.now(),
      name: "",
      itemId: null,
      quantity: 1,
      purchasePrice: 0,
      sellPrice: 0,
      unit: "piece",
    },
  ]);
  const [discountType, setDiscountType] = useState("percent"); // percent, value

  const [discountValue, setDiscountValue] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [selectedTreasuryBalance, setSelectedTreasuryBalance] = useState(0);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [purchases, setPurchases] = useState([]);

  // Receipt Modal State
  const [createdPurchase, setCreatedPurchase] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [selectedHistoryPurchase, setSelectedHistoryPurchase] = useState(null);

  // P1/P2: Searchable item dropdown state
  const [itemSearches, setItemSearches] = useState({}); // { [rowId]: searchText }
  const [openItemDropdown, setOpenItemDropdown] = useState(null); // rowId of open dropdown

  // P5: Held purchases (persisted to localStorage)
  const [heldPurchases, setHeldPurchases] = useState(() => {
    try { return JSON.parse(localStorage.getItem("heldPurchases") || "[]"); }
    catch { return []; }
  });
  const [isHeldPurchasesOpen, setIsHeldPurchasesOpen] = useState(false);

  const navigate = useNavigate();

  // Detect unsaved invoice data
  const hasUnsavedData = selectedSupplierId && items.some((i) => i.itemId);

  // Block in-app navigation when there's unsaved data (safe fallback)
  const blocker = { state: 'unblocked', proceed: () => {}, reset: () => {} };

  // Browser tab close / refresh guard
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedData]);

  // Hold invoice and proceed with blocked navigation
  const handleHoldAndLeave = () => {
    handleHoldPurchase();
    blocker.proceed?.();
  };

  // Discard and proceed with blocked navigation
  const handleDiscardAndLeave = () => {
    blocker.proceed?.();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch essential data (suppliers, items, treasuries, warehouses)
        const [
          fetchedSuppliers,
          fetchedItems,
          fetchedTreasuries,
          fetchedWarehouses,
        ] = await Promise.all([
          supplierService.getAll(),
          itemService.getAll(),
          treasuryService.getAll(),
          warehouseService.getAll(),
        ]);
        setSuppliers(fetchedSuppliers);
        setAllItems(fetchedItems);
        setTreasuries(fetchedTreasuries);
        setWarehouses(fetchedWarehouses);

        // Auto-select first treasury and warehouse if available
        if (fetchedTreasuries.length > 0) {
          setSelectedTreasuryId(fetchedTreasuries[0].id);
        }

        // Fetch Settings to set Main Warehouse
        try {
          const settings = await settingsService.get();
          if (settings && settings.mainWarehouseId) {
            setSelectedWarehouseId(settings.mainWarehouseId);
          } else if (fetchedWarehouses.length > 0) {
            // Fallback if no main warehouse configured
            setSelectedWarehouseId(fetchedWarehouses[0].id);
          }
        } catch (settingsError) {
          console.error("Failed to fetch settings", settingsError);
          if (fetchedWarehouses.length > 0) {
            setSelectedWarehouseId(fetchedWarehouses[0].id);
          }
        }

        // Fetch purchases separately (non-blocking if it fails)
        try {
          const fetchedPurchases = await purchaseService.getAll();
          setPurchases(fetchedPurchases);
        } catch (purchaseError) {
          console.error(
            "Failed to fetch purchases (ID will start from 1):",
            purchaseError,
          );
          // Don't block - just start from ID 1
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

  // Calculated totals
  const [totals, setTotals] = useState({
    subtotal: 0,
    discountAmount: 0,
    net: 0,
    totalSell: 0,
    profit: 0,
    remaining: 0,
  });

  useEffect(() => {
    calculateTotals();
  }, [items, discountType, discountValue, paidAmount]);

  const calculateTotals = () => {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + (Number(item.quantity) * Number(item.purchasePrice) || 0),
      0,
    );
    const totalSell = items.reduce(
      (sum, item) =>
        sum + (Number(item.quantity) * Number(item.sellPrice) || 0),
      0,
    );

    let discountAmount = 0;
    if (discountType === "percent") {
      discountAmount = subtotal * (Number(discountValue) / 100);
    } else {
      discountAmount = Number(discountValue);
    }

    const net = Math.max(0, subtotal - discountAmount);
    const profit = totalSell - net; // Profit = Total Sell - Total After Discount
    const remaining = Math.max(0, net - Number(paidAmount));

    setTotals({
      subtotal,
      discountAmount,
      net,
      totalSell,
      profit,
      remaining,
    });
  };

  // P2: Per-row available items — exclude already-selected items (but keep current row's own selection)
  const selectedItemIds = new Set(items.filter((i) => i.itemId).map((i) => i.itemId));
  const getAvailableItems = (rowId) => {
    const thisRow = items.find((r) => r.id === rowId);
    return allItems.filter((i) => !selectedItemIds.has(i.id) || thisRow?.itemId === i.id);
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      name: "",
      itemId: null, // Track the actual item from database
      quantity: 1,
      purchasePrice: 0,
      sellPrice: 0,
      unit: "piece",
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  // Handle item selection from searchable dropdown (P1/P2/P4)
  const handleItemSelect = (rowId, selectedItem) => {
    setItems(
      items.map((item) =>
        item.id === rowId
          ? {
              ...item,
              itemId: selectedItem.id,
              name: selectedItem.name,
              // P4: auto-fill last purchase price from costPrice field
              purchasePrice: parseFloat(selectedItem.costPrice) || 0,
              sellPrice: selectedItem.price || 0,
              unit: selectedItem.unit || "piece",
              quantity: 1,
            }
          : item,
      ),
    );
    setItemSearches((prev) => ({ ...prev, [rowId]: selectedItem.name }));
    setOpenItemDropdown(null);
  };

  // P5: Hold/suspend purchase invoice
  const handleHoldPurchase = () => {
    if (!selectedSupplierId || !items.some((i) => i.itemId)) {
      toast.error("أضف موردًا وصنف واحد على الأقل");
      return;
    }
    const held = {
      id: Date.now(),
      supplierId: selectedSupplierId,
      supplierName: suppliers.find((s) => s.id === parseInt(selectedSupplierId))?.name || "",
      items: items.filter((i) => i.itemId),
      timestamp: new Date().toLocaleTimeString("ar-EG"),
      total: totals.net.toFixed(2),
      paymentMethod,
      discountType,
      discountValue,
      warehouseId: selectedWarehouseId,
      treasuryId: selectedTreasuryId,
      supplierInvoiceNo,
    };
    const updated = [held, ...heldPurchases];
    setHeldPurchases(updated);
    localStorage.setItem("heldPurchases", JSON.stringify(updated));
    // Reset form
    setItems([{ id: Date.now(), name: "", itemId: null, quantity: 1, purchasePrice: 0, sellPrice: 0, unit: "piece" }]);
    setItemSearches({});
    setDiscountValue(0);
    setSupplierInvoiceNo("");
    toast.success("تم تعليق فاتورة المشتريات بنجاح");
  };

  const handleRetrievePurchase = (id) => {
    const held = heldPurchases.find((h) => h.id === id);
    if (!held) return;
    setItems(held.items);
    setSelectedSupplierId(held.supplierId);
    setPaymentMethod(held.paymentMethod || "CASH");
    setDiscountType(held.discountType || "percent");
    setDiscountValue(held.discountValue || 0);
    setSelectedWarehouseId(held.warehouseId || selectedWarehouseId);
    setSelectedTreasuryId(held.treasuryId || selectedTreasuryId);
    setSupplierInvoiceNo(held.supplierInvoiceNo || "");
    // Restore search labels
    const searches = {};
    held.items.forEach((i) => { searches[i.id] = i.name; });
    setItemSearches(searches);
    const updated = heldPurchases.filter((h) => h.id !== id);
    setHeldPurchases(updated);
    localStorage.setItem("heldPurchases", JSON.stringify(updated));
    setIsHeldPurchasesOpen(false);
    toast.success("تم استرجاع فاتورة المشتريات");
  };

  const handleDeleteHeldPurchase = (id) => {
    const updated = heldPurchases.filter((h) => h.id !== id);
    setHeldPurchases(updated);
    localStorage.setItem("heldPurchases", JSON.stringify(updated));
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    // Reset paid amount logic based on method
    if (method === "CASH" || method === "CREDIT") {
      setPaidAmount(totals.net);
    } else if (method === "DEFERRED") {
      setPaidAmount(0);
    }
    // For MIXED, keep manual entry
  };

  // Update paid amount automatically when net changes if mostly cash/credit
  useEffect(() => {
    if (paymentMethod === "CASH" || paymentMethod === "CREDIT") {
      setPaidAmount(totals.net);
    } else if (paymentMethod === "DEFERRED") {
      setPaidAmount(0);
    }
  }, [totals.net, paymentMethod]);

  // Update treasury balance when selected treasury changes
  useEffect(() => {
    if (selectedTreasuryId) {
      const treasury = treasuries.find(
        (t) => t.id === parseInt(selectedTreasuryId),
      );
      if (treasury) {
        setSelectedTreasuryBalance(Number(treasury.balance) || 0);
      }
    }
  }, [selectedTreasuryId, treasuries]);

  const handleSaveNewItem = async (formData) => {
    try {
      await itemService.create(formData);
      setIsItemModalOpen(false);
      toast.success("تم إضافة الصنف بنجاح");
      // Refresh items
      const fetchedItems = await itemService.getAll();
      setAllItems(fetchedItems);
    } catch (error) {
      console.error("Failed to save item", error);
      const errorMessage = error.message || "حدث خطأ أثناء حفظ الصنف";

      if (errorMessage.includes("Item name already exists")) {
        toast.error("اسم الصنف موجود بالفعل، يرجى اختيار اسم آخر");
      } else {
        toast.error(`خطأ: ${errorMessage}`);
      }
    }
  };

  const handleSavePurchase = async () => {
    try {
      if (!selectedSupplierId) {
        toast.error("يرجى اختيار المورد");
        return;
      }
      if (!selectedTreasuryId) {
        toast.error("يرجى اختيار الخزينة");
        return;
      }
      if (!selectedWarehouseId) {
        toast.error("يرجى اختيار المخزن");
        return;
      }
      if (items.length === 0) {
        toast.error("يرجى إضافة أصناف للفاتورة");
        return;
      }

      // Validate that all items have itemId (selected from dropdown)
      const invalidItems = items.filter((item) => !item.itemId);
      if (invalidItems.length > 0) {
        toast.error("يرجى اختيار جميع الأصناف من القائمة");
        return;
      }

      // Validate purchase price > 0 for all items
      const invalidPriceItems = items.filter(
        (item) => Number(item.purchasePrice) <= 0,
      );
      if (invalidPriceItems.length > 0) {
        toast.error("يجب أن يكون سعر الشراء أكبر من 0 لجميع الأصناف");
        return;
      }

      // Validate sell price >= purchase price
      const invalidSellPriceItems = items.filter(
        (item) => Number(item.sellPrice) < Number(item.purchasePrice),
      );
      if (invalidSellPriceItems.length > 0) {
        const itemNames = invalidSellPriceItems
          .map((item) => item.name)
          .join("، ");
        toast.error(
          `عذرًا، لا يمكن أن يكون سعر البيع أقل من سعر الشراء.\nيرجى مراجعة الأسعار للأصناف التالية: ${itemNames}`,
        );
        return;
      }

      const purchaseData = {
        supplierId: parseInt(selectedSupplierId),
        treasuryId: parseInt(selectedTreasuryId),
        warehouseId: parseInt(selectedWarehouseId),
        supplierInvoiceNo,
        paymentMethod, // CASH, CREDIT, DEFERRED, or MIXED
        subtotal: Number(totals.subtotal),
        discountType,
        discountValue: Number(discountValue) || 0,
        discountAmount: Number(totals.discountAmount),
        netTotal: Number(totals.net),
        paidAmount: Number(paidAmount) || 0,
        remaining: Number(totals.remaining),
        items: items.map((item) => ({
          itemId: parseInt(item.itemId),
          quantity: Number(item.quantity),
          purchasePrice: Number(item.purchasePrice),
          sellPrice: Number(item.sellPrice),
          total: Number(item.quantity) * Number(item.purchasePrice),
        })),
      };

      console.log("Sending purchase data:", purchaseData);
      const newPurchase = await purchaseService.create(purchaseData);
      toast.success("تم حفظ فاتورة المشتريات بنجاح");

      // Show Receipt
      setCreatedPurchase(newPurchase);
      setIsReceiptModalOpen(true);

      // Refresh purchases list to update next ID
      const fetchedPurchases = await purchaseService.getAll();
      setPurchases(fetchedPurchases);

      // Reset form
      setItems([
        {
          id: Date.now(),
          name: "",
          itemId: null,
          quantity: 1,
          purchasePrice: 0,
          sellPrice: 0,
        },
      ]);
      setSelectedSupplierId("");
      setSupplierInvoiceNo("");
      setDiscountType("percent");
      setDiscountValue(0);
      setPaidAmount(0);
    } catch (error) {
      console.error("Failed to save purchase", error);

      // Extract error message from response if available
      toast.error(error.message || "حدث خطأ أثناء حفظ الفاتورة");
    }
  };

  const pmLabel = (m) => ({ CASH:"نقدي", CREDIT:"كريدت", DEFERRED:"آجل", MIXED:"متنوع", cash:"نقدي", credit:"كريدت", deferred:"آجل", mixed:"متنوع" })[m] || m;
  const psLabel = (s) => ({ PAID:"مدفوع", PARTIALLY_PAID:"جزئي", UNPAID:"غير مدفوع", RETURNED:"مرتجع" })[s] || s;
  const psClass = (s) => s==="PAID" ? "bg-green-100 text-green-800" : s==="PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" : s==="RETURNED" ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800";
  const filteredHistory = [...purchases].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).filter(p=>{
    if (!historyFilter.trim()) return true;
    const q = historyFilter.toLowerCase();
    return String(p.id).includes(q) || (p.supplier?.name||"").toLowerCase().includes(q) || (p.supplierInvoiceNo||"").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" dir="rtl">
      <PurchaseDetailsModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        purchase={createdPurchase}
      />
      <PurchaseDetailsModal
        isOpen={!!selectedHistoryPurchase}
        onClose={() => setSelectedHistoryPurchase(null)}
        purchase={selectedHistoryPurchase}
      />
      <PurchaseReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
      />
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{direction:"rtl"}}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="bg-blue-600 p-4 rounded-t-2xl text-white flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                سجل المشتريات ({filteredHistory.length})
              </h2>
              <button onClick={()=>setIsHistoryOpen(false)} className="hover:bg-blue-700 p-2 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                <input type="text" value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)}
                  placeholder="فلترة برقم الفاتورة، اسم المورد، أو رقم فاتورة المورد..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-blue-500 text-right text-sm" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm text-right">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 sticky top-0">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المورد</th>
                    <th className="p-3">فاتورة المورد</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">المدفوع</th>
                    <th className="p-3">المتبقي</th>
                    <th className="p-3">الدفع</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredHistory.length === 0
                    ? <tr><td colSpan={10} className="p-8 text-center text-gray-400">لا توجد فواتير</td></tr>
                    : filteredHistory.map(p=>(
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="p-3 font-mono font-bold text-blue-600">#{p.id}</td>
                        <td className="p-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString("ar-EG")}</td>
                        <td className="p-3 font-medium">{p.supplier?.name||"—"}</td>
                        <td className="p-3 text-gray-500">{p.supplierInvoiceNo||"—"}</td>
                        <td className="p-3 font-bold">{parseFloat(p.netTotal).toFixed(2)}</td>
                        <td className="p-3 text-green-600">{parseFloat(p.paidAmount).toFixed(2)}</td>
                        <td className="p-3 text-red-600 font-bold">{parseFloat(p.remaining).toFixed(2)}</td>
                        <td className="p-3">{pmLabel(p.paymentMethod)}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${psClass(p.paymentStatus)}`}>{psLabel(p.paymentStatus)}</span></td>
                        <td className="p-3">
                          <button onClick={()=>setSelectedHistoryPurchase(p)} className="text-blue-600 hover:text-blue-800 transition-colors" title="عرض التفاصيل">
                            <span className="material-symbols-outlined text-xl">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl text-left">
              <button onClick={()=>setIsHistoryOpen(false)} className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-bold text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="إضافة صنف جديد">
        <ItemForm
          data={allItems}
          onClose={() => setIsItemModalOpen(false)}
          onSave={handleSaveNewItem}
          initialData={{
            suppliers: selectedSupplierId ? [parseInt(selectedSupplierId)] : [],
          }}
        />
      </Modal>

      <div className="space-y-6 print:hidden">
        {/* Header / Title Section */}
        <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">receipt_long</span>
            فاتورة مشتريات
          </h2>

          {/* Note: The back button in MainLayout already exists, but this specific back button was requested in the HTML. 
            We can keep it or rely on MainLayout. Since MainLayout has a back button to Dashboard, this might be redundant, 
            but for fidelity to the HTML, I'll keep it as a link to Dashboard. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors shadow-sm font-bold text-sm">
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              <span className="hidden sm:inline">سجل المشتريات</span>
            </button>
            <button
              onClick={() => setIsReturnModalOpen(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors shadow-sm font-bold text-sm">
              <span className="material-symbols-outlined text-sm">assignment_return</span>
              <span className="hidden sm:inline">مرتجع</span>
            </button>
            <button
              onClick={handleHoldPurchase}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition-colors shadow-sm font-bold text-sm">
              <span className="material-symbols-outlined text-sm">pause_circle</span>
              <span className="hidden sm:inline">تعليق</span>
            </button>
            {heldPurchases.length > 0 && (
              <button
                onClick={() => setIsHeldPurchasesOpen(true)}
                className="relative flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors shadow-sm font-bold text-sm">
                <span className="material-symbols-outlined text-sm">inventory</span>
                <span className="hidden sm:inline">معلق </span>({heldPurchases.length})
              </button>
            )}
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 bg-text-light/10 hover:bg-text-light/20 dark:bg-white/10 dark:hover:bg-white/20 text-text-light dark:text-text-dark px-3 py-2 rounded-lg transition-colors shadow-sm text-sm">
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
              <span className="hidden sm:inline">رجوع</span>
            </button>
          </div>
        </div>

        {/* Main Form Section */}
        <section className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
                الـ ID
              </label>
              <input
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 transition-colors"
                readOnly
                type="text"
                value={purchases.length > 0 ? purchases.length + 1 : 1}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
                الخزينه
              </label>
              <div className="relative">
                <select
                  value={selectedTreasuryId}
                  onChange={(e) => setSelectedTreasuryId(e.target.value)}
                  className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 appearance-none transition-colors">
                  <option value="">اختر الخزينة...</option>
                  {treasuries.map((treasury) => (
                    <option key={treasury.id} value={treasury.id}>
                      {treasury.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
                المخزن
              </label>
              <div className="relative">
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 appearance-none transition-colors">
                  <option value="">اختر المخزن...</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute left-3 top-3 text-text-muted pointer-events-none text-sm">
                  expand_more
                </span>
              </div>
            </div>
            <div className="md:col-span-5">
              <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
                رقم فاتورة المورد
              </label>
              <input
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 transition-colors"
                placeholder="مثال: INV-2023-001"
                type="text"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
              اسم المورد
            </label>
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <select
                  className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 appearance-none transition-colors"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}>
                  <option value="">اختر المورد...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute left-3 top-3 text-text-muted pointer-events-none text-sm">
                  expand_more
                </span>
              </div>
              <button
                type="button"
                className={`flex items-center justify-center p-2.5 rounded-lg border transition-colors ${
                  selectedSupplierId
                    ? "bg-white dark:bg-surface-dark border-border-light dark:border-border-dark text-primary hover:bg-primary/10"
                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed"
                }`}
                disabled={!selectedSupplierId}
                onClick={() =>
                  window.open(
                    `/supplier-accounts?supplierId=${selectedSupplierId}`,
                    "_blank",
                  )
                }
                title="عرض حساب المورد">
                <span className="material-symbols-outlined">
                  account_balance_wallet
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Items Section */}
        <section className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
          <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark flex justify-between items-center">
            <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                inventory_2
              </span>
              الأصناف
            </h3>
            <button
              type="button"
              onClick={() => setIsItemModalOpen(true)}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg transition-colors font-bold text-sm">
              <span className="material-symbols-outlined text-[20px]">
                qr_code_scanner
              </span>
              <span>تكويد سريع</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm text-right text-text-muted dark:text-accent">
              <thead className="text-xs text-text-light uppercase bg-accent/20 dark:bg-surface-dark/80 dark:text-text-dark border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="px-6 py-3" scope="col">
                    اسم الصنف
                  </th>
                  <th className="px-6 py-3 w-32" scope="col">
                    الكمية
                  </th>
                  <th className="px-6 py-3 w-40" scope="col">
                    سعر الشراء
                  </th>
                  <th className="px-6 py-3 w-40" scope="col">
                    سعر البيع
                  </th>
                  <th className="px-6 py-3 w-16 text-center" scope="col">
                    حذف
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark/50 border-b border-border-light dark:border-border-dark transition-colors">
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={itemSearches[item.id] ?? item.name ?? ""}
                          onChange={(e) => {
                            setItemSearches((prev) => ({ ...prev, [item.id]: e.target.value }));
                            setOpenItemDropdown(item.id);
                          }}
                          onFocus={() => setOpenItemDropdown(item.id)}
                          onBlur={() => setTimeout(() => setOpenItemDropdown(null), 150)}
                          placeholder="ابحث عن صنف..."
                          className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md focus:ring-1 focus:ring-primary focus:border-primary p-2 pr-8 text-text-light dark:text-text-dark font-bold"
                        />
                        <span className="material-symbols-outlined absolute right-2 top-2.5 text-text-muted pointer-events-none text-base">
                          search
                        </span>
                        {openItemDropdown === item.id && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                            {getAvailableItems(item.id)
                              .filter((ai) =>
                                ai.name.toLowerCase().includes((itemSearches[item.id] || "").toLowerCase())
                              )
                              .slice(0, 40)
                              .map((ai) => (
                                <div
                                  key={ai.id}
                                  onMouseDown={() => handleItemSelect(item.id, ai)}
                                  className="px-3 py-2 cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 last:border-0">
                                  <span className="font-medium text-text-light dark:text-text-dark">{ai.name}</span>
                                  <span className="text-xs text-gray-400 shrink-0 mr-2">
                                    {parseFloat(ai.costPrice) > 0 ? `${parseFloat(ai.costPrice).toFixed(2)} ج.م` : ai.unit}
                                  </span>
                                </div>
                              ))}
                            {getAvailableItems(item.id).filter((ai) =>
                              ai.name.toLowerCase().includes((itemSearches[item.id] || "").toLowerCase())
                            ).length === 0 && (
                              <div className="px-3 py-3 text-center text-gray-400 text-sm">لا توجد نتائج</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <KgQuantityInput
                        value={item.quantity}
                        onChange={(v) => updateItem(item.id, "quantity", v)}
                        unit={item.unit || "piece"}
                        min={0.001}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md focus:ring-1 focus:ring-primary focus:border-primary p-2 text-text-light dark:text-text-dark"
                        placeholder="0.00"
                        type="number"
                        value={item.purchasePrice || ""}
                        onChange={(e) =>
                          updateItem(item.id, "purchasePrice", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md focus:ring-1 focus:ring-primary focus:border-primary p-2 text-text-light dark:text-text-dark text-center"
                        placeholder="0.00"
                        type="number"
                        value={item.sellPrice || ""}
                        onChange={(e) =>
                          updateItem(item.id, "sellPrice", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                        <span className="material-symbols-outlined text-base">
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-background-light dark:bg-background-dark/50 border-t border-border-light dark:border-border-dark">
            <button
              onClick={addItem}
              disabled={!selectedSupplierId}
              className={`w-full py-3 rounded-lg border border-dashed flex justify-center items-center transition-all group ${
                selectedSupplierId
                  ? "bg-white dark:bg-surface-dark hover:bg-accent/20 dark:hover:bg-border-dark text-text-light dark:text-text-dark border-primary/40 dark:border-primary/60 cursor-pointer"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-700 cursor-not-allowed opacity-60"
              }`}>
              <span className="material-symbols-outlined mr-2 group-hover:scale-110 transition-transform text-primary">
                add_circle
              </span>
              <span className="font-medium">إضافة صنف جديد</span>
            </button>
          </div>
        </section>

        {/* Totals & Payment Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
            <div className="flex flex-col gap-6">
              <div className="bg-accent/20 dark:bg-accent/10 border-2 border-accent dark:border-accent/30 p-5 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary text-white p-1.5 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg">
                          local_offer
                        </span>
                      </div>
                      <label className="text-lg font-bold text-primary dark:text-accent">
                        الخصم الإضافي
                      </label>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center bg-white dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark">
                        <input
                          checked={discountType === "percent"}
                          onChange={() => setDiscountType("percent")}
                          className="w-4 h-4 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                          id="discount-percent"
                          name="discount-type"
                          type="radio"
                        />
                        <label
                          className="ms-2 text-sm font-bold text-text-light dark:text-text-dark cursor-pointer"
                          htmlFor="discount-percent">
                          % نسبة
                        </label>
                      </div>
                      <div className="flex items-center bg-white dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark">
                        <input
                          checked={discountType === "value"}
                          onChange={() => setDiscountType("value")}
                          className="w-4 h-4 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                          id="discount-value"
                          name="discount-type"
                          type="radio"
                        />
                        <label
                          className="ms-2 text-sm font-bold text-text-light dark:text-text-dark cursor-pointer"
                          htmlFor="discount-value">
                          قيمة نقدية
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-1/3">
                    <div className="relative">
                      <input
                        value={discountValue || ""}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full bg-white dark:bg-surface-dark border-2 border-primary/20 dark:border-primary/40 text-primary dark:text-accent text-lg rounded-lg focus:ring-primary focus:border-primary block p-2.5 text-center font-bold"
                        placeholder="0"
                        type="number"
                      />
                      <span className="absolute left-3 top-3 text-primary/50 text-sm font-bold pointer-events-none">
                        {discountType === "percent" ? "%" : "EGP"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 px-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-dashed border-border-light dark:border-border-dark pb-2">
                    <label className="text-sm font-medium text-text-muted dark:text-accent w-1/3">
                      إجمالي الفاتورة
                    </label>
                    <input
                      className="w-2/3 bg-background-light dark:bg-background-dark/50 border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg block p-2.5 font-bold"
                      readOnly
                      type="text"
                      value={totals.subtotal.toFixed(2)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-dashed border-border-light dark:border-border-dark pb-2">
                    <label className="text-sm font-medium text-text-muted dark:text-accent w-1/3">
                      بعد الخصم
                    </label>
                    <input
                      className="w-2/3 bg-background-light dark:bg-background-dark/50 border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg block p-2.5 font-bold"
                      readOnly
                      type="text"
                      value={totals.net.toFixed(2)}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-dashed border-border-light dark:border-border-dark pb-2">
                    <label className="text-sm font-medium text-text-muted dark:text-accent w-1/3">
                      إجمالي البيع
                    </label>
                    <input
                      className="w-2/3 bg-background-light dark:bg-background-dark/50 border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg block p-2.5"
                      readOnly
                      type="text"
                      value={totals.totalSell.toFixed(2)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-dashed border-border-light dark:border-border-dark pb-2">
                    <label className="text-sm font-bold text-green-600 dark:text-green-400 w-1/3">
                      المكسب
                    </label>
                    <input
                      className="w-2/3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm rounded-lg block p-2.5 font-bold"
                      readOnly
                      type="text"
                      value={totals.profit.toFixed(2)}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <label className="text-base font-bold text-primary dark:text-accent w-1/3">
                      صافي المستحق
                    </label>
                    <input
                      className="w-2/3 bg-primary/10 dark:bg-primary/20 border-2 border-primary/30 dark:border-primary/50 text-primary dark:text-accent text-lg rounded-lg block p-3 font-bold shadow-sm"
                      readOnly
                      type="text"
                      value={totals.net.toFixed(2)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between relative overflow-hidden group">
            <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-1.5 bg-primary h-full"></div>
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-3">
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    payments
                  </span>
                  طريقة الدفع
                </h3>
                {selectedTreasuryId && (
                  <div className="text-xs text-text-muted dark:text-accent">
                    رصيد: {selectedTreasuryBalance.toFixed(2)} EGP
                  </div>
                )}
              </div>

              {/* Treasury Balance Warning */}
              {selectedTreasuryId &&
                (paymentMethod === "CASH" ||
                  paymentMethod === "CREDIT" ||
                  paymentMethod === "MIXED") &&
                selectedTreasuryBalance <
                  (paymentMethod === "MIXED" ? paidAmount : totals.net) && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        warning
                      </span>
                      رصيد الخزينة غير كافي
                    </p>
                  </div>
                )}

              <div className="space-y-3">
                {/* Cash Payment */}
                <div
                  className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                  onClick={() => handlePaymentMethodChange("CASH")}>
                  <input
                    checked={paymentMethod === "CASH"}
                    onChange={() => handlePaymentMethodChange("CASH")}
                    className="w-5 h-5 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                    id="payment-cash"
                    name="payment-method"
                    type="radio"
                  />
                  <label
                    className="ms-3 text-sm font-bold text-text-light dark:text-text-dark w-full cursor-pointer flex items-center justify-between"
                    htmlFor="payment-cash">
                    <span>نقد (Cash)</span>
                    <span className="material-symbols-outlined text-text-muted text-lg">
                      monetization_on
                    </span>
                  </label>
                </div>

                {/* Card/Credit Payment */}
                <div
                  className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                  onClick={() => handlePaymentMethodChange("CREDIT")}>
                  <input
                    className="w-5 h-5 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                    id="payment-credit"
                    name="payment-method"
                    type="radio"
                    checked={paymentMethod === "CREDIT"}
                    onChange={() => handlePaymentMethodChange("CREDIT")}
                  />
                  <label
                    className="ms-3 text-sm font-bold text-text-light dark:text-text-dark w-full cursor-pointer flex items-center justify-between"
                    htmlFor="payment-credit">
                    <span>كريدت/فيزا (Card)</span>
                    <span className="material-symbols-outlined text-text-muted text-lg">
                      credit_card
                    </span>
                  </label>
                </div>

                {/* Deferred Payment */}
                <div
                  className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                  onClick={() => handlePaymentMethodChange("DEFERRED")}>
                  <input
                    className="w-5 h-5 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                    id="payment-deferred"
                    name="payment-method"
                    type="radio"
                    checked={paymentMethod === "DEFERRED"}
                    onChange={() => handlePaymentMethodChange("DEFERRED")}
                  />
                  <label
                    className="ms-3 text-sm font-bold text-text-light dark:text-text-dark w-full cursor-pointer flex items-center justify-between"
                    htmlFor="payment-deferred">
                    <span>آجل (Deferred)</span>
                    <span className="material-symbols-outlined text-text-muted text-lg">
                      schedule
                    </span>
                  </label>
                </div>

                {/* Mixed Payment */}
                <div
                  className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                  onClick={() => handlePaymentMethodChange("MIXED")}>
                  <input
                    className="w-5 h-5 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                    id="payment-mixed"
                    name="payment-method"
                    type="radio"
                    checked={paymentMethod === "MIXED"}
                    onChange={() => handlePaymentMethodChange("MIXED")}
                  />
                  <label
                    className="ms-3 text-sm font-bold text-text-light dark:text-text-dark w-full cursor-pointer flex items-center justify-between"
                    htmlFor="payment-mixed">
                    <span>متنوع (Mixed)</span>
                    <span className="material-symbols-outlined text-text-muted text-lg">
                      account_balance
                    </span>
                  </label>
                </div>
              </div>

              {/* Conditional mixed payment inputs */}
              {paymentMethod === "MIXED" && (
                <div className="space-y-4 pt-4 border-t border-dashed border-border-light dark:border-border-dark animate-fade-in bg-background-light/50 dark:bg-background-dark/30 -mx-6 px-6 pb-2">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
                      مدفوع
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
                        placeholder="0.00"
                        type="number"
                        min="0"
                        max={totals.net}
                        value={paidAmount}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Math.min(totals.net, Number(e.target.value)),
                          );
                          setPaidAmount(val);
                        }}
                      />
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted text-sm pointer-events-none">
                        attach_money
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
                      متبقي
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg block p-2.5 font-bold"
                        placeholder="0.00"
                        type="number"
                        min="0"
                        max={totals.net}
                        value={(totals.net - Number(paidAmount)).toFixed(2)}
                        onChange={(e) => {
                          const remaining = Math.max(
                            0,
                            Math.min(totals.net, Number(e.target.value)),
                          );
                          setPaidAmount(totals.net - remaining);
                        }}
                      />
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-red-400 text-sm pointer-events-none">
                        money_off
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-border-light dark:border-border-dark">
              <button
                onClick={handleSavePurchase}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary/30 transform hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2">
                <span className="material-symbols-outlined">print</span>
                <span>حفظ وطباعة</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* P5: Held Purchases Modal */}
      {isHeldPurchasesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="bg-yellow-500 p-4 rounded-t-2xl text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">inventory</span>
                فواتير المشتريات المعلقة
              </h2>
              <button onClick={() => setIsHeldPurchasesOpen(false)} className="hover:bg-yellow-600 p-1.5 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {heldPurchases.length === 0 ? (
                <p className="text-center text-gray-400 py-6">لا توجد فواتير معلقة</p>
              ) : (
                heldPurchases.map((h) => (
                  <div key={h.id} className="bg-gray-50 dark:bg-zinc-800 p-3 rounded-xl border border-gray-200 dark:border-zinc-700 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-gray-800 dark:text-gray-200">{h.supplierName || "مورد"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{h.timestamp} · {h.items.length} أصناف</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{h.total} ج.م</span>
                      <button
                        onClick={() => handleRetrievePurchase(h.id)}
                        className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all">
                        استرجاع
                      </button>
                      <button
                        onClick={() => handleDeleteHeldPurchase(h.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1.5 rounded-lg text-sm transition-all">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-orange-500 p-4 text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h2 className="text-lg font-bold">فاتورة غير محفوظة</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                يوجد فاتورة مشتريات قيد الإنشاء. هل تريد تعليقها للرجوع إليها لاحقًا أو الخروج بدون حفظ؟
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleHoldAndLeave}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-bold transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-lg">pause_circle</span>
                  <span>تعليق الفاتورة والخروج</span>
                </button>
                <button
                  onClick={handleDiscardAndLeave}
                  className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-lg">delete</span>
                  <span>خروج بدون حفظ</span>
                </button>
                <button
                  onClick={() => blocker.reset?.()}
                  className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold transition-colors">
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  <span>البقاء في الصفحة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;
