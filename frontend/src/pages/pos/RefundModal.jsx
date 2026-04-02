import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaSearch, FaRedo, FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import { salesService } from "../../services/domainServices";
import toast from "react-hot-toast";
import ManagerAuthModal from "../../components/common/ManagerAuthModal";

const RefundModal = ({ isOpen, onClose, branchId, initialSaleId = null, shiftId = null }) => {
  const [searchSaleId, setSearchSaleId] = useState("");
  const [saleData, setSaleData] = useState(null);
  const [refundItems, setRefundItems] = useState([]); // { itemId, quantity, maxQty, name, price }
  const [loading, setLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [refundNote, setRefundNote] = useState("");
  const [searchResults, setSearchResults] = useState([]); // List of found sales for selection
  const [shiftRefunds, setShiftRefunds] = useState([]); // Returns made in this shift
  const [recentSales, setRecentSales] = useState([]); // S8: auto-loaded recent sales

  // Effect to auto-load if saleId provided, and load shift refunds + recent sales
  useEffect(() => {
    if (isOpen && initialSaleId) {
      setSearchSaleId(initialSaleId);
      fetchSpecificSale(initialSaleId);
    } else if (isOpen) {
      setSearchSaleId("");
      setSaleData(null);
      setRefundItems([]);
      setRefundNote("");
      setSearchResults([]);
      // S8: Load recent sales automatically
      salesService.getRecent(50)
        .then(setRecentSales)
        .catch(() => setRecentSales([]));
    }
    if (isOpen && shiftId) {
      salesService.getShiftRefunds(shiftId)
        .then(setShiftRefunds)
        .catch(() => setShiftRefunds([]));
    } else {
      setShiftRefunds([]);
    }
  }, [isOpen, initialSaleId, shiftId]);

  const fetchSpecificSale = async (idOrNumber) => {
    setLoading(true);
    try {
      const sale = await salesService.getBySaleNumber(idOrNumber);
      if (sale) {
        selectSale(sale);
      }
    } catch (error) {
      // Silent fail or minimal log, specific fetch might fail if ID is partial
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchSaleId) return;

    setLoading(true);
    setSearchResults([]);
    setSaleData(null);

    try {
      const results = await salesService.search(searchSaleId);

      if (results && results.length > 0) {
        if (results.length === 1) {
          // If only one match, select it immediately
          selectSale(results[0]);
        } else {
          // Multiple matches, show list
          setSearchResults(results);
        }
      } else {
        toast.error("لم يتم العثور على أي فواتير مطابقة");
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(error.message || "حدث خطأ أثناء البحث");
    } finally {
      setLoading(false);
    }
  };

  const selectSale = (sale) => {
    setSaleData(sale);
    setSearchResults([]); // Clear list
    initializeRefundItems(sale);
  };

  const initializeRefundItems = (sale) => {
    // Initialize refund items with 0 quantity
    const items = sale.items.map((i) => ({
      itemId: i.itemId,
      name: i.item.name,
      unit: i.item.unit,
      quantity: 0,
      maxQty: parseFloat(i.quantity),
      unitPrice: parseFloat(i.unitPrice),
      total: 0,
    }));
    setRefundItems(items);
  };

  const handleQuantityChange = (itemId, qty) => {
    setRefundItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          const newQty = Math.min(
            Math.max(0, parseFloat(qty) || 0),
            item.maxQty,
          );
          return {
            ...item,
            quantity: newQty,
            total: newQty * item.unitPrice,
          };
        }
        return item;
      }),
    );
  };

  const calculateTotalRefund = () => {
    return refundItems.reduce((sum, item) => sum + item.total, 0);
  };

  const handleVerificationSuccess = async (username, password) => {
    setIsAuthOpen(false);
    setLoading(true);

    const itemsToReturn = refundItems
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
      }));

    const refundPayload = {
      saleId: saleData.id,
      items: itemsToReturn,
      managerUsername: username,
      managerPassword: password,
      notes: refundNote,
    };

    try {
      await salesService.refund(refundPayload);
      toast.success("تم استرجاع الأصناف بنجاح");
      if (shiftId) {
        salesService.getShiftRefunds(shiftId).then(setShiftRefunds).catch(() => {});
      }
      onClose();
      // TODO: Refresh dashboard/sales list if needed?
    } catch (error) {
      console.error("Refund failed:", error);
      toast.error(error.message || "فشل عملية الاسترجاع");
    } finally {
      setLoading(false);
    }
  };

  const initiateRefund = () => {
    const totalQty = refundItems.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQty === 0) {
      toast.error("يرجى اختيار صنف واحد على الأقل للاسترجاع");
      return;
    }
    setIsAuthOpen(true);
  };

  if (!isOpen) return null;

  const totalRefund = calculateTotalRefund();
  // Assuming tax rate is consistent, we might approximate tax refund
  // Ideally backend handles exact math. We just show approximate here.
  const taxRate = saleData ? parseFloat(saleData.taxRate) : 0.14;
  const totalWithTax = totalRefund * (1 + taxRate); // Approximate

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-right"
      style={{ direction: "rtl" }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="bg-red-600 p-4 rounded-t-2xl text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaRedo /> استرجاع فاتورة (مرتجع)
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-red-700 p-2 rounded-full transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Shift Refunds History */}
          {shiftRefunds.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-2">
                مرتجعات الوردية الحالية ({shiftRefunds.length})
              </h3>
              <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-red-100 dark:bg-red-900/30">
                    <tr>
                      <th className="p-2">رقم المرتجع</th>
                      <th className="p-2">العميل</th>
                      <th className="p-2">الوقت</th>
                      <th className="p-2 text-left">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 dark:divide-red-900/20">
                    {shiftRefunds.map((r) => (
                      <tr key={r.id} className="hover:bg-red-100/50 dark:hover:bg-red-900/20">
                        <td className="p-2 font-mono text-xs">{r.saleNumber}</td>
                        <td className="p-2">{r.client?.name || "عميل نقدي"}</td>
                        <td className="p-2 text-xs text-gray-500">
                          {new Date(r.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-2 text-left font-bold text-red-600">
                          {Math.abs(parseFloat(r.total)).toFixed(2)} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Search Section */}
          <form onSubmit={(e) => handleSearch(e)} className="flex gap-2">
            <input
              type="text"
              value={searchSaleId}
              onChange={(e) => {
                setSearchSaleId(e.target.value);
                // Filter recent sales as user types
                if (e.target.value.trim()) {
                  const q = e.target.value.trim().toLowerCase();
                  setSearchResults(recentSales.filter(s =>
                    s.saleNumber?.toLowerCase().includes(q) ||
                    s.client?.name?.toLowerCase().includes(q) ||
                    s.client?.phoneNumber?.includes(q)
                  ));
                } else {
                  setSearchResults([]);
                  setSaleData(null);
                }
              }}
              placeholder="بحث برقم الفاتورة، اسم العميل، أو رقم الهاتف..."
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-red-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2">
              <FaSearch /> بحث
            </button>
          </form>

          {/* S8: Recent sales list (shown when no search query and no sale selected) */}
          {!saleData && !searchSaleId && recentSales.length > 0 && searchResults.length === 0 && (
            <div>
              <h3 className="font-bold text-gray-600 dark:text-gray-400 text-sm mb-2">آخر الفواتير</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 sticky top-0">
                    <tr>
                      <th className="p-2">رقم الفاتورة</th>
                      <th className="p-2">العميل</th>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">الإجمالي</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-2 font-mono text-xs">{sale.saleNumber}</td>
                        <td className="p-2">{sale.client?.name || "عميل نقدي"}</td>
                        <td className="p-2 text-xs text-gray-400">{new Date(sale.createdAt).toLocaleDateString("ar-EG")}</td>
                        <td className="p-2 font-bold">{parseFloat(sale.total).toFixed(2)}</td>
                        <td className="p-2">
                          <button
                            onClick={() => selectSale(sale)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded text-xs font-bold">
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
          {/* Search Results List */}
          {searchResults.length > 0 && !saleData && (
            <div className="animate-fade-in space-y-2">
              <h3 className="font-bold text-gray-700 dark:text-gray-300">نتائج البحث:</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-900">
                    <tr>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchResults.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-3 font-medium">{sale.saleNumber}</td>
                        <td className="p-3">{sale.client?.name || "عميل نقدى"}</td>
                        <td className="p-3">{new Date(sale.createdAt).toLocaleDateString("ar-EG")}</td>
                        <td className="p-3 font-bold">{parseFloat(sale.total).toFixed(2)}</td>
                        <td className="p-3">
                          <button
                            onClick={() => selectSale(sale)}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                          >
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

          {/* Sale Details */}
          {saleData && (
            <div className="animate-fade-in space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl flex justify-between text-sm">
                <div>
                  <span className="text-gray-500 block">العميل</span>
                  <strong>{saleData.client?.name || "عميل نقدى"}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">التاريخ</span>
                  <strong>
                    {new Date(saleData.createdAt).toLocaleDateString("ar-EG")}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500 block">الإجمالي الأصلي</span>
                  <strong>{parseFloat(saleData.total).toFixed(2)}</strong>
                </div>
              </div>

              <table className="w-full text-sm text-right">
                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="p-3 rounded-r-lg">الصنف</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3">الكمية الأصلية</th>
                    <th className="p-3">كمية الارجاع</th>
                    <th className="p-3 rounded-l-lg">إجمالي الارجاع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {refundItems.map((item) => (
                    <tr
                      key={item.itemId}
                      className={
                        item.quantity > 0 ? "bg-red-50 dark:bg-red-900/10" : ""
                      }>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{item.unitPrice.toFixed(2)}</td>
                      <td className="p-3">{item.maxQty}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          step={item.unit === "kg" ? "0.1" : "1"}
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(item.itemId, e.target.value)
                          }
                          className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-center focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </td>
                      <td className="p-3 font-bold text-red-600">
                        {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex gap-4 items-center">
                <label className="whitespace-nowrap font-bold">
                  ملاحظات الاسترجاع:
                </label>
                <input
                  type="text"
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="سبب الاسترجاع..."
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-red-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl flex justify-between items-center">
          <div className="text-lg">
            <span className="text-gray-500 ml-2">
              إجمالي الاسترجاع (تقريبي مع الضريبة):
            </span>
            <span className="font-bold text-2xl text-red-600">
              {totalWithTax.toFixed(2)} ج.م
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold">
              إلغاء
            </button>
            <button
              onClick={initiateRefund}
              disabled={!saleData || calculateTotalRefund() === 0}
              className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold shadow-lg flex items-center gap-2">
              <FaRedo /> تنفيذ الاسترجاع
            </button>
          </div>
        </div>

        {/* Manager Auth Modal */}
        <ManagerAuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onVerify={handleVerificationSuccess}
          branchId={branchId}
          title="تأكيد الاسترجاع"
          message="عملية الاسترجاع تتطلب موافقة المدير. يرجى إدخال البيانات."
          actionLabel="تأكيد الاسترجاع"
        />
      </div>
    </div>,
    document.body,
  );
};

export default RefundModal;
