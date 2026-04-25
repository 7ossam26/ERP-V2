import React from "react";
import { Link } from "react-router-dom";
import AuthService from "../../services/authService";
import Icon from "../../components/ui/Icon";

const GROUPS = [
  {
    label: "المبيعات",
    icon: "point_of_sale",
    items: [
      { label: "المبيعات اليومية", desc: "مبيعات مجمعة يومياً / أسبوعياً / شهرياً", icon: "show_chart", path: "/reports/sales/daily" },
      { label: "مبيعات حسب المحور", desc: "تقسيم حسب الفرع / الشريحة / التصنيف / طريقة الدفع", icon: "pie_chart", path: "/reports/sales/by-dimension" },
      { label: "هامش الربح بالصنف", desc: "الإيراد والتكلفة والهامش لكل صنف", icon: "trending_up", path: "/reports/margin-by-sku" },
      { label: "الأكثر مبيعاً", desc: "أعلى الأصناف إيراداً أو كمية", icon: "leaderboard", path: "/reports/top-movers" },
    ],
  },
  {
    label: "المخزون",
    icon: "warehouse",
    items: [
      { label: "المخزون الراكد", desc: "أصناف لم تُباع خلال فترة محددة", icon: "inventory", path: "/reports/dead-stock" },
    ],
  },
  {
    label: "الأقمشة",
    icon: "texture",
    items: [
      { label: "متبقي الأقمشة", desc: "الأمتار المتبقية لكل صنف قماش", icon: "straighten", path: "/reports/fabric/remaining-meters" },
      { label: "لفات الأقمشة حسب العمر", desc: "تصنيف اللفات حسب عمرها في المخزون", icon: "schedule", path: "/reports/fabric/rolls-by-age" },
    ],
  },
  {
    label: "الورديات",
    icon: "manage_accounts",
    items: [
      { label: "تسوية الورديات", desc: "مقارنة الرصيد المتوقع بالفعلي لكل وردية", icon: "account_balance_wallet", path: "/reports/shift-reconciliation" },
    ],
  },
];

export default function ReportsIndexPage() {
  const user = AuthService.getCurrentUser();
  const hasOwnerDashboard = AuthService.hasPermission("OWNER_DASHBOARD");

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon name="bar_chart" className="text-primary text-2xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">التقارير والسجلات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">اختر التقرير الذي تريد عرضه</p>
        </div>
      </div>

      {hasOwnerDashboard && (
        <Link
          to="/dashboard/owner"
          className="flex items-center gap-4 p-5 bg-gradient-to-l from-primary/10 to-primary/5 border border-primary/20 rounded-2xl hover:border-primary/40 transition-colors">
          <Icon name="dashboard_customize" className="text-primary text-3xl" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white">لوحة المالك</p>
            <p className="text-sm text-slate-500">نظرة شاملة على أداء جميع الفروع</p>
          </div>
          <Icon name="chevron_left" className="text-slate-400 mr-auto" />
        </Link>
      )}

      {GROUPS.map((group) => (
        <div key={group.label}>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-700 dark:text-slate-300 mb-3">
            <Icon name={group.icon} size={18} className="text-primary" />
            {group.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon name={item.icon} size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{item.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-700 dark:text-slate-300 mb-3">
          <Icon name="history" className="text-lg text-primary" />
          السجلات التفصيلية
        </h2>
        <Link
          to="/reports/detailed"
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-sm transition-all">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="table_view" className="text-primary text-xl" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">السجلات التفصيلية</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">عمليات المشتريات والمبيعات والتحويلات والحضور</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
