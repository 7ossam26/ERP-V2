import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FaCashRegister, FaMoneyBillWave, FaArrowRight } from "react-icons/fa";
import toast from "react-hot-toast";

const EndShiftModal = ({ isOpen, onClose, onSubmit }) => {
  const [actualCash, setActualCash] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cashValue = parseFloat(actualCash);

    if (!actualCash || cashValue < 0) {
      return;
    }

    // Maximum validation - 1 million EGP seems reasonable
    if (cashValue > 1000000) {
      toast.error("المبلغ كبير جداً. يرجى التحقق من الإدخال");
      return;
    }

    onSubmit(cashValue);
  };

  const handleClose = () => {
    setActualCash("");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 rounded-t-2xl text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <FaCashRegister className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">إغلاق الوردية</h2>
              <p className="text-orange-100 text-sm">عد النقدية في الدرج</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <FaMoneyBillWave />
              تعليمات العد
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 mr-6">
              <li className="list-disc">
                قم بعد جميع النقدية الموجودة في الدرج
              </li>
              <li className="list-disc">
                لا تطلع على المبلغ المتوقع من النظام
              </li>
              <li className="list-disc">أدخل المبلغ الفعلي الذي عددته فقط</li>
              <li className="list-disc">سيتم احتساب الفرق بعد موافقة المدير</li>
            </ul>
          </div>

          {/* Cash Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                المبلغ الفعلي في الدرج (ج.م)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full px-4 py-4 text-2xl font-bold rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 text-center"
                placeholder="0.00"
                required
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!actualCash}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                <span>إغلاق الوردية</span>
                <FaArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-xl font-bold text-lg transition-colors">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EndShiftModal;
