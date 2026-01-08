import AuthService from "../services/authService";

// ... (MainDashboardCard component remains the same)

const MainDashboard = () => {
  const navigate = useNavigate();

  const cards = [
    {
      icon: "qr_code_2",
      title: "تكويدات",
      subtitle: "إدارة الأصناف",
      onClick: () => navigate("/creates"),
      // Creates dashboard has sub-modules. We might need a general permission or check if any sub-module is visible.
      // For now, let's assume if they can view ITEMS or CATEGORIES etc they can see this.
      // Or maybe there is a 'SETTINGS' or 'CREATES' module? 
      // The MODULES list had: "CATEGORIES", "ITEMS", "WAREHOUSES", "BRANCHES", "EMPLOYEES", "SUPPLIERS", "CLIENTS", "TREASURIES"
      // Let's make it visible if they have at least one of these permissions.
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
      // Expenses didn't have a specific module in MODULES list?
      // "TREASURIES" or "REPORTS" or just accessible?
      // Assuming TREASURIES for now or maybe it's open.
      // Let's leave it open or map to TREASURIES.
      permission: { module: "TREASURIES", action: "view" }
    },
    {
      icon: "groups",
      title: "موارد بشرية",
      subtitle: "إدارة الموظفين",
      onClick: () => navigate("/hr"),
      permission: { module: "HR", action: "view" }
    },
  ];

  const visibleCards = cards.filter(card => {
    if (!card.permission) return true;

    if (card.permission.type === "some") {
      return card.permission.permissions.some(p => AuthService.hasPermission(p.module, p.action));
    }

    return AuthService.hasPermission(card.permission.module, card.permission.action);
  });

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
        {visibleCards.map((card, index) => (
          <MainDashboardCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
};

export default MainDashboard;
