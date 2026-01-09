import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";

const MainDashboardCard = ({ icon, title, subtitle, onClick }) => (
  <div
    onClick={onClick}
    className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-border-light dark:border-border-dark group flex flex-col items-center text-center h-full hover:-translate-y-1 relative overflow-hidden"
  >
    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300 relative z-10">
      <span className="material-icons-round text-3xl">{icon}</span>
    </div>
    <h3 className="text-xl font-bold text-text-light dark:text-text-dark mb-2 group-hover:text-primary transition-colors relative z-10">
      {title}
    </h3>
    <p className="text-sm text-text-light/60 dark:text-text-dark/60 relative z-10">
      {subtitle}
    </p>
  </div>
);

const MainDashboard = () => {
  const navigate = useNavigate();

  const cards = [
    {
      icon: "qr_code_2",
      title: "تكويدات",
      subtitle: "إدارة الأصناف",
      onClick: () => navigate("/creates"),
      permission: {
        type: "some", permissions: [
          { module: "ITEMS", action: "view" },
          { module: "CATEGORIES", action: "view" },
          { module: "WAREHOUSES", action: "view" },
          { module: "BRANCHES", action: "view" },
          { module: "EMPLOYEES", action: "view" },
          { module: "SUPPLIERS", action: "view" },
          { module: "CLIENTS", action: "view" },
          { module: "TREASURIES", action: "view" }
        ]
      }
    },
    {
      icon: "shopping_cart",
      title: "مشتريات",
      subtitle: "إدارة التوريد",
      onClick: () => navigate("/purchases"),
      permission: { module: "PURCHASES", action: "view" }
    },
    {
      icon: "point_of_sale",
      title: "مبيعات",
      subtitle: "فاتورة جديدة",
      onClick: () => navigate("/pos"),
      permission: { module: "POS", action: "view" }
    },
    {
      icon: "inventory_2",
      title: "تحويلات مخزنية",
      subtitle: "نقل البضائع",
      onClick: () => navigate("/stock-transfer"),
      permission: { module: "INVENTORY", action: "view" }
    },
    {
      icon: "account_balance_wallet",
      title: "تحويلات الخزائن",
      subtitle: "النقدية والسيولة",
      onClick: () => navigate("/cashier-transfer"),
      permission: { module: "TREASURIES", action: "view" }
    },
    {
      icon: "storefront",
      title: "مبيعات الفروع",
      subtitle: "تقارير الفروع",
      onClick: () => navigate("/branches-sales"),
      permission: { module: "BRANCHES", action: "view" }
    },
    {
      icon: "fact_check",
      title: "الجرد",
      subtitle: "جرد المخزون",
      onClick: () => navigate("/inventory"),
      permission: { module: "INVENTORY", action: "view" }
    },
    {
      icon: "bar_chart",
      title: "تقارير",
      subtitle: "تحليل البيانات",
      onClick: () => navigate("/reports"),
      permission: { module: "REPORTS", action: "view" }
    },
    {
      icon: "receipt_long",
      title: "مصروفات",
      subtitle: "إدارة المصروفات والفواتير",
      onClick: () => navigate("/expenses"),
      permission: { module: "TREASURIES", action: "view" }
    },
    {
      icon: "groups",
      title: "موارد بشرية",
      subtitle: "إدارة الموظفين",
      onClick: () => navigate("/hr"),
      permission: { module: "HR", action: "view" }
    },
    {
      icon: "settings",
      title: "الإعدادات",
      subtitle: "إعدادات النظام",
      onClick: () => navigate("/settings"),
    },
    {
      icon: "manage_accounts",
      title: "إدارة التحويلات",
      subtitle: "قبول ورفض التحويلات",
      onClick: () => navigate("/transfer-management"),
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto relative">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-5 dark:opacity-5">
        <span className="material-icons-round absolute top-10 left-10 text-9xl text-primary transform -rotate-12">
          local_cafe
        </span>
        <span className="material-icons-round absolute bottom-20 right-20 text-9xl text-primary transform rotate-12">
          coffee_maker
        </span>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-text-light dark:text-text-dark mb-2">
          الصفحة الرئيسية
        </h2>
        <div className="h-1.5 w-24 bg-primary mx-auto rounded-full opacity-80"></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <MainDashboardCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
};

export default MainDashboard;
