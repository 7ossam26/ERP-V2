import React from "react";
import BrandNavigationCard from "../../components/common/BrandNavigationCard";

const IMPORT_TYPES = [
  {
    key: "fabric-items",
    label: "أقمشة",
    desc: "استيراد أصناف الأقمشة (FABRIC)",
    icon: "texture",
  },
  {
    key: "clothes-items",
    label: "ملابس",
    desc: "استيراد أصناف الملابس (CLOTHES)",
    icon: "checkroom",
  },
  {
    key: "accessories",
    label: "إكسسوارات",
    desc: "استيراد أصناف الإكسسوارات (ACCESSORY)",
    icon: "watch",
  },
  {
    key: "generic-items",
    label: "أصناف عامة",
    desc: "استيراد أصناف عامة (GENERIC)",
    icon: "inventory_2",
  },
  {
    key: "clients",
    label: "العملاء",
    desc: "استيراد قاعدة بيانات العملاء",
    icon: "people",
  },
  {
    key: "suppliers",
    label: "الموردين",
    desc: "استيراد بيانات الموردين",
    icon: "local_shipping",
  },
  {
    key: "initial-inventory",
    label: "المخزون الافتتاحي",
    desc: "تعيين الكميات الافتتاحية في المستودعات",
    icon: "warehouse",
  },
  {
    key: "fabric-rolls",
    label: "لفات الأقمشة",
    desc: "استيراد لفات الأقمشة مع أرقام تلقائية",
    icon: "rotate_right",
  },
  {
    key: "employees",
    label: "الموظفين",
    desc: "استيراد بيانات الموظفين والرواتب",
    icon: "badge",
  },
  {
    key: "treasury",
    label: "الخزائن",
    desc: "إنشاء خزائن مع الأرصدة الافتتاحية",
    icon: "account_balance",
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
        {IMPORT_TYPES.map((type) => (
          <BrandNavigationCard
            key={type.key}
            to={`/import/${type.key}`}
            icon={type.icon}
            title={type.label}
            description={type.desc}
            seed={type.key}
          />
        ))}
      </div>
    </div>
  );
}
