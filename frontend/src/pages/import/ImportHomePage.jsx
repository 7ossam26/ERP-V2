import React from "react";
import { Link } from "react-router-dom";

const IMPORT_TYPES = [
  {
    key: "fabric-items",
    label: "أقمشة",
    desc: "استيراد أصناف الأقمشة (FABRIC)",
    icon: "texture",
    color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  },
  {
    key: "clothes-items",
    label: "ملابس",
    desc: "استيراد أصناف الملابس (CLOTHES)",
    icon: "checkroom",
    color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  },
  {
    key: "accessories",
    label: "إكسسوارات",
    desc: "استيراد أصناف الإكسسوارات (ACCESSORY)",
    icon: "watch",
    color: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400",
  },
  {
    key: "generic-items",
    label: "أصناف عامة",
    desc: "استيراد أصناف عامة (GENERIC)",
    icon: "inventory_2",
    color: "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  },
  {
    key: "clients",
    label: "العملاء",
    desc: "استيراد قاعدة بيانات العملاء",
    icon: "people",
    color: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
  },
  {
    key: "suppliers",
    label: "الموردين",
    desc: "استيراد بيانات الموردين",
    icon: "local_shipping",
    color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  },
  {
    key: "initial-inventory",
    label: "المخزون الافتتاحي",
    desc: "تعيين الكميات الافتتاحية في المستودعات",
    icon: "warehouse",
    color: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  },
  {
    key: "fabric-rolls",
    label: "لفات الأقمشة",
    desc: "استيراد لفات الأقمشة مع أرقام تلقائية",
    icon: "rotate_right",
    color: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
  },
  {
    key: "employees",
    label: "الموظفين",
    desc: "استيراد بيانات الموظفين والرواتب",
    icon: "badge",
    color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "treasury",
    label: "الخزائن",
    desc: "إنشاء خزائن مع الأرصدة الافتتاحية",
    icon: "account_balance",
    color: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400",
  },
];

export default function ImportHomePage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-2xl">upload</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">استيراد البيانات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">رفع بيانات جماعية من ملفات Excel أو CSV</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-2">
          <span className="material-icons-round text-base">info</span>
          ترتيب الاستيراد المنصوح به
        </p>
        <ol className="text-xs text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-0.5">
          <li>أصناف (أقمشة / ملابس / إكسسوارات / عامة)</li>
          <li>العملاء والموردين</li>
          <li>الموظفين والخزائن</li>
          <li>لفات الأقمشة (تتطلب وجود الأصناف أولاً)</li>
          <li>المخزون الافتتاحي (تتطلب وجود الأصناف والمستودعات)</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {IMPORT_TYPES.map((t) => (
          <Link
            key={t.key}
            to={`/import/${t.key}`}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${t.color}`}>
              <span className="material-icons-round text-xl">{t.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">{t.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.desc}</p>
            </div>
            <span className="material-icons-round text-slate-300 dark:text-slate-600 group-hover:text-primary mr-auto flex-shrink-0 transition-colors">
              chevron_left
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
