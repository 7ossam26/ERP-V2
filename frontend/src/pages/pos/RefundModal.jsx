import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaSearch, FaRedo, FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import { salesService } from "../../services/domainServices";
import toast from "react-hot-toast";
import ManagerAuthModal from "../../components/common/ManagerAuthModal";

const RefundModal = ({ isOpen, onClose, branchId, initialSaleId = null }) => {
  const [searchSaleId, setSearchSaleId] = useState("");
  const [saleData, setSaleData] = useState(null);
  const [refundItems, setRefundItems] = useState([]); // { itemId, quantity, maxQty, name, price }
  const [loading, setLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [refundNote, setRefundNote] = useState("");

  // Effect to auto-load if saleId provided
  useEffect(() => {
    if (isOpen && initialSaleId) {
      setSearchSaleId(initialSaleId);
      handleSearch(null, initialSaleId);
    } else if (isOpen) {
      // Reset state
      setSearchSaleId("");
      setSaleData(null);
      setRefundItems([]);
      setRefundNote("");
    }
  }, [isOpen, initialSaleId]);

  const handleSearch = async (e, idOverride) => {
    if (e) e.preventDefault();
    const saleNumber = idOverride || searchSaleId;

    if (!saleNumber) return;

    setLoading(true);
    try {
      // Fetch sale details by sale number
      // Accept formats like "SALE-202602-00004" or just "202602-00004" or "4"
      let formattedSaleNumber = saleNumber.toString().trim();

      // If user entered just a number, try to format it as SALE-number
      if (/^\d+$/.test(formattedSaleNumber)) {
        // Check if it looks like a full sale number without prefix
        // or just a sequence number
        const sale = await salesService.getBySaleNumber(
          `SALE-${formattedSaleNumber}`,
        );
        if (sale) {
          setSaleData(sale);
          initializeRefundItems(sale);
          return;
        }
      }

      // Otherwise use as-is
      const sale = await salesService.getBySaleNumber(formattedSaleNumber);

      if (sale) {
        setSaleData(sale);
        initializeRefundItems(sale);
      }
    } catch (error) {
      console.error("Fetch sale failed:", error);
      toast.error("لم يتم العثور على الفاتورة");
      setSaleData(null);
      setRefundItems([]);
    } finally {
      setLoading(false);
    }
  };

  const initializeRefundItems = (sale) => {
    // Initialize refund items with 0 quantity
    const items = sale.items.map((i) => ({
      itemId: i.itemId,
      name: i.item.name,
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
      onClose();
      // TODO: Refresh dashboard/sales list if needed?
    } catch (error) {
      console.error("Refund failed:", error);
      const msg = error.response?.data?.error || "فشل عملية الاسترجاع";
      toast.error(msg);
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
          {/* Search Section */}
          <form onSubmit={(e) => handleSearch(e)} className="flex gap-2">
            <input
              type="text"
              value={searchSaleId}
              onChange={(e) => setSearchSaleId(e.target.value)}
              placeholder="أدخل رقم الفاتورة (مثال: 12345)"
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
                          step="0.01"
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
