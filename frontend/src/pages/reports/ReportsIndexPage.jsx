import React from "react";
import AuthService from "../../services/authService";
import BrandNavigationCard from "../../components/common/BrandNavigationCard";

const GROUPS = [
  {
    label: "المبيعات",
    icon: "point_of_sale",
    items: [
      {
        label: "المبيعات اليومية",
        desc: "مبيعات مجمعة يومياً / أسبوعياً / شهرياً",
        icon: "show_chart",
        path: "/reports/sales/daily",
      },
      {
        label: "مبيعات حسب المحور",
        desc: "تقسيم حسب الفرع / الشريحة / التصنيف / طريقة الدفع",
        icon: "pie_chart",
        path: "/reports/sales/by-dimension",
      },
      {
        label: "هامش الربح بالصنف",
        desc: "الإيراد والتكلفة والهامش لكل صنف",
        icon: "trending_up",
        path: "/reports/margin-by-sku",
      },
      {
        label: "الأكثر مبيعاً",
        desc: "أعلى الأصناف إيراداً أو كمية",
        icon: "leaderboard",
        path: "/reports/top-movers",
      },
    ],
  },
  {
    label: "المخزون",
    icon: "warehouse",
    items: [
      {
        label: "المخزون الراكد",
        desc: "أصناف لم تُباع خلال فترة محددة",
        icon: "inventory",
        path: "/reports/dead-stock",
      },
    ],
  },
  {
    label: "الأقمشة",
    icon: "texture",
    items: [
      {
        label: "متبقي الأقمشة",
        desc: "الأمتار المتبقية لكل صنف قماش",
        icon: "straighten",
        path: "/reports/fabric/remaining-meters",
      },
      {
        label: "لفات الأقمشة حسب العمر",
        desc: "تصنيف اللفات حسب عمرها في المخزون",
        icon: "schedule",
        path: "/reports/fabric/rolls-by-age",
      },
    ],
  },
  {
    label: "الورديات",
    icon: "manage_accounts",
    items: [
      {
        label: "تسوية الورديات",
        desc: "مقارنة الرصيد المتوقع بالفعلي لكل وردية",
        icon: "account_balance_wallet",
        path: "/reports/shift-reconciliation",
      },
    ],
  },
];

export default function ReportsIndexPage() {
  const hasOwnerDashboard = AuthService.hasPermission("OWNER_DASHBOARD");

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-2xl">bar_chart</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">التقارير والسجلات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">اختر التقرير الذي تريد عرضه</p>
        </div>
      </div>

      {hasOwnerDashboard && (
        <BrandNavigationCard
          to="/dashboard/owner"
          icon="dashboard_customize"
          title="لوحة المالك"
          description="نظرة شاملة على أداء جميع الفروع"
          seed="owner-dashboard"
        />
      )}

      {GROUPS.map((group) => (
        <div key={group.label}>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-700 dark:text-slate-300 mb-3">
            <span className="material-icons-round text-lg text-primary">{group.icon}</span>
            {group.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((item) => (
              <BrandNavigationCard
                key={item.path}
                to={item.path}
                icon={item.icon}
                title={item.label}
                description={item.desc}
                seed={item.path}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-700 dark:text-slate-300 mb-3">
          <span className="material-icons-round text-lg text-primary">history</span>
          السجلات التفصيلية
        </h2>
        <BrandNavigationCard
          to="/reports/detailed"
          icon="table_view"
          title="السجلات التفصيلية"
          description="عمليات المشتريات والمبيعات والتحويلات والحضور"
          seed="reports-history"
        />
      </div>
    </div>
  );
}
