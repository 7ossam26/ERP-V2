import React, { useState } from "react";
import SuperadminService from "../../services/superadminService";
import ManagerVerificationModal from "../../components/shared/ManagerVerificationModal";
import { toast } from "react-hot-toast";

const RESET_CATEGORIES = {
    transactions: [
        {
            category: "sales",
            label: "مسح المبيعات فقط",
            icon: "point_of_sale",
            description: "حذف جميع فواتير البيع وعناصرها",
        },
        {
            category: "purchases",
            label: "مسح المشتريات فقط",
            icon: "shopping_cart",
            description: "حذف جميع فواتير الشراء والمرتجعات",
        },
        {
            category: "treasury",
            label: "مسح الخزينة والمصروفات",
            icon: "account_balance_wallet",
            description: "حذف المصروفات والتحويلات والإيداعات والسحوبات",
        },
        {
            category: "cash-transfers",
            label: "مسح التحويلات النقدية",
            icon: "swap_horiz",
            description: "حذف جميع التحويلات بين الخزائن",
        },
        {
            category: "deposits",
            label: "مسح الإيداعات",
            icon: "savings",
            description: "حذف جميع سجلات الإيداعات",
        },
    ],
    hr: [
        {
            category: "inventory-movements",
            label: "مسح حركات المخزون",
            icon: "inventory_2",
            description: "حذف جميع تحويلات المخزون بين المستودعات",
        },
        {
            category: "hr",
            label: "مسح بيانات الموارد البشرية",
            icon: "groups",
            description: "حذف جميع حركات الموظفين (سلف وخصومات)",
        },
        {
            category: "payroll",
            label: "مسح الرواتب",
            icon: "payments",
            description: "حذف جميع سجلات الرواتب الشهرية",
        },
        {
            category: "advances",
            label: "مسح السلف",
            icon: "request_quote",
            description: "حذف سجلات السلفيات للموظفين فقط",
        },
        {
            category: "shifts",
            label: "مسح الشيفتات",
            icon: "schedule",
            description: "حذف جميع شيفتات نقطة البيع",
        },
    ],
    masterData: [
        {
            category: "items",
            label: "مسح الأصناف والتصنيفات",
            icon: "category",
            description: "حذف جميع الأصناف والتصنيفات (يتطلب مسح المعاملات أولاً)",
            danger: true,
        },
        {
            category: "clients",
            label: "مسح العملاء",
            icon: "people",
            description: "حذف جميع سجلات العملاء (يتطلب مسح المبيعات أولاً)",
            danger: true,
        },
        {
            category: "suppliers",
            label: "مسح الموردين",
            icon: "local_shipping",
            description: "حذف جميع سجلات الموردين (يتطلب مسح المشتريات أولاً)",
            danger: true,
        },
        {
            category: "employees",
            label: "مسح الموظفين",
            icon: "badge",
            description: "حذف جميع سجلات الموظفين (يتطلب مسح المبيعات أولاً)",
            danger: true,
        },
    ],
};

const DatabaseReset = () => {
    const [pendingCategory, setPendingCategory] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);

    const handleResetClick = (item) => {
        setPendingCategory(item);
    };

    const handleVerify = async ({ managerUsername, managerPassword }) => {
        if (!pendingCategory) return;
        setIsVerifying(true);
        try {
            await SuperadminService.resetCategory(pendingCategory.category, {
                managerUsername,
                managerPassword,
            });
            toast.success(`تم ${pendingCategory.label} بنجاح`);
            setPendingCategory(null);
        } catch (error) {
            toast.error(error.message || "فشلت عملية المسح");
        } finally {
            setIsVerifying(false);
        }
    };

    const ResetButton = ({ item }) => (
        <button
            onClick={() => handleResetClick(item)}
            className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition group ${
                item.danger
                    ? "border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
        >
            <div
                className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                    item.danger
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                }`}
            >
                <span className="material-icons-round text-base">{item.icon}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
                <p
                    className={`font-semibold text-sm ${
                        item.danger
                            ? "text-red-700 dark:text-red-400"
                            : "text-slate-800 dark:text-slate-200"
                    }`}
                >
                    {item.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {item.description}
                </p>
            </div>
            <span
                className={`material-icons-round text-sm mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition ${
                    item.danger ? "text-red-500" : "text-slate-400"
                }`}
            >
                chevron_right
            </span>
        </button>
    );

    return (
        <div className="space-y-6 pb-8 max-w-5xl mx-auto">
            {/* Page header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    إعادة تعيين قاعدة البيانات
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    مسح بيانات النظام بشكل انتقائي — تتطلب كل عملية تأكيد المدير
                </p>
            </div>

            {/* ── Clear All Transactions (recommended) ── */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                        <span className="material-icons-round text-2xl">warning</span>
                    </div>
                    <div>
                        <h2 className="font-bold text-amber-900 dark:text-amber-300 text-base">
                            مسح جميع الحركات (موصى به)
                        </h2>
                        <p className="text-amber-700 dark:text-amber-400 text-sm">
                            حذف جميع المبيعات، المشتريات، الرواتب، الشيفتات، حركات المخزون والخزينة دفعة واحدة
                        </p>
                    </div>
                </div>
                <button
                    onClick={() =>
                        handleResetClick({
                            category: "all-transactions",
                            label: "جميع الحركات",
                        })
                    }
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-lg shadow-amber-900/20 shrink-0 whitespace-nowrap"
                >
                    <span className="material-icons-round text-base">delete_sweep</span>
                    مسح الكل
                </button>
            </div>

            {/* ── Three columns ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Revenue / Expenses / Procurement */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-icons-round text-slate-500 text-base">receipt_long</span>
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
                            الإيرادات والمصروفات والتوريد
                        </h3>
                    </div>
                    {RESET_CATEGORIES.transactions.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>

                {/* Column 2: HR / Inventory / Manufacturing */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-icons-round text-slate-500 text-base">manage_accounts</span>
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
                            الموارد البشرية والمخزون
                        </h3>
                    </div>
                    {RESET_CATEGORIES.hr.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>

                {/* Column 3: Master Data (DANGER) */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-icons-round text-red-500 text-base">dangerous</span>
                        <h3 className="font-bold text-red-600 dark:text-red-400 text-sm uppercase tracking-wide">
                            البيانات الأساسية (خطر)
                        </h3>
                    </div>
                    {RESET_CATEGORIES.masterData.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>
            </div>

            {/* ── Manager verification modal ── */}
            <ManagerVerificationModal
                isOpen={!!pendingCategory}
                onClose={() => setPendingCategory(null)}
                onVerify={handleVerify}
                loading={isVerifying}
                title="تأكيد عملية المسح"
                description={
                    pendingCategory
                        ? `أنت على وشك تنفيذ: "${pendingCategory.label}". هذه العملية لا يمكن التراجع عنها. يرجى إدخال بيانات المدير للمتابعة.`
                        : ""
                }
            />
        </div>
    );
};

export default DatabaseReset;
