import React from "react";
import { Link } from "react-router-dom";
import BrandNavigationCard from "../../components/common/BrandNavigationCard";

const DetailedReportsPage = () => {
  const reports = [
    {
      title: "سجل السلف",
      description: "تتبع سلف الموظفين",
      icon: "payments",
      path: "/reports/custom/advance-payments",
    },
    {
      title: "سجل تحويلات الخزينة",
      description: "حركة الأموال بين الخزائن",
      icon: "account_balance",
      path: "/reports/custom/cash-transfers",
    },
    {
      title: "سجل الإنشاءات",
      description: "تاريخ إنشاء السجلات",
      icon: "history_edu",
      path: "/reports/custom/creations",
    },
    {
      title: "سجل المبيعات",
      description: "سجل المبيعات والفواتير",
      icon: "receipt_long",
      path: "/reports/custom/daily-transactions",
    },
    {
      title: "سجل الخصومات",
      description: "تاريخ الخصومات على الموظفين",
      icon: "money_off",
      path: "/reports/custom/deductions",
    },
    {
      title: "سجل المشتريات",
      description: "أرشيف فواتير الشراء",
      icon: "shopping_cart",
      path: "/reports/custom/purchases",
    },
    {
      title: "سجل تحويلات المخزون",
      description: "حركة الأصناف بين المخازن",
      icon: "inventory",
      path: "/reports/custom/stock-transfers",
    },
    {
      title: "سجل الإنتاج",
      description: "عمليات التصنيع والإنتاج",
      icon: "factory",
      path: "/bom/production-history",
    },
    {
      title: "سجل المصروفات",
      description: "تاريخ المصروفات المنصرفة",
      icon: "paid",
      path: "/expenses",
    },
    {
      title: "سجل الإيداعات والسحوبات",
      description: "عمليات الإيداع والسحب للخزائن",
      icon: "currency_exchange",
      path: "/deposits",
    },
  ];

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">
              التقارير التفصيلية
            </h1>
            <p className="text-text-light/60 dark:text-text-dark/60 mt-2">
              عرض سجلات التاريخ والعمليات السابقة
            </p>
          </div>
          <Link
            to="/reports"
            className="flex items-center gap-2 text-primary hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors">
            <span className="material-symbols-outlined">arrow_forward</span>
            <span>عودة للتقارير</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, index) => (
            <BrandNavigationCard
              key={index}
              to={report.path}
              icon={report.icon}
              title={report.title}
              description={report.description}
              seed={report.path}
              iconStyle="symbols"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DetailedReportsPage;
