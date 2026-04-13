import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import AuthService from "../../../services/authService";
import { settingsService, purchaseService } from "../../../services/domainServices";
import ManagerAuthModal from "../../../components/common/ManagerAuthModal";

const PurchaseDetailsModal = ({ isOpen, onClose, purchase, onPurchaseCancelled }) => {
  const [settings, setSettings] = useState(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsService.get();
        setSettings(data);
      } catch (error) {
        console.error("Failed to fetch settings for invoice print", error);
      }
    };
    if (isOpen) {
      fetchSettings();
    } else {
      setIsCancelConfirmOpen(false);
      setIsAuthOpen(false);
      setCancelNote("");
    }
  }, [isOpen]);

  if (!purchase) return null;

  const getPaymentMethodLabel = (method) => {
    if (!method) return "-";
    const upperMethod = method.toUpperCase();
    const methods = {
      CASH: "نقدي",
      CREDIT: "بطاقة ائتمان",
      DEFERRED: "آجل",
      MIXED: "متنوع",
    };
    return methods[upperMethod] || method;
  };

  const isCancelled = purchase.paymentStatus === "CANCELLED";
  const canCancel = !isCancelled && purchase.paymentStatus !== "RETURNED";

  const handleAuthVerified = async (username, password) => {
    setIsAuthOpen(false);
    setCancelling(true);
    try {
      await purchaseService.cancelPurchase(purchase.id, {
        managerUsername: username,
        managerPassword: password,
        notes: cancelNote,
      });
      toast.success("تم إلغاء الفاتورة بالكامل");
      setCancelNote("");
      if (onPurchaseCancelled) onPurchaseCancelled(purchase.id);
      onClose();
    } catch (err) {
      toast.error(err.message || "فشل إلغاء الفاتورة");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      {isOpen && (
        <>
          {/* Print Only Section */}
          <div
            className="hidden print:block print:w-full p-8 bg-white text-black"
            dir="rtl">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-4">
                <img
                  src="/assets/logo.png"
                  alt="Company Logo"
                  className="h-24 w-auto object-contain"
                  onError={(e) => (e.target.style.display = "none")}
                />
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {settings?.companyName || "اسم الشركة"}
                  </h2>
                  {settings?.taxNumber && (
                    <p className="text-sm text-gray-700 font-medium">
                      الرقم الضريبي: {settings.taxNumber}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">تقرير تفصيلي</p>
                </div>
              </div>

              <div className="text-left">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  فاتورة مشتريات
                </h1>
                <div className="text-sm space-y-1 text-gray-600 font-medium">
                  <p>
                    <span className="font-bold text-gray-900">رقم الفاتورة:</span>{" "}
                    #{purchase.id}
                  </p>
                  <p>
                    <span className="font-bold text-gray-900">التاريخ:</span>{" "}
                    {new Date(purchase.createdAt).toLocaleString("ar-EG")}
                  </p>
                  <p>
                    <span className="font-bold text-gray-900">طبع بواسطة:</span>{" "}
                    {AuthService.getCurrentUser()?.name || "مسؤول النظام"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm border-b-2 border-black pb-4">
              <div>
                <p><strong>المورد:</strong> {purchase.supplier?.name || "-"}</p>
                <p><strong>المخزن:</strong> {purchase.warehouse?.name || "-"}</p>
              </div>
              <div className="text-left">
                {purchase.supplierInvoiceNo && (
                  <p>
                    <strong>رقم فاتورة المورد:</strong>{" "}
                    {purchase.supplierInvoiceNo}
                  </p>
                )}
                <p>
                  <strong>طريقة الدفع:</strong>{" "}
                  {getPaymentMethodLabel(purchase.paymentMethod)}
                </p>
              </div>
            </div>

            <table className="w-full text-right border-collapse text-sm mb-6">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 px-2 font-bold w-[5%]">#</th>
                  <th className="py-2 px-2 font-bold w-[40%]">الصنف</th>
                  <th className="py-2 px-2 font-bold w-[15%] text-center">الكمية</th>
                  <th className="py-2 px-2 font-bold w-[20%] text-center">السعر</th>
                  <th className="py-2 px-2 font-bold w-[20%] text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 px-2">{index + 1}</td>
                    <td className="py-2 px-2">{item.name || item.item?.name}</td>
                    <td className="py-2 px-2 text-center font-numbers">
                      {Number(item.quantity).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center font-numbers">
                      {Number(item.purchasePrice).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-left font-bold font-numbers">
                      {Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-1/3 border-t-2 border-black pt-2 text-sm text-left">
                <div className="flex justify-between mb-1">
                  <span>المجموع الفرعي:</span>
                  <span className="font-numbers">{Number(purchase.subtotal).toFixed(2)}</span>
                </div>
                {purchase.discountAmount > 0 && (
                  <div className="flex justify-between mb-1 text-red-600">
                    <span>الخصم:</span>
                    <span className="font-numbers">-{Number(purchase.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-1 mt-1">
                  <span>الصافي:</span>
                  <span className="font-numbers">{Number(purchase.netTotal).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between mt-2 text-gray-600">
                  <span>المدفوع:</span>
                  <span className="font-numbers">{Number(purchase.paidAmount).toFixed(2)}</span>
                </div>
                {Number(purchase.remaining) > 0 && (
                  <div className="flex justify-between mt-1 text-red-600 font-bold">
                    <span>المتبقي:</span>
                    <span className="font-numbers">{Number(purchase.remaining).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-12 text-center text-sm text-gray-500 border-t border-gray-300 pt-4">
              <p>تم استخراج هذه الفاتورة من النظام تلقائياً</p>
            </div>
          </div>

          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden"
            role="dialog"
            aria-modal="true">
            <div
              className="fixed inset-0 bg-background-dark/60 backdrop-blur-sm transition-opacity"
              onClick={onClose}
              aria-hidden="true"></div>
            <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full sm:w-[90%] md:w-[80%] lg:w-[75%] transform transition-all flex flex-col max-h-[90vh] border border-white/10 dark:border-border-dark animate-fade-in-up">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-accent/5 dark:bg-primary/5 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className={`${isCancelled ? "bg-gray-500" : "bg-primary"} text-white p-2 rounded-lg shadow-sm`}>
                    <span className="material-icons-round text-xl">
                      {isCancelled ? "cancel" : "shopping_cart"}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-primary dark:text-text-dark">
                    تفاصيل فاتورة المشتريات #{purchase.id}
                  </h3>
                  {isCancelled && (
                    <span className="bg-gray-200 text-gray-600 text-sm font-bold px-3 py-1 rounded-full line-through">
                      ملغي
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canCancel && (
                    <button
                      onClick={() => setIsCancelConfirmOpen(true)}
                      disabled={cancelling}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-lg">cancel</span>
                      <span className="font-bold">إلغاء الفاتورة</span>
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
                    <span className="material-icons-round text-lg">print</span>
                    <span className="font-bold">طباعة</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center">
                    <span className="material-icons-round text-2xl">close</span>
                  </button>
                </div>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-6" dir="rtl">
                  {/* Cancelled banner */}
                  {isCancelled && (
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <span className="material-symbols-outlined text-lg">info</span>
                      <span className="font-medium text-sm">هذه الفاتورة ملغية — لا يمكن تعديلها أو إرجاعها.</span>
                    </div>
                  )}

                  {/* Purchase Header Info */}
                  <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">المورد:</span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">
                        {purchase.supplier?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">التاريخ:</span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">
                        {purchase.createdAt
                          ? new Date(purchase.createdAt).toLocaleString("ar-EG")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">الخزينة:</span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">
                        {purchase.treasury?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">المخزن:</span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">
                        {purchase.warehouse?.name || "-"}
                      </p>
                    </div>
                    {purchase.supplierInvoiceNo && (
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          رقم فاتورة المورد:
                        </span>
                        <p className="font-bold text-gray-800 dark:text-gray-200">
                          {purchase.supplierInvoiceNo}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Items Table */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">inventory_2</span>
                      الأصناف
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead className="bg-gray-100 dark:bg-zinc-800">
                          <tr>
                            <th className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">#</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">الصنف</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">الكمية</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">سعر الشراء</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">سعر البيع</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                          {purchase.items && purchase.items.length > 0 ? (
                            purchase.items.map((purchaseItem, index) => (
                              <tr
                                key={index}
                                className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{index + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                  {purchaseItem.name || purchaseItem.item?.name || "-"}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                  {Number(purchaseItem.quantity || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200">
                                  {Number(purchaseItem.purchasePrice || 0).toFixed(2)} ج.م
                                </td>
                                <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-medium">
                                  {Number(purchaseItem.sellPrice || 0).toFixed(2)} ج.م
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                                  {Number(purchaseItem.total || 0).toFixed(2)} ج.م
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                لا توجد أصناف
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Calculations Summary */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">calculate</span>
                      ملخص الحسابات
                    </h3>
                    <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-700">
                        <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {Number(purchase.subtotal || 0).toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          الخصم (
                          {purchase.discountType === "PERCENTAGE"
                            ? `%${purchase.discountValue}`
                            : `${purchase.discountValue} ج.م`}
                          ):
                        </span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          - {Number(purchase.discountAmount || 0).toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b-2 border-gray-300 dark:border-zinc-600">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">الصافي:</span>
                        <span className="text-lg font-bold text-primary">
                          {Number(purchase.netTotal || 0).toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">المدفوع:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {Number(purchase.paidAmount || 0).toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300 dark:border-zinc-600">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">المتبقي:</span>
                        <span className={`text-lg font-bold ${Number(purchase.remaining || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                          {Number(purchase.remaining || 0).toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="material-symbols-outlined text-lg">payment</span>
                          <span>طريقة الدفع:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {getPaymentMethodLabel(purchase.paymentMethod)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cancel Confirmation Dialog */}
          {isCancelConfirmOpen && createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" style={{ direction: "rtl" }}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-red-200 dark:border-red-800">
                <div className="bg-red-600 p-4 rounded-t-2xl text-white flex items-center gap-2">
                  <span className="material-symbols-outlined">warning</span>
                  <h3 className="text-lg font-bold">تأكيد إلغاء الفاتورة</h3>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
                    سيتم إلغاء هذه الفاتورة بالكامل وإعادة جميع المبالغ والأصناف إلى المخزن.
                  </p>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex gap-2">
                      <span className="text-gray-500">المورد:</span>
                      <strong>{purchase.supplier?.name || "—"}</strong>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500">رقم الفاتورة:</span>
                      <strong>#{purchase.id}</strong>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500">الإجمالي:</span>
                      <strong>{parseFloat(purchase.netTotal).toFixed(2)} ج.م</strong>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-36 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-2 font-bold">الأصناف التي ستُعاد:</p>
                    {purchase.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm py-0.5">
                        <span>{item.name || item.item?.name}</span>
                        <span className="font-bold">{parseFloat(item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">ملاحظات (اختياري):</label>
                    <input
                      type="text"
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      placeholder="سبب الإلغاء..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-red-500 outline-none bg-white dark:bg-gray-900 text-sm"
                    />
                  </div>
                  <p className="text-red-600 text-xs font-bold">
                    هذا الإجراء نهائي ولا يمكن التراجع عنه.
                  </p>
                </div>
                <div className="p-4 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => { setIsCancelConfirmOpen(false); setCancelNote(""); }}
                    className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-bold text-sm">
                    تراجع
                  </button>
                  <button
                    onClick={() => { setIsCancelConfirmOpen(false); setIsAuthOpen(true); }}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    تأكيد الإلغاء
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          <ManagerAuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            onVerify={handleAuthVerified}
            title="تأكيد إلغاء فاتورة المشتريات"
            message="إلغاء الفاتورة يتطلب موافقة المدير. يرجى إدخال بيانات المدير."
            actionLabel="تأكيد الإلغاء"
          />
        </>
      )}
    </>
  );
};

export default PurchaseDetailsModal;