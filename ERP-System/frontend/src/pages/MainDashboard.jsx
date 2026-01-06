import React from "react";
import { useNavigate } from "react-router-dom";

const MainDashboardCard = ({
  icon,
  title,
  subtitle,
  onClick,
  colorClass = "text-primary dark:text-accent",
}) => (
  <div
    onClick={onClick}
    className="group relative bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-soft hover:shadow-hover border border-transparent hover:border-primary/20 transition-all duration-300 flex flex-col items-center justify-center text-center h-48 cursor-pointer">
    <div className="absolute inset-0 bg-primary/5 dark:bg-primary/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300 origin-center"></div>
    <div
      className={`h-16 w-16 bg-accent/20 dark:bg-primary/20 ${colorClass} rounded-full flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300 z-10 shadow-sm`}>
      <span className="material-icons-round text-3xl">{icon}</span>
    </div>
    <h3 className="text-lg font-bold text-text-light dark:text-text-dark z-10">
      {title}
    </h3>
    <p className="text-xs text-text-light/60 dark:text-text-dark/60 mt-1 z-10 group-hover:text-primary dark:group-hover:text-accent">
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
    },
    {
      icon: "shopping_cart",
      title: "مشتريات",
      subtitle: "إدارة التوريد",
      onClick: () => navigate("/purchases"),
    },
    {
      icon: "point_of_sale",
      title: "مبيعات",
      subtitle: "فاتورة جديدة",
      onClick: () => navigate("/pos"),
    },
    {
      icon: "inventory_2",
      title: "تحويلات مخزنية",
      subtitle: "نقل البضائع",
      onClick: () => navigate("/stock-transfer"),
    },
    {
      icon: "account_balance_wallet",
      title: "تحويلات الخزائن",
      subtitle: "النقدية والسيولة",
      onClick: () => navigate("/cashier-transfer"),
    },
    {
      icon: "storefront",
      title: "مبيعات الفروع",
      subtitle: "تقارير الفروع",
      onClick: () => navigate("/branches-sales"),
    },
    {
      icon: "fact_check",
      title: "الجرد",
      subtitle: "جرد المخزون",
      onClick: () => navigate("/inventory"),
    },
    {
      icon: "bar_chart",
      title: "تقارير",
      subtitle: "تحليل البيانات",
      onClick: () => navigate("/reports"),
    },
    {
      icon: "receipt_long",
      title: "مصروفات",
      subtitle: "إدارة المصروفات والفواتير",
      onClick: () => navigate("/expenses"),
    },
    {
      icon: "groups",
      title: "موارد بشرية",
      subtitle: "إدارة الموظفين",
      onClick: () => navigate("/hr"),
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
