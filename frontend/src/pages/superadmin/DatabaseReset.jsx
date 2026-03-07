import React, { useState } from "react";
import toast from "react-hot-toast";
import SuperadminService from "../../services/superadminService";

const resetOptions = [
  {
    id: "ALL_TRANSACTIONS",
    title: "مسح جميع الحركات (موصى به)",
    description:
      "يحذف جميع العمليات اليومية (المبيعات، المشتريات، التحويلات، الموارد البشرية) ولكنه يحتفظ بالبيانات الأساسية مثل الأصناف، العملاء، الفروع، والصلاحيات.",
    level: "warning",
    requiresTyping: false,
  },
  {
    category: "الإيرادات والمصروفات والتوريد",
    options: [
      {
        id: "SALES_ONLY",
        title: "مسح المبيعات فقط",
        description: "يحذف جميع سجلات المبيعات.",
        level: "info",
      },
      {
        id: "PURCHASES_ONLY",
        title: "مسح المشتريات فقط",
        description: "يحذف جميع سجلات المشتريات.",
        level: "info",
      },
      {
        id: "TREASURY_TRANSACTIONS",
        title: "مسح الخزينة والمصروفات بالكامل",
        description: "يحذف جميع المصروفات، التحويلات، والإيداعات.",
        level: "info",
      },
      {
        id: "CASH_TRANSFERS",
        title: "مسح التحويلات النقدية",
        description: "يحذف جميع التحويلات النقدية بين الخزائن.",
        level: "info",
      },
      {
        id: "DEPOSITS",
        title: "مسح الإيداعات",
        description: "يحذف جميع سجلات الإيداعات.",
        level: "info",
      },
      {
        id: "WITHDRAWALS",
        title: "مسح السحوبات",
        description: "يحذف جميع سجلات السحوبات النقدية.",
        level: "info",
      },
      {
        id: "SUPPLIER_PAYMENTS",
        title: "مسح مدفوعات الموردين",
        description: "يحذف جميع سجلات الدفع للموردين.",
        level: "info",
      },
    ],
  },
  {
    category: "الموارد البشرية والمخزون والتصنيع",
    options: [
      {
        id: "INVENTORY_MOVEMENTS",
        title: "مسح حركات المخزون",
        description: "يحذف جميع تحويلات المخزون.",
        level: "info",
      },
      {
        id: "HR_DATA",
        title: "مسح بيانات الموارد البشرية بالكامل",
        description: "مسح الرواتب والورديات والسلف.",
        level: "info",
      },
      {
        id: "PAYROLLS",
        title: "مسح مسيرات الرواتب",
        description: "يحذف سجلات الرواتب فقط.",
        level: "info",
      },
      {
        id: "EMPLOYEE_TRANSACTIONS",
        title: "مسح السلف والخصومات",
        description: "يحذف جميع السلف والخصومات للموظفين.",
        level: "info",
      },
      {
        id: "SHIFTS",
        title: "مسح الورديات",
        description: "يحذف سجلات الورديات (ويفصلها عن المبيعات).",
        level: "info",
      },
      {
        id: "PRODUCTION_ORDERS",
        title: "مسح أوامر التصنيع",
        description: "يحذف كافة أوامر التصنيع.",
        level: "info",
      },
      {
        id: "DELIVERY_RECORDS",
        title: "مسح سجلات التوصيل",
        description: "يحذف حركات التوصيل والتسويات.",
        level: "info",
      },
    ],
  },
  {
    category: "سجلات النظام والبيانات الأساسية (خطر)",
    options: [
      {
        id: "AUDIT_LOGS",
        title: "مسح سجلات النظام (Audit Logs)",
        description: "يحذف جميع سجلات تتبع حركات المستخدمين.",
        level: "warning",
      },
      {
        id: "ITEMS_CATEGORIES",
        title: "مسح الأصناف والأقسام",
        description: "يحذف جميع الأصناف، الأقسام، وقواعد التصنيع (BOM).",
        level: "danger",
      },
      {
        id: "CLIENTS_ONLY",
        title: "مسح العملاء",
        description: "يحذف جميع العملاء باستثناء 'عميل نقدي' الافتراضي.",
        level: "danger",
      },
      {
        id: "SUPPLIERS_ONLY",
        title: "مسح الموردين",
        description: "يحذف جميع الموردين باستثناء 'مورد عام' الافتراضي.",
        level: "danger",
      },
      {
        id: "EMPLOYEES_ONLY",
        title: "مسح الموظفين",
        description: "يحذف جميع سجلات الموظفين.",
        level: "danger",
      },
    ],
  },
];

const DatabaseReset = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (option) => {
    setSelectedOption(option);
    setConfirmText("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedOption(null);
    setConfirmText("");
  };

  const handleReset = async () => {
    if (selectedOption?.requiresTyping && confirmText !== "RESET") {
      toast.error("يجب عليك كتابة 'RESET' بدقة للتأكيد.");
      return;
    }

    setIsSubmitting(true);
    try {
      await SuperadminService.resetDatabase(selectedOption.id);
      toast.success(`تم ${selectedOption.title} بنجاح.`);
      closeModal();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "فشل في إعادة ضبط قاعدة البيانات",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCard = (option) => {
    let bgClasses =
      "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300";
    let textHover = "group-hover:text-slate-900 dark:group-hover:text-white";
    let iconClass = "text-slate-400";
    let iconName = "delete_sweep";

    if (option.level === "info") {
      iconClass = "text-blue-500 bg-blue-50 dark:bg-blue-900/20";
    } else if (option.level === "warning") {
      bgClasses =
        "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/50 hover:border-orange-400";
      iconClass = "text-orange-500 bg-orange-100 dark:bg-orange-900/30";
      textHover = "text-orange-700 dark:text-orange-300";
      iconName = "warning_amber";
    } else if (option.level === "danger") {
      bgClasses =
        "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 hover:border-red-400";
      iconClass = "text-red-600 bg-red-100 dark:bg-red-900/30";
      textHover = "text-red-700 dark:text-red-300";
      iconName = "delete_forever";
    } else if (option.level === "critical") {
      bgClasses =
        "bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700 hover:border-rose-500";
      iconClass = "text-rose-700 bg-rose-200 dark:bg-rose-900/50";
      textHover = "text-rose-900 dark:text-rose-100";
      iconName = "report";
    }

    return (
      <div
        key={option.id}
        onClick={() => handleOpenModal(option)}
        className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${bgClasses}`}
        dir="rtl">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg shrink-0 ${iconClass}`}>
            <span className="material-icons-round text-xl">{iconName}</span>
          </div>
          <div>
            <h3
              className={`font-semibold text-base mb-1 transition-colors ${textHover}`}>
              {option.title}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
              {option.description}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          إعادة ضبط قاعدة البيانات
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          إدارة حالة قاعدة البيانات وإجراء مهام إعادة الضبط. الإجراءات المتخذة
          هنا لا يمكن التراجع عنها.
        </p>
      </div>

      <div className="space-y-10">
        {/* Top level options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderCard(resetOptions[0])}
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 px-1 border-b pb-2">
              {resetOptions[1].category}
            </h2>
            <div className="space-y-3">
              {resetOptions[1].options.map(renderCard)}
            </div>
          </div>

          {/* Column 2 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 px-1 border-b pb-2">
              {resetOptions[2].category}
            </h2>
            <div className="space-y-3">
              {resetOptions[2].options.map(renderCard)}
            </div>
          </div>

          {/* Column 3 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 px-1 border-b pb-2">
              {resetOptions[3].category}
            </h2>
            <div className="space-y-3">
              {resetOptions[3].options.map(renderCard)}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalOpen && selectedOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`p-6 border-b ${selectedOption.level === "critical" ? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50" : "border-slate-100 dark:border-slate-700"}`}>
              <div className="flex gap-4 items-center">
                <div
                  className={`p-3 rounded-full shrink-0 ${
                    selectedOption.level === "critical" ||
                    selectedOption.level === "danger"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                      : "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
                  }`}>
                  <span className="material-icons-round text-3xl">warning</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    هل أنت متأكد تماماً؟
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    لا يمكن التراجع عن هذا الإجراء.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  أنت على وشك:
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {selectedOption.title}
                </p>
                <p className="text-xs text-slate-500 mt-2 italic">
                  {selectedOption.description}
                </p>
              </div>

              {selectedOption.requiresTyping && (
                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    يرجى كتابة{" "}
                    <strong className="text-red-600 bg-red-50 dark:bg-red-900/20 px-1 rounded">
                      RESET
                    </strong>{" "}
                    للتأكيد.
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-left"
                    placeholder="اكتب RESET"
                    autoComplete="off"
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors disabled:opacity-50">
                إلغاء
              </button>
              <button
                onClick={handleReset}
                disabled={
                  isSubmitting ||
                  (selectedOption.requiresTyping && confirmText !== "RESET")
                }
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all
                  ${
                    selectedOption.level === "critical" ||
                    selectedOption.level === "danger"
                      ? "bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-500/20"
                      : "bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-500/20"
                  } 
                  disabled:opacity-50 disabled:cursor-not-allowed`}>
                {isSubmitting ? (
                  <>
                    <span className="material-icons-round text-[18px] animate-spin">
                      refresh
                    </span>
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-[18px]">
                      delete_forever
                    </span>
                    نعم، متابعة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseReset;
