import React, { useState } from "react";
import SuperadminService from "../../services/superadminService";
import ManagerVerificationModal from "../../components/shared/ManagerVerificationModal";
import { toast } from "react-hot-toast";

const RESET_CATEGORIES = {
    salesPurchases: [
        { category: "sales", label: "مسح المبيعات", icon: "point_of_sale", description: "حذف جميع فواتير البيع وعناصرها" },
        { category: "purchases", label: "مسح المشتريات", icon: "shopping_cart", description: "حذف جميع فواتير الشراء وعناصرها" },
        { category: "purchase-returns", label: "مسح مرتجعات الشراء", icon: "assignment_return", description: "حذف جميع مرتجعات فواتير الشراء وعناصرها" },
        { category: "bulk-orders", label: "مسح أوامر الجملة (B2B)", icon: "business", description: "حذف جميع أوامر البيع بالجملة والمدفوعات والمستندات المرتبطة" },
        { category: "shifts", label: "مسح الشيفتات", icon: "schedule", description: "حذف جميع شيفتات نقطة البيع" },
    ],
    treasuryFinance: [
        { category: "treasury", label: "مسح الخزينة والمصروفات", icon: "account_balance_wallet", description: "حذف المصروفات والتحويلات والإيداعات والسحوبات وتصفير الأرصدة" },
        { category: "cash-transfers", label: "مسح التحويلات النقدية", icon: "swap_horiz", description: "حذف جميع التحويلات بين الخزائن" },
        { category: "deposits", label: "مسح الإيداعات", icon: "savings", description: "حذف جميع سجلات الإيداعات" },
        { category: "withdrawals", label: "مسح السحوبات", icon: "money_off", description: "حذف جميع سجلات السحوبات من الخزائن" },
        { category: "supplier-payments", label: "مسح مدفوعات الموردين", icon: "receipt", description: "حذف جميع مدفوعات الموردين وتصفير أرصدتهم" },
        { category: "supplier-balances", label: "تصفير أرصدة الموردين", icon: "balance", description: "تصفير أرصدة حسابات الموردين فقط دون حذف السجلات" },
        { category: "audit-logs", label: "مسح سجلات المراجعة", icon: "manage_search", description: "حذف جميع سجلات الأنشطة والتدقيق في النظام" },
    ],
    inventoryProduction: [
        { category: "inventory-movements", label: "مسح حركات المخزون", icon: "inventory_2", description: "حذف جميع تحويلات المخزون بين المستودعات" },
        { category: "inventory-quantities", label: "تصفير كميات المخزون", icon: "exposure_zero", description: "تصفير جميع كميات الأصناف في المستودعات إلى صفر" },
        { category: "production-orders", label: "مسح أوامر الإنتاج", icon: "precision_manufacturing", description: "حذف جميع أوامر الإنتاج وعناصرها" },
        { category: "opening-inventory", label: "مسح مخزون الافتتاح", icon: "warehouse", description: "حذف سجلات المخزون الافتتاحي وتصفير جميع الكميات الحالية" },
    ],
    hrPayroll: [
        { category: "hr", label: "مسح حركات الموارد البشرية", icon: "groups", description: "حذف جميع حركات الموظفين (سلف وخصومات)" },
        { category: "payroll", label: "مسح الرواتب", icon: "payments", description: "حذف جميع سجلات الرواتب الشهرية" },
        { category: "advances", label: "مسح السلف", icon: "request_quote", description: "حذف سجلات السلفيات للموظفين فقط" },
    ],
    delivery: [
        { category: "delivery-man-transactions", label: "مسح حركات المناديب", icon: "delivery_dining", description: "حذف جميع حركات الديون والتسويات للمناديب" },
        { category: "delivery-wallets", label: "تصفير محافظ المناديب", icon: "account_balance", description: "تصفير رصيد المحفظة لجميع المناديب دون حذف السجلات" },
    ],
    system: [
        { category: "notifications", label: "مسح الإشعارات", icon: "notifications_off", description: "حذف جميع إشعارات النظام والطلبات" },
    ],
    masterData: [
        { category: "items-only", label: "مسح الأصناف", icon: "inventory", description: "حذف جميع الأصناف وأوامر الإنتاج (يتطلب مسح المعاملات أولاً)", danger: true },
        { category: "categories-only", label: "مسح التصنيفات", icon: "category", description: "حذف جميع التصنيفات (يتطلب مسح الأصناف أولاً)", danger: true },
        { category: "boms", label: "مسح قوائم المكونات", icon: "schema", description: "حذف جميع قوائم المكونات (يتطلب مسح أوامر الإنتاج والمبيعات أولاً)", danger: true },
        { category: "clients", label: "مسح العملاء", icon: "people", description: "حذف جميع سجلات العملاء (يتطلب مسح المبيعات أولاً)", danger: true },
        { category: "suppliers", label: "مسح الموردين", icon: "local_shipping", description: "حذف جميع سجلات الموردين (يتطلب مسح المشتريات أولاً)", danger: true },
        { category: "employees", label: "مسح الموظفين", icon: "badge", description: "حذف جميع سجلات الموظفين (يتطلب مسح المبيعات أولاً)", danger: true },
        { category: "delivery-men", label: "مسح المناديب", icon: "directions_bike", description: "حذف جميع سجلات المناديب وحركاتهم (المبيعات المرتبطة تُصفَّر تلقائياً)", danger: true },
        { category: "delivery-zones", label: "مسح مناطق التوصيل", icon: "map", description: "حذف جميع مناطق التوصيل (المبيعات المرتبطة تُصفَّر تلقائياً)", danger: true },
        { category: "bulk-customers", label: "مسح عملاء الجملة (B2B)", icon: "business_center", description: "حذف جميع عملاء الجملة والأسعار التعاقدية (يتطلب مسح أوامر الجملة أولاً)", danger: true },
    ],
};

const DANGER_CONFIRM_REQUIRED = new Set([
    "all-transactions",
    "items-only", "categories-only", "boms", "clients",
    "suppliers", "employees", "delivery-men", "delivery-zones", "bulk-customers",
]);

const GRANULAR_SECTIONS = [
    { key: "salesPurchases", icon: "receipt_long", label: "المبيعات والمشتريات" },
    { key: "treasuryFinance", icon: "account_balance_wallet", label: "الخزينة والمالية" },
    { key: "inventoryProduction", icon: "inventory_2", label: "المخزون والإنتاج" },
    { key: "hrPayroll", icon: "manage_accounts", label: "الموارد البشرية والرواتب" },
    { key: "delivery", icon: "local_shipping", label: "التوصيل" },
    { key: "system", icon: "settings", label: "النظام" },
];

const PRESERVED_ITEMS = [
    "المستخدمون والأدوار والصلاحيات",
    "الفروع والمستودعات والخزائن",
    "الأصناف والتصنيفات وقوائم المكونات",
    "العملاء والموردين والموظفين",
    "عملاء الجملة (B2B) والأسعار التعاقدية",
    "المناديب ومناطق التوصيل",
    "إعدادات وتهيئة النظام",
];

const DatabaseReset = () => {
    const [pendingCategory, setPendingCategory] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [showTypedConfirm, setShowTypedConfirm] = useState(false);
    const [typedConfirmText, setTypedConfirmText] = useState("");
    const [dangerExpanded, setDangerExpanded] = useState(false);

    const handleResetClick = (item) => {
        setPendingCategory(item);
        if (DANGER_CONFIRM_REQUIRED.has(item.category)) {
            setTypedConfirmText("");
            setShowTypedConfirm(true);
        }
    };

    const handleTypedConfirmProceed = () => {
        if (typedConfirmText !== "RESET") return;
        setShowTypedConfirm(false);
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

    const handleClose = () => {
        setPendingCategory(null);
        setShowTypedConfirm(false);
        setTypedConfirmText("");
    };

    const ResetButton = ({ item }) => (
        <button
            onClick={() => handleResetClick(item)}
            className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-right transition group"
        >
            <div className="mt-0.5 p-1.5 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                <span className="material-icons-round text-sm">{item.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{item.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{item.description}</p>
            </div>
            <span className="material-icons-round text-xs text-slate-300 dark:text-slate-600 mt-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                chevron_right
            </span>
        </button>
    );

    const SectionCard = ({ icon, label, items }) => (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-icons-round text-slate-400 text-sm">{icon}</span>
                <h3 className="font-semibold text-slate-600 dark:text-slate-300 text-sm">{label}</h3>
            </div>
            {items.map((item) => (
                <ResetButton key={item.category} item={item} />
            ))}
        </div>
    );

    return (
        <div className="space-y-6 pb-10 max-w-7xl mx-auto" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    إعادة تعيين قاعدة البيانات
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    مسح بيانات النظام بشكل انتقائي — تتطلب كل عملية تأكيد المدير
                </p>
            </div>

            {/* Preserved data banner */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-xl mt-0.5 shrink-0">
                        verified_user
                    </span>
                    <div>
                        <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
                            البيانات الأساسية والمرجعية محمية دائماً ولا تُمس بأي عملية مسح
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {PRESERVED_ITEMS.map((item) => (
                                <span
                                    key={item}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg font-medium"
                                >
                                    <span className="material-icons-round text-xs">check</span>
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Reset — primary action */}
            <div className="bg-gradient-to-l from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row items-start gap-5">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                            <span className="material-icons-round text-2xl">delete_sweep</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-bold text-amber-900 dark:text-amber-300 text-lg">
                                    تصفير المعاملات
                                </h2>
                                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-full">
                                    موصى به
                                </span>
                            </div>
                            <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
                                مسح شامل لجميع المعاملات مع الحفاظ التام على البيانات الأساسية والمرجعية
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-3 border border-red-200 dark:border-red-900/30">
                                    <p className="font-bold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
                                        <span className="material-icons-round text-xs">close</span>
                                        سيُمسح
                                    </p>
                                    <ul className="space-y-1 text-red-600 dark:text-red-400">
                                        <li>• المبيعات والمشتريات والمرتجعات</li>
                                        <li>• الشيفتات والمصروفات</li>
                                        <li>• الرواتب والسلف</li>
                                        <li>• حركات المخزون والإنتاج</li>
                                        <li>• الخزينة والتحويلات والإيداعات</li>
                                        <li>• أوامر الجملة (B2B) والمدفوعات</li>
                                        <li>• الإشعارات ومخزون الافتتاح</li>
                                    </ul>
                                </div>
                                <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-3 border border-emerald-200 dark:border-emerald-900/30">
                                    <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                                        <span className="material-icons-round text-xs">check</span>
                                        سيُحفظ
                                    </p>
                                    <ul className="space-y-1 text-emerald-700 dark:text-emerald-400">
                                        <li>• المستخدمون والصلاحيات</li>
                                        <li>• الفروع والمستودعات</li>
                                        <li>• الأصناف والتصنيفات والـ BOM</li>
                                        <li>• العملاء والموردين والموظفين</li>
                                        <li>• عملاء الجملة والأسعار التعاقدية</li>
                                        <li>• المناديب ومناطق التوصيل</li>
                                        <li>• إعدادات النظام</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() =>
                            handleResetClick({ category: "all-transactions", label: "تصفير جميع المعاملات" })
                        }
                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-2xl transition shadow-lg shadow-amber-900/20 shrink-0 whitespace-nowrap"
                    >
                        <span className="material-icons-round text-base">delete_sweep</span>
                        تصفير الكل
                    </button>
                </div>
            </div>

            {/* Granular resets */}
            <div>
                <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                    <span className="material-icons-round text-slate-400 text-sm">tune</span>
                    مسح انتقائي
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {GRANULAR_SECTIONS.map(({ key, icon, label }) => (
                        <SectionCard key={key} icon={icon} label={label} items={RESET_CATEGORIES[key]} />
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="border-2 border-red-200 dark:border-red-900/40 rounded-2xl overflow-hidden">
                <button
                    onClick={() => setDangerExpanded((v) => !v)}
                    className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100/70 dark:hover:bg-red-900/30 transition text-right"
                >
                    <div className="flex items-center gap-3">
                        <span className="material-icons-round text-red-500 text-xl">dangerous</span>
                        <div>
                            <h3 className="font-bold text-red-700 dark:text-red-400 text-sm">
                                منطقة الخطر — مسح البيانات الأساسية
                            </h3>
                            <p className="text-red-500 dark:text-red-500/80 text-xs mt-0.5">
                                يتطلب مسح المعاملات أولاً — هذه العمليات لا يمكن التراجع عنها
                            </p>
                        </div>
                    </div>
                    <span
                        className={`material-icons-round text-red-400 transition-transform duration-200 ${
                            dangerExpanded ? "rotate-180" : ""
                        }`}
                    >
                        expand_more
                    </span>
                </button>

                {dangerExpanded && (
                    <div className="p-4 bg-white dark:bg-slate-800/50 border-t border-red-100 dark:border-red-900/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {RESET_CATEGORIES.masterData.map((item) => (
                                <button
                                    key={item.category}
                                    onClick={() => handleResetClick(item)}
                                    className="flex items-start gap-3 p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-right transition group"
                                >
                                    <div className="mt-0.5 p-1.5 rounded-lg shrink-0 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400">
                                        <span className="material-icons-round text-sm">{item.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-red-700 dark:text-red-400">
                                            {item.label}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                            {item.description}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Typed confirmation dialog */}
            {showTypedConfirm && pendingCategory && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                        dir="rtl"
                    >
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                    <span className="material-icons-round text-red-600 dark:text-red-400 text-2xl">
                                        warning
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                                        تأكيد العملية
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                                        أنت على وشك:{" "}
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                                            {pendingCategory.label}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {pendingCategory.category === "all-transactions" && (
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl p-3">
                                        <p className="font-bold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
                                            <span className="material-icons-round text-xs">close</span>
                                            سيُمسح
                                        </p>
                                        <ul className="space-y-1 text-red-600 dark:text-red-400">
                                            <li>• المبيعات والمشتريات والمرتجعات</li>
                                            <li>• الشيفتات والمصروفات والرواتب</li>
                                            <li>• حركات المخزون والإنتاج</li>
                                            <li>• الخزينة والتحويلات والإيداعات</li>
                                            <li>• أوامر الجملة B2B والمدفوعات</li>
                                            <li>• الإشعارات ومخزون الافتتاح</li>
                                        </ul>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3">
                                        <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                                            <span className="material-icons-round text-xs">check</span>
                                            سيُحفظ
                                        </p>
                                        <ul className="space-y-1 text-emerald-700 dark:text-emerald-400">
                                            <li>• المستخدمون والصلاحيات</li>
                                            <li>• الفروع والمستودعات</li>
                                            <li>• الأصناف والتصنيفات والـ BOM</li>
                                            <li>• العملاء والموردين والموظفين</li>
                                            <li>• عملاء الجملة والأسعار التعاقدية</li>
                                            <li>• إعدادات النظام</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-start gap-2">
                                <span className="material-icons-round text-amber-500 text-sm shrink-0 mt-0.5">info</span>
                                <span>
                                    هذه العملية لا يمكن التراجع عنها. ستحتاج إلى تأكيد بيانات المدير في الخطوة التالية.
                                </span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    اكتب{" "}
                                    <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                                        RESET
                                    </span>{" "}
                                    للمتابعة
                                </label>
                                <input
                                    type="text"
                                    value={typedConfirmText}
                                    onChange={(e) => setTypedConfirmText(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleTypedConfirmProceed()}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    placeholder="RESET"
                                    autoComplete="off"
                                    autoFocus
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={handleTypedConfirmProceed}
                                disabled={typedConfirmText !== "RESET"}
                                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                متابعة لتأكيد المدير
                            </button>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manager verification modal (opens after typed confirm passes) */}
            <ManagerVerificationModal
                isOpen={!showTypedConfirm && !!pendingCategory}
                onClose={handleClose}
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
