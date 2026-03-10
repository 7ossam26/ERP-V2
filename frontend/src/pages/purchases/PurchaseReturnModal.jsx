import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { purchaseService } from "../../services/domainServices";
import ManagerAuthModal from "../../components/common/ManagerAuthModal";

const PurchaseReturnModal = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [purchase, setPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNote, setReturnNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setPurchase(null);
      setReturnItems([]);
      setReturnNote("");
    }
  }, [isOpen]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchResults([]);
    setPurchase(null);
    try {
      const results = await purchaseService.search(searchQuery.trim());
      if (!results || results.length === 0) {
        toast.error("لم يتم العثور على فواتير مطابقة");
      } else if (results.length === 1) {
        selectPurchase(results[0]);
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      toast.error(err.message || "حدث خطأ أثناء البحث");
    } finally {
      setLoading(false);
    }
  };

  const selectPurchase = (p) => {
    setPurchase(p);
    setSearchResults([]);
    // Calculate already-returned quantities per item
    const alreadyReturned = {};
    if (p.returns) {
      for (const ret of p.returns) {
        // returns won't include items here (toFrontend strips them)
        // so we just initialise to 0; backend enforces the limit anyway
      }
    }
    setReturnItems(
      p.items.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        maxQty: parseFloat(i.quantity),
        purchasePrice: parseFloat(i.purchasePrice),
        quantity: 0,
        total: 0,
      }))
    );
  };

  const handleQtyChange = (itemId, val) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        const qty = Math.min(Math.max(0, parseFloat(val) || 0), item.maxQty);
        return { ...item, quantity: qty, total: qty * item.purchasePrice };
      })
    );
  };

  const totalReturn = returnItems.reduce((s, i) => s + i.total, 0);

  const initiateReturn = () => {
    if (returnItems.every((i) => i.quantity === 0)) {
      toast.error("يرجى إدخال كمية الإرجاع لصنف واحد على الأقل");
      return;
    }
    setIsAuthOpen(true);
  };

  const handleAuthVerified = async (username, password) => {
    setIsAuthOpen(false);
    setLoading(true);
    try {
      await purchaseService.returnPurchase(purchase.id, {
        items: returnItems
          .filter((i) => i.quantity > 0)
          .map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
        managerUsername: username,
        managerPassword: password,
        notes: returnNote,
      });
      toast.success("تم تسجيل المرتجع بنجاح");
      onClose();
    } catch (err) {
      toast.error(err.message || "فشل تسجيل المرتجع");
    } finally {
      setLoading(false);
    }
  };

  const paymentMethodLabel = (method) => {
    const map = { cash: "نقدي", credit: "كريدت", deferred: "آجل", mixed: "متنوع" };
    return map[method] || method;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      style={{ direction: "rtl" }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700">

        {/* Header */}
        <div className="bg-orange-600 p-4 rounded-t-2xl text-white flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="material-icons-round">assignment_return</span>
            مرتجع مشتريات
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-orange-700 p-2 rounded-full transition-colors">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الفاتورة، رقم فاتورة المورد، أو اسم المورد..."
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-orange-500 text-right"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 flex items-center gap-2 flex-shrink-0">
              <span className="material-icons-round text-sm">search</span>
              بحث
            </button>
          </form>

          {/* Search results list */}
          {searchResults.length > 0 && !purchase && (
            <div className="space-y-2">
              <p className="font-bold text-gray-600 dark:text-gray-300 text-sm">نتائج البحث:</p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">المورد</th>
                      <th className="p-3">فاتورة المورد</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchResults.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="p-3 font-mono">{p.id}</td>
                        <td className="p-3 font-medium">{p.supplier?.name || "—"}</td>
                        <td className="p-3 text-gray-500">{p.supplierInvoiceNo || "—"}</td>
                        <td className="p-3">{new Date(p.createdAt).toLocaleDateString("ar-EG")}</td>
                        <td className="p-3 font-bold">{parseFloat(p.netTotal).toFixed(2)}</td>
                        <td className="p-3">{paymentMethodLabel(p.paymentMethod)}</td>
                        <td className="p-3">
                          <button
                            onClick={() => selectPurchase(p)}
                            className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1 rounded-lg text-xs font-bold">
                            اختيار
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Purchase details + return items */}
          {purchase && (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">المورد</span>
                  <strong>{purchase.supplier?.name || "—"}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">رقم فاتورة المورد</span>
                  <strong>{purchase.supplierInvoiceNo || "—"}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">طريقة الدفع</span>
                  <strong>{paymentMethodLabel(purchase.paymentMethod)}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">إجمالي الفاتورة</span>
                  <strong>{parseFloat(purchase.netTotal).toFixed(2)} ج.م</strong>
                </div>
              </div>

              {/* Items table */}
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="p-3 rounded-r-lg">الصنف</th>
                    <th className="p-3">سعر الشراء</th>
                    <th className="p-3">الكمية المشتراة</th>
                    <th className="p-3">كمية الإرجاع</th>
                    <th className="p-3 rounded-l-lg">إجمالي الإرجاع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {returnItems.map((item) => (
                    <tr
                      key={item.itemId}
                      className={item.quantity > 0 ? "bg-orange-50 dark:bg-orange-900/10" : ""}>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{item.purchasePrice.toFixed(2)}</td>
                      <td className="p-3">{item.maxQty}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleQtyChange(item.itemId, e.target.value)}
                          className="w-24 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-center focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-900"
                        />
                      </td>
                      <td className="p-3 font-bold text-orange-600">
                        {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Notes */}
              <div className="flex items-center gap-3">
                <label className="font-bold text-sm whitespace-nowrap">ملاحظات الإرجاع:</label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="سبب الإرجاع..."
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-orange-500 outline-none bg-white dark:bg-gray-900 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl flex justify-between items-center">
          <div>
            <span className="text-gray-500 text-sm ml-2">إجمالي المرتجع:</span>
            <span className="font-bold text-2xl text-orange-600">
              {totalReturn.toFixed(2)} ج.م
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold">
              إلغاء
            </button>
            <button
              onClick={initiateReturn}
              disabled={!purchase || totalReturn === 0 || loading}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold shadow-lg flex items-center gap-2">
              <span className="material-icons-round text-sm">assignment_return</span>
              تنفيذ الإرجاع
            </button>
          </div>
        </div>
      </div>

      <ManagerAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onVerify={handleAuthVerified}
        title="تأكيد مرتجع المشتريات"
        message="عملية الإرجاع تتطلب موافقة المدير. يرجى إدخال بيانات المدير."
        actionLabel="تأكيد الإرجاع"
      />
    </div>,
    document.body
  );
};

export default PurchaseReturnModal;
