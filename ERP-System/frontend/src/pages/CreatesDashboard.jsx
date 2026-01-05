import React from "react";
import { useNavigate } from "react-router-dom";

const DashboardCard = ({ icon, title, description, onClick }) => (
  <div
    onClick={onClick}
    className="group relative flex flex-col items-center justify-center w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] h-48 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-soft dark:shadow-soft-dark border border-transparent hover:border-primary/20 transition-all duration-300 cursor-pointer hover:-translate-y-1">
    <div className="w-16 h-16 rounded-full bg-accent/20 dark:bg-accent/10 text-primary dark:text-accent flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
      <span className="material-icons-round text-4xl">{icon}</span>
    </div>
    <h3 className="text-xl font-bold text-text-light dark:text-text-dark group-hover:text-primary transition-colors">
      {title}
    </h3>
    <p className="text-xs text-text-light/50 dark:text-text-dark/50 mt-1">
      {description}
    </p>
  </div>
);

const CreatesDashboard = () => {
  const navigate = useNavigate();

  const cards = [
    {
      icon: "badge",
      title: "الموظف",
      description: "إدارة بيانات الموظفين",
      onClick: () => navigate("/employees"),
    },
    {
      icon: "local_shipping",
      title: "المورد",
      description: "سجلات الموردين والشركاء",
      onClick: () => navigate("/suppliers"),
    },
    {
      icon: "groups",
      title: "العملاء",
      description: "قاعدة بيانات العملاء",
      onClick: () => navigate("/clients"),
    },
    {
      icon: "inventory_2",
      title: "الأصناف",
      description: "المنتجات والأسعار",
      onClick: () => navigate("/items"),
    },
    {
      icon: "warehouse",
      title: "المخازن",
      description: "الجرد والمستودعات",
      onClick: () => navigate("/warehouses"),
    },
    {
      icon: "category",
      title: "التصنيفات",
      description: "إدارة فئات المنتجات",
      onClick: () => navigate("/categories"),
    },
    {
      icon: "savings",
      title: "الخزائن",
      description: "المالية والنقدية",
      onClick: () => navigate("/treasuries"),
    },
    {
      icon: "storefront",
      title: "الفروع",
      description: "إعدادات فروع المتجر",
      onClick: () => navigate("/branches"),
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-extrabold text-primary dark:text-text-dark mb-2">
          التكويدات
        </h2>
        <div className="h-1.5 w-24 bg-primary mx-auto rounded-full opacity-80"></div>
        <p className="mt-4 text-text-light/70 dark:text-text-dark/70 max-w-lg mx-auto">
          إدارة البيانات الأساسية للنظام، بما في ذلك الموظفين، المخازن،
          والأصناف.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-6">
        {cards.map((card, index) => (
          <DashboardCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
};

export default CreatesDashboard;
