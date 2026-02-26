import React from "react";
import { Link } from "react-router-dom";

const DetailedReportsPage = () => {
  const reports = [
    {
      title: "سجل السلف",
      description: "تتبع سلف الموظفين",
      icon: "payments",
      path: "/reports/custom/advance-payments",
      color: "text-blue-600",
      bg: "bg-blue-100",
      darkBg: "dark:bg-blue-900/20",
    },
    {
      title: "سجل تحويلات الخزينة",
      description: "حركة الأموال بين الخزائن",
      icon: "account_balance",
      path: "/reports/custom/cash-transfers",
      color: "text-green-600",
      bg: "bg-green-100",
      darkBg: "dark:bg-green-900/20",
    },
    {
      title: "سجل الإنشاءات",
      description: "تاريخ إنشاء السجلات",
      icon: "history_edu",
      path: "/reports/custom/creations",
      color: "text-purple-600",
      bg: "bg-purple-100",
      darkBg: "dark:bg-purple-900/20",
    },
    {
      title: "سجل المبيعات",
      description: "سجل المبيعات والفواتير",
      icon: "receipt_long",
      path: "/reports/custom/daily-transactions",
      color: "text-orange-600",
      bg: "bg-orange-100",
      darkBg: "dark:bg-orange-900/20",
    },
    {
      title: "سجل الخصومات",
      description: "تاريخ الخصومات على الموظفين",
      icon: "money_off",
      path: "/reports/custom/deductions",
      color: "text-red-600",
      bg: "bg-red-100",
      darkBg: "dark:bg-red-900/20",
    },
    {
      title: "سجل المشتريات",
      description: "أرشيف فواتير الشراء",
      icon: "shopping_cart",
      path: "/reports/custom/purchases",
      color: "text-teal-600",
      bg: "bg-teal-100",
      darkBg: "dark:bg-teal-900/20",
    },
    {
      title: "سجل تحويلات المخزون",
      description: "حركة الأصناف بين المخازن",
      icon: "inventory",
      path: "/reports/custom/stock-transfers",
      color: "text-indigo-600",
      bg: "bg-indigo-100",
      darkBg: "dark:bg-indigo-900/20",
    },
    {
      title: "سجل الإنتاج",
      description: "عمليات التصنيع والإنتاج",
      icon: "factory",
      path: "/bom/production-history",
      color: "text-pink-600",
      bg: "bg-pink-100",
      darkBg: "dark:bg-pink-900/20",
    },
    {
      title: "سجل المصروفات",
      description: "تاريخ المصروفات المنصرفة",
      icon: "paid",
      path: "/expenses",
      color: "text-cyan-600",
      bg: "bg-cyan-100",
      darkBg: "dark:bg-cyan-900/20",
    },
    {
      title: "سجل الإيداعات والسحوبات",
      description: "عمليات الإيداع والسحب للخزائن",
      icon: "currency_exchange",
      path: "/deposits",
      color: "text-lime-600",
      bg: "bg-lime-100",
      darkBg: "dark:bg-lime-900/20",
    },
  ];

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
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

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, index) => (
            <Link
              key={index}
              to={report.path}
              className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark hover:shadow-md hover:border-primary/30 transition-all group flex items-start gap-4">
              <div
                className={`p-3 rounded-lg ${report.bg} ${report.darkBg} ${report.color} group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-3xl">
                  {report.icon}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 group-hover:text-primary transition-colors">
                  {report.title}
                </h3>
                <p className="text-sm text-text-light/60 dark:text-text-dark/60">
                  {report.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DetailedReportsPage;
