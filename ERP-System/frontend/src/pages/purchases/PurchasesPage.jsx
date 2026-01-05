import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { supplierService, itemService } from "../../services/domainServices";
import Modal from "../../components/ui/Modal";
import { ItemForm } from "../items/ItemManager";

const PurchasesPage = () => {
  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash, credit, mixed
  const [items, setItems] = useState([
    { id: 1, name: "بن برازيلي", quantity: 5, purchasePrice: 0, sellPrice: 0 },
    { id: 2, name: "بن كولومبي", quantity: 10, purchasePrice: 0, sellPrice: 0 },
  ]);
  const [discountType, setDiscountType] = useState("percent"); // percent, value

  const [discountValue, setDiscountValue] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const fetchedSuppliers = await supplierService.getAll();
        setSuppliers(fetchedSuppliers);
      } catch (error) {
        console.error("Failed to fetch suppliers", error);
      }
    };
    fetchSuppliers();
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
      0
    );
    const totalSell = items.reduce(
      (sum, item) =>
        sum + (Number(item.quantity) * Number(item.sellPrice) || 0),
      0
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

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      name: "",
      quantity: 1,
      purchasePrice: 0,
      sellPrice: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    // Reset paid amount logic based on method if needed, usually managed manually
    if (method === "cash") {
      setPaidAmount(totals.net);
    } else if (method === "credit") {
      setPaidAmount(0);
    }
  };

  // Update paid amount automatically when net changes if mostly cash/credit
  useEffect(() => {
    if (paymentMethod === "cash") {
      setPaidAmount(totals.net);
    } else if (paymentMethod === "credit") {
      setPaidAmount(0);
    }
  }, [totals.net, paymentMethod]);

  const handleSaveNewItem = async (formData) => {
    try {
      await itemService.create(formData);
      setIsItemModalOpen(false);
      toast.success("تم إضافة الصنف بنجاح");
    } catch (error) {
      console.error("Failed to save item", error);
      toast.error("حدث خطأ أثناء حفظ الصنف");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="إضافة صنف جديد">
        <ItemForm
          onClose={() => setIsItemModalOpen(false)}
          onSave={handleSaveNewItem}
          initialData={{
            suppliers: selectedSupplierId ? [selectedSupplierId] : [],
          }}
        />
      </Modal>

      {/* Header / Title Section */}
      <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">receipt_long</span>
          فاتورة مشتريات
        </h2>

        {/* Note: The back button in MainLayout already exists, but this specific back button was requested in the HTML. 
            We can keep it or rely on MainLayout. Since MainLayout has a back button to Dashboard, this might be redundant, 
            but for fidelity to the HTML, I'll keep it as a link to Dashboard. */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 bg-text-light/10 hover:bg-text-light/20 dark:bg-white/10 dark:hover:bg-white/20 text-text-light dark:text-text-dark px-6 py-2 rounded-lg transition-colors shadow-sm">
          <span className="material-symbols-outlined text-sm">
            arrow_forward
          </span>
          <span>رجوع</span>
        </Link>
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
              value="1024"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
              الخزينه
            </label>
            <div className="relative">
              <select
                disabled
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 appearance-none transition-colors opacity-70 cursor-not-allowed">
                <option>الرئيسي</option>
                <option>الفرعي</option>
              </select>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
              المخزن
            </label>
            <div className="relative">
              <select
                disabled
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 appearance-none transition-colors opacity-70 cursor-not-allowed">
                <option>الرئيسي</option>
                <option>المخزن 1</option>
              </select>
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
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
              اسم المورد
            </label>
            <div className="relative">
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
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted dark:text-accent">
              كشف حساب المورد
            </label>
            <div className="relative">
              <input
                className="w-full bg-accent/20 dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg block p-2.5 font-semibold text-center opacity-80 cursor-not-allowed"
                disabled
                type="text"
                value="50,000 جنيه مصري"
                readOnly
              />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-primary pointer-events-none text-lg">
                account_balance_wallet
              </span>
            </div>
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
          <table className="w-full text-sm text-right text-text-muted dark:text-accent">
            <thead className="text-xs text-text-light uppercase bg-accent/20 dark:bg-surface-dark/80 dark:text-text-dark border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-6 py-3" scope="col">
                  اسم الصنف
                </th>
                <th className="px-6 py-3 w-32" scope="col">
                  قطعه / كيلو
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
                        list="products-list"
                        type="text"
                        placeholder="بحث عن صنف..."
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, "name", e.target.value)
                        }
                        className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md focus:ring-1 focus:ring-primary focus:border-primary p-2 pl-8 text-text-light dark:text-text-dark placeholder-gray-400 font-bold"
                      />
                      <span className="material-symbols-outlined absolute left-2 top-2.5 text-text-muted pointer-events-none text-base">
                        search
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md focus:ring-1 focus:ring-primary focus:border-primary p-2 text-center text-text-light dark:text-text-dark"
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", e.target.value)
                      }
                      min="1"
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
                      className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md focus:ring-1 focus:ring-primary focus:border-primary p-2 text-text-light dark:text-text-dark"
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
            <datalist id="products-list">
              <option value="بن برازيلي"></option>
              <option value="بن كولومبي"></option>
              <option value="بن يمني"></option>
              <option value="بن إثيوبي"></option>
              <option value="هيل"></option>
              <option value="تحويجة"></option>
              <option value="بن محوج فاتح"></option>
              <option value="بن محوج غامق"></option>
            </datalist>
          </table>
        </div>
        <div className="p-3 bg-background-light dark:bg-background-dark/50 border-t border-border-light dark:border-border-dark">
          <button
            onClick={addItem}
            className="w-full py-3 bg-white dark:bg-surface-dark hover:bg-accent/20 dark:hover:bg-border-dark text-text-light dark:text-text-dark rounded-lg border border-dashed border-primary/40 dark:border-primary/60 flex justify-center items-center transition-all group">
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
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark border-b border-border-light dark:border-border-dark pb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                payments
              </span>
              طريقة الدفع
            </h3>
            <div className="space-y-4">
              <div
                className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                onClick={() => handlePaymentMethodChange("cash")}>
                <input
                  checked={paymentMethod === "cash"}
                  onChange={() => handlePaymentMethodChange("cash")}
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
              <div
                className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                onClick={() => handlePaymentMethodChange("credit")}>
                <input
                  className="w-5 h-5 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                  id="payment-credit"
                  name="payment-method"
                  type="radio"
                  checked={paymentMethod === "credit"}
                  onChange={() => handlePaymentMethodChange("credit")}
                />
                <label
                  className="ms-3 text-sm font-bold text-text-light dark:text-text-dark w-full cursor-pointer flex items-center justify-between"
                  htmlFor="payment-credit">
                  <span>الآجل (Credit)</span>
                  <span className="material-symbols-outlined text-text-muted text-lg">
                    credit_score
                  </span>
                </label>
              </div>
              <div
                className="flex items-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                onClick={() => handlePaymentMethodChange("mixed")}>
                <input
                  className="w-5 h-5 text-primary bg-background-light border-border-dark/30 focus:ring-primary dark:ring-offset-surface-dark focus:ring-2 dark:bg-background-dark dark:border-border-dark cursor-pointer"
                  id="payment-misc"
                  name="payment-method"
                  type="radio"
                  checked={paymentMethod === "mixed"}
                  onChange={() => handlePaymentMethodChange("mixed")}
                />
                <label
                  className="ms-3 text-sm font-bold text-text-light dark:text-text-dark w-full cursor-pointer flex items-center justify-between"
                  htmlFor="payment-misc">
                  <span>متنوع (Mixed)</span>
                  <span className="material-symbols-outlined text-text-muted text-lg">
                    account_balance
                  </span>
                </label>
              </div>
            </div>

            {/* Conditional mixed payment inputs */}
            {paymentMethod === "mixed" && (
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
                          Math.min(totals.net, Number(e.target.value))
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
                          Math.min(totals.net, Number(e.target.value))
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
            <button className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary/30 transform hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2">
              <span className="material-symbols-outlined">print</span>
              <span>حفظ وطباعة</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PurchasesPage;
