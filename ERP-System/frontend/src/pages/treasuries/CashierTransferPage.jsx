import React, { useState } from "react";

const CashierTransferPage = () => {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const currentBalance = 12500;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-24">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-text-primary dark:text-text-dark mb-2">
                تحويل الخزينة
              </h1>
              <p className="text-text-secondary dark:text-gray-400 text-lg">
                نقل السيولة من الفرع إلى الخزينة الرئيسية
              </p>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark border border-primary/20 rounded-xl p-5 shadow-sm min-w-[280px] flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary dark:text-gray-400 mb-1 font-medium">
                  الرصيد الحالي المتاح
                </p>
                <p className="text-2xl font-bold text-text-primary dark:text-text-dark dir-ltr text-right">
                  {currentBalance.toLocaleString()}
                  <span className="text-sm font-normal text-text-secondary dark:text-gray-400 mr-1">
                    ج.م
                  </span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">
                  account_balance_wallet
                </span>
              </div>
            </div>
          </div>

          {/* Transfer Form Card */}
          <div className="space-y-6">
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 md:p-8">
              {/* Route Visualizer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 relative">
                <div className="flex-1 w-full bg-background-light dark:bg-background-dark/50 rounded-xl p-4 border border-border-light dark:border-border-dark relative group hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white dark:bg-surface-dark rounded-lg text-primary shadow-sm">
                      <span className="material-symbols-outlined">
                        storefront
                      </span>
                    </div>
                    <p className="text-sm font-bold text-text-secondary dark:text-gray-400">
                      من
                    </p>
                  </div>
                  <p className="text-lg font-bold text-text-primary dark:text-text-dark">
                    الخزينة الفرعية
                  </p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    كاشير #102 - أحمد محمد
                  </p>
                </div>

                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary z-10 sm:rotate-180 rotate-90 my-2 sm:my-0">
                  <span className="material-symbols-outlined">
                    arrow_right_alt
                  </span>
                </div>

                <div className="flex-1 w-full bg-background-light dark:bg-background-dark/50 rounded-xl p-4 border border-border-light dark:border-border-dark relative group hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white dark:bg-surface-dark rounded-lg text-primary shadow-sm">
                      <span className="material-symbols-outlined">
                        account_balance
                      </span>
                    </div>
                    <p className="text-sm font-bold text-text-secondary dark:text-gray-400">
                      إلى
                    </p>
                  </div>
                  <p className="text-lg font-bold text-text-primary dark:text-text-dark">
                    الخزينة الرئيسية
                  </p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    الإدارة المركزية
                  </p>
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    المبلغ المراد تحويله
                  </label>
                  <div className="relative">
                    <input
                      className="w-full text-left ltr bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-4 text-3xl font-bold text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="0.00"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={currentBalance}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary dark:text-gray-400 font-medium text-lg pointer-events-none">
                      ج.م
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary dark:text-gray-400 mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      info
                    </span>
                    الحد الأقصى للتحويل هو الرصيد الحالي
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    ملاحظات (اختياري)
                  </label>
                  <textarea
                    className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-base text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                    placeholder="أضف أي تفاصيل إضافية عن عملية التحويل..."
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}></textarea>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <button className="flex-1 bg-primary hover:bg-primary-hover text-white py-4 px-6 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px] flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                    تأكيد التحويل
                  </button>
                  <button className="px-6 py-4 rounded-xl text-text-secondary dark:text-gray-400 font-bold hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                    إلغاء
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

export default CashierTransferPage;
