import React from "react";

const PrintPaymentModal = ({ isOpen, onClose, onSelectPayment, totals }) => {
  if (!isOpen) return null;

  const handlePayment = (method) => {
    onSelectPayment(method);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition-colors">
          <span className="material-icons-round text-2xl">close</span>
        </button>

        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">
          طباعة الفاتورة
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          اختر طريقةالدفع
        </p>

        {/* Total Display */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">الإجمالي:</span>
            <span className="text-2xl font-bold text-primary">
              {totals?.total?.toFixed(2) || "0.00"} ج.م
            </span>
          </div>
        </div>

        {/* Payment Method Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handlePayment("cash")}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl">
            <span className="material-icons-round text-3xl">payments</span>
            <span className="text-xl">نقدي (Cash)</span>
          </button>

          <button
            onClick={() => handlePayment("visa")}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl">
            <span className="material-icons-round text-3xl">credit_card</span>
            <span className="text-xl">بطاقة (Visa)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintPaymentModal;
