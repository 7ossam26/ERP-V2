import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { reportService } from "../services/reportService";
import { settingsService } from "../services/settingsService";
import Icon from "../components/ui/Icon";
import RmxLogo from "../components/shell/RmxLogo";

const formatCurrency = (val) => {
  const n = parseFloat(val) || 0;
  return `${n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
};

const KpiCard = ({ icon, label, value, hint, accent, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className="text-right bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-md p-4 hover:border-accent dark:hover:border-accent-dark hover:shadow-soft transition-all disabled:cursor-default"
  >
    <div className="flex items-start justify-between">
      <div className={`p-2.5 rounded-md ${accent}`}>
        <Icon name={icon} size={20} />
      </div>
    </div>
    <p className="text-xs text-muted dark:text-muted-dark mt-3 font-medium">{label}</p>
    <p className="text-2xl font-bold text-ink dark:text-ink-dark mt-1 tabular-nums">
      {loading ? <span className="inline-block w-20 h-7 bg-line dark:bg-line-dark rounded animate-pulse" /> : value}
    </p>
    {hint && <p className="text-[11px] text-muted dark:text-muted-dark mt-1">{hint}</p>}
  </button>
);

const QuickAction = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2 p-4 rounded-md bg-surface dark:bg-surface-dark border border-line dark:border-line-dark hover:border-accent hover:bg-accent-light dark:hover:bg-accent-light-dark text-ink dark:text-ink-dark hover:text-accent dark:hover:text-accent-dark transition-all"
  >
    <Icon name={icon} size={22} />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const AVAILABLE_QUICK_ACTIONS = [
  { id: "POS", perm: "POS", icon: "point_of_sale", label: "فاتورة جديدة", path: "/pos" },
  { id: "PURCHASES", perm: "PURCHASES", icon: "shopping_cart", label: "مشتريات", path: "/purchases" },
  { id: "INVENTORY_COUNT", perm: "INVENTORY_COUNT", icon: "fact_check", label: "الجرد", path: "/inventory" },
  { id: "REPORTS", perm: "REPORTS", icon: "bar_chart", label: "التقارير", path: "/reports" },
  { id: "STOCK_TRANSFER", perm: "STOCK_TRANSFER", icon: "swap_horiz", label: "تحويل مخزني", path: "/stock-transfer" },
  { id: "EXPENSES", perm: "EXPENSES", icon: "receipt_long", label: "مصروفات", path: "/expenses" },
];

const AVAILABLE_REPORT_SHORTCUTS = [
  { id: "sales_daily", perm: "REPORTS", icon: "today", label: "المبيعات اليومية", path: "/reports/sales/daily" },
  { id: "reports_general", perm: "REPORTS", icon: "insights", label: "التقرير العام", path: "/reports/general" },
  { id: "reports_detailed", perm: "REPORTS", icon: "summarize", label: "التقارير التفصيلية", path: "/reports/detailed" },
  { id: "history_sales", perm: "REPORTS", icon: "receipt_long", label: "سجل المبيعات", path: "/reports/custom/daily-transactions" },
  { id: "owner_dashboard", perm: "OWNER_DASHBOARD", icon: "dashboard", label: "لوحة المالك", path: "/dashboard/owner" },
];

export default function MainDashboard() {
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();
  const hasOwnerDashboard = AuthService.hasPermission("OWNER_DASHBOARD");
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState({
    dashboardQuickActions: [],
    dashboardReports: [],
  });

  useEffect(() => {
    settingsService
      .get()
      .then((settings) => {
        setDashboardSettings({
          dashboardQuickActions: Array.isArray(settings?.dashboardQuickActions) ? settings.dashboardQuickActions : [],
          dashboardReports: Array.isArray(settings?.dashboardReports) ? settings.dashboardReports : [],
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasOwnerDashboard) return;
    setLoading(true);
    reportService
      .getOwnerDashboard()
      .then((data) => setKpis(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hasOwnerDashboard]);

  const treasurySum =
    kpis?.treasuries?.reduce((s, t) => s + parseFloat(t.balance || 0), 0) || 0;

  const defaultQuickActionIds = AVAILABLE_QUICK_ACTIONS.map((item) => item.id);
  const selectedQuickActionIds =
    dashboardSettings.dashboardQuickActions.length > 0 ? dashboardSettings.dashboardQuickActions : defaultQuickActionIds;
  const quickActions = AVAILABLE_QUICK_ACTIONS
    .filter((a) => selectedQuickActionIds.includes(a.id))
    .filter((a) => AuthService.hasPermission(a.perm));

  const defaultReportShortcutIds = AVAILABLE_REPORT_SHORTCUTS.map((item) => item.id);
  const selectedReportShortcutIds =
    dashboardSettings.dashboardReports.length > 0 ? dashboardSettings.dashboardReports : defaultReportShortcutIds;
  const reportShortcuts = AVAILABLE_REPORT_SHORTCUTS
    .filter((item) => selectedReportShortcutIds.includes(item.id))
    .filter((item) => AuthService.hasPermission(item.perm));
  const todayLabel = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="w-full max-w-content mx-auto">
      {/* Welcome */}
      <div className="flex flex-col items-center justify-center text-center gap-4 mb-8">
        <div className="w-full">
          <span className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark font-bold block mb-2">
            لوحة التحكم
          </span>
          <div className="flex items-center justify-center gap-2">
            <RmxLogo className="text-accent w-10 h-10" />
            <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark">
              مرحباً{user?.name ? `، ${user.name}` : ""}
            </h1>
          </div>
          <p className="text-sm text-muted dark:text-muted-dark mt-1">
            نظرة سريعة على حالة المتجر — استخدم القائمة الجانبية للتنقل بين الأقسام.
          </p>
          <p className="text-xs text-muted dark:text-muted-dark mt-2">{todayLabel}</p>
        </div>
        {hasOwnerDashboard && (
          <div className="w-full bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-md p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-right rounded-md border border-line dark:border-line-dark p-3">
                <p className="text-xs text-muted dark:text-muted-dark mb-1">مبيعات اليوم</p>
                <p className="text-lg font-bold text-ink dark:text-ink-dark">
                  {loading ? "..." : formatCurrency(kpis?.today?.total)}
                </p>
              </div>
              <div className="text-right rounded-md border border-line dark:border-line-dark p-3">
                <p className="text-xs text-muted dark:text-muted-dark mb-1">الفواتير اليوم</p>
                <p className="text-lg font-bold text-ink dark:text-ink-dark">
                  {loading ? "..." : (kpis?.today?.count ?? 0).toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="text-right rounded-md border border-line dark:border-line-dark p-3">
                <p className="text-xs text-muted dark:text-muted-dark mb-1">تنبيهات المخزون</p>
                <p className="text-lg font-bold text-ink dark:text-ink-dark">
                  {loading ? "..." : (kpis?.reorderAlertCount ?? 0).toLocaleString("ar-EG")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {reportShortcuts.length > 0 && (
        <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-md p-5 mb-6">
          <h2 className="text-xs font-bold text-muted dark:text-muted-dark uppercase tracking-wider mb-4">
            التقارير السريعة
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {reportShortcuts.map((report) => (
              <QuickAction
                key={report.id}
                icon={report.icon}
                label={report.label}
                onClick={() => navigate(report.path)}
              />
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {hasOwnerDashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <KpiCard
            icon="point_of_sale"
            label="مبيعات اليوم"
            value={formatCurrency(kpis?.today?.total)}
            accent="bg-accent-light dark:bg-accent-light-dark text-accent dark:text-accent-dark"
            loading={loading}
            onClick={() => AuthService.hasPermission("REPORTS") && navigate("/reports/sales/daily")}
          />
          <KpiCard
            icon="account_balance"
            label="رصيد الخزائن"
            value={formatCurrency(treasurySum)}
            accent="bg-success/10 text-success"
            loading={loading}
            onClick={() => AuthService.hasPermission("CREATES_TREASURIES") && navigate("/treasuries")}
          />
          <KpiCard
            icon="warning"
            label="تنبيهات نقص المخزون"
            value={(kpis?.reorderAlertCount ?? 0).toLocaleString("ar-EG")}
            hint="أصناف وصلت لحد إعادة الطلب"
            accent="bg-warning/10 text-warning"
            loading={loading}
            onClick={() => navigate("/inventory/alerts")}
          />
          <KpiCard
            icon="schedule"
            label="ورديات تنتظر المراجعة"
            value={(kpis?.pendingShiftReviews ?? 0).toLocaleString("ar-EG")}
            accent="bg-danger/10 text-danger"
            loading={loading}
            onClick={() => AuthService.hasPermission("SHIFTS") && navigate("/shifts")}
          />
        </div>
      )}

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-md p-5">
          <h2 className="text-xs font-bold text-muted dark:text-muted-dark uppercase tracking-wider mb-4">
            إجراءات سريعة
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((a) => (
              <QuickAction
                key={a.perm}
                icon={a.icon}
                label={a.label}
                onClick={() => navigate(a.path)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for users with no permissions */}
      {!hasOwnerDashboard && quickActions.length === 0 && (
        <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-md p-8 text-center">
          <Icon name="dashboard" size={48} className="mx-auto text-muted dark:text-muted-dark mb-3" />
          <p className="text-muted dark:text-muted-dark">
            استخدم القائمة الجانبية للتنقل إلى الأقسام المتاحة لك.
          </p>
        </div>
      )}
    </div>
  );
}
