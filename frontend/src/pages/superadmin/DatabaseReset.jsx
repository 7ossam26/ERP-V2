import React, { useState } from "react";
import SuperadminService from "../../services/superadminService";
import ManagerVerificationModal from "../../components/shared/ManagerVerificationModal";
import { toast } from "react-hot-toast";

const RESET_CATEGORIES = {
    salesPurchases: [
        { category: "sales", label: "مسح المبيعات فقط", icon: "point_of_sale", description: "حذف جميع فواتير البيع وعناصرها" },
        { category: "purchases", label: "مسح المشتريات فقط", icon: "shopping_cart", description: "حذف جميع فواتير الشراء وعناصرها" },
        { category: "purchase-returns", label: "مسح مرتجعات الشراء", icon: "assignment_return", description: "حذف جميع مرتجعات فواتير الشراء وعناصرها" },
        { category: "shifts", label: "مسح الشيفتات", icon: "schedule", description: "حذف جميع شيفتات نقطة البيع" },
    ],
    treasuryFinance: [
        { category: "treasury", label: "مسح الخزينة والمصروفات", icon: "account_balance_wallet", description: "حذف المصروفات والتحويلات والإيداعات والسحوبات" },
        { category: "cash-transfers", label: "مسح التحويلات النقدية", icon: "swap_horiz", description: "حذف جميع التحويلات بين الخزائن" },
        { category: "deposits", label: "مسح الإيداعات", icon: "savings", description: "حذف جميع سجلات الإيداعات" },
        { category: "withdrawals", label: "مسح السحوبات", icon: "money_off", description: "حذف جميع سجلات السحوبات من الخزائن" },
        { category: "supplier-payments", label: "مسح مدفوعات الموردين", icon: "receipt", description: "حذف جميع مدفوعات الموردين وتصفير أرصدتهم" },
        { category: "supplier-balances", label: "تصفير أرصدة الموردين", icon: "balance", description: "تصفير أرصدة حسابات الموردين فقط دون حذف السجلات" },
        { category: "audit-logs", label: "مسح سجلات المراجعة", icon: "manage_search", description: "حذف جميع سجلات الأنشطة والتدقيق في النظام" },
    ],
    hrInventory: [
        { category: "inventory-movements", label: "مسح حركات المخزون", icon: "inventory_2", description: "حذف جميع تحويلات المخزون بين المستودعات" },
        { category: "inventory-quantities", label: "تصفير كميات المخزون", icon: "exposure_zero", description: "تصفير جميع كميات الأصناف في المستودعات إلى صفر" },
        { category: "production-orders", label: "مسح أوامر الإنتاج", icon: "precision_manufacturing", description: "حذف جميع أوامر الإنتاج وعناصرها" },
        { category: "hr", label: "مسح بيانات الموارد البشرية", icon: "groups", description: "حذف جميع حركات الموظفين (سلف وخصومات)" },
        { category: "payroll", label: "مسح الرواتب", icon: "payments", description: "حذف جميع سجلات الرواتب الشهرية" },
        { category: "advances", label: "مسح السلف", icon: "request_quote", description: "حذف سجلات السلفيات للموظفين فقط" },
    ],
    delivery: [
        { category: "delivery-man-transactions", label: "مسح حركات المناديب", icon: "delivery_dining", description: "حذف جميع حركات الديون والتسويات للمناديب" },
        { category: "delivery-wallets", label: "تصفير محافظ المناديب", icon: "account_balance", description: "تصفير رصيد المحفظة لجميع المناديب دون حذف السجلات" },
    ],
    masterData: [
        { category: "items", label: "مسح الأصناف والتصنيفات", icon: "category", description: "حذف جميع الأصناف والتصنيفات وأوامر الإنتاج وحركات المخزون (يتطلب مسح المعاملات أولاً)", danger: true },
        { category: "boms", label: "مسح قوائم المكونات (BOM)", icon: "schema", description: "حذف جميع قوائم المكونات وعناصرها (يتطلب مسح أوامر الإنتاج والمبيعات أولاً)", danger: true },
        { category: "clients", label: "مسح العملاء", icon: "people", description: "حذف جميع سجلات العملاء (يتطلب مسح المبيعات أولاً)", danger: true },
        { category: "suppliers", label: "مسح الموردين", icon: "local_shipping", description: "حذف جميع سجلات الموردين (يتطلب مسح المشتريات أولاً)", danger: true },
        { category: "employees", label: "مسح الموظفين", icon: "badge", description: "حذف جميع سجلات الموظفين (يتطلب مسح المبيعات أولاً)", danger: true },
        { category: "delivery-men", label: "مسح المناديب", icon: "directions_bike", description: "حذف جميع سجلات المناديب وحركاتهم (المبيعات المرتبطة تُصفَّر تلقائياً)", danger: true },
        { category: "delivery-zones", label: "مسح مناطق التوصيل", icon: "map", description: "حذف جميع مناطق التوصيل (المبيعات المرتبطة تُصفَّر تلقائياً)", danger: true },
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

    const SectionHeader = ({ icon, label }) => (
        <div className="flex items-center gap-2 mb-1">
            <span className="material-icons-round text-slate-500 text-base">{icon}</span>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
                {label}
            </h3>
        </div>
    );

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
        <div className="space-y-6 pb-8 max-w-7xl mx-auto">
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
                            حذف جميع المبيعات، المشتريات، المرتجعات، الرواتب، الشيفتات، أوامر الإنتاج، حركات المخزون، مدفوعات الموردين، حركات المناديب، والخزينة دفعة واحدة
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

            {/* ── Four columns (RTL: right → left) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Column 1 (rightmost in RTL): Treasury & Finance */}
                <div className="space-y-3">
                    <SectionHeader icon="account_balance_wallet" label="الخزينة والمالية" />
                    {RESET_CATEGORIES.treasuryFinance.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>

                {/* Column 2: HR / Inventory / Manufacturing */}
                <div className="space-y-3">
                    <SectionHeader icon="manage_accounts" label="الموارد البشرية والمخزون" />
                    {RESET_CATEGORIES.hrInventory.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>

                {/* Column 3: Sales & Purchases */}
                <div className="space-y-3">
                    <SectionHeader icon="receipt_long" label="المبيعات والمشتريات" />
                    {RESET_CATEGORIES.salesPurchases.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>

                {/* Column 4 (leftmost in RTL): Delivery & Logistics */}
                <div className="space-y-3">
                    <SectionHeader icon="local_shipping" label="التوصيل واللوجستيات" />
                    {RESET_CATEGORIES.delivery.map((item) => (
                        <ResetButton key={item.category} item={item} />
                    ))}
                </div>
            </div>

            {/* ── Master Data (DANGER) — full-width sub-grid ── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-icons-round text-red-500 text-base">dangerous</span>
                    <h3 className="font-bold text-red-600 dark:text-red-400 text-sm uppercase tracking-wide">
                        البيانات الأساسية (خطر)
                    </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
