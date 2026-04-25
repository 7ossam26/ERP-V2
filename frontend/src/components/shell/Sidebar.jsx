import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "../ui/Icon";
import RmxLogo from "./RmxLogo";
import AuthService from "../../services/authService";
import { MODULES } from "../../config/modules";

const GROUPS = [
  { key: "home", label: "الرئيسية", ids: [] },
  {
    key: "setup",
    label: "التكويدات",
    ids: [
      "creates_warehouses", "creates_treasuries", "creates_branches",
      "creates_suppliers", "creates_categories", "creates_items",
      "creates_employees", "creates_delivery_men", "creates_delivery_zones",
      "creates_clients", "creates_production", "creates_fabric_rolls",
    ],
  },
  {
    key: "ops",
    label: "العمليات",
    ids: ["purchases", "pos", "stock_transfer", "cashier_transfer", "supplier_accounts"],
  },
  {
    key: "inventory",
    label: "الجرد",
    ids: ["inventory", "adjustments", "counts", "fabric_rolls"],
  },
  {
    key: "finance",
    label: "المالية",
    ids: ["expenses", "deposits", "transfer_management"],
  },
  {
    key: "reports",
    label: "التقارير",
    ids: ["reports", "owner_dashboard"],
  },
  {
    key: "admin",
    label: "الإدارة",
    ids: ["branches_sales", "hr", "shifts", "delivery_settlement", "settings", "initial_inventory"],
  },
];

const STORAGE_KEY = "rmx_sidebar_pinned";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(pinned)); } catch {}
  }, [pinned]);

  const moduleMap = Object.fromEntries(MODULES.map((m) => [m.id, m]));

  const hasPermission = (mod) => {
    if (!mod.code) return true;
    return AuthService.hasPermission(mod.code);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <aside
      className={`fixed top-0 right-0 z-40 h-screen bg-surface dark:bg-surface-dark border-l border-line dark:border-line-dark flex flex-col transition-all duration-300 ${
        pinned ? "w-sidebar" : "w-sidebar-collapsed"
      }`}
    >
      {/* Logo + pin toggle */}
      <div className="h-topbar flex items-center justify-between px-3 border-b border-line dark:border-line-dark">
        {pinned && (
          <RmxLogo height={26} className="text-ink dark:text-ink-dark" />
        )}
        <button
          onClick={() => setPinned(!pinned)}
          className="mx-auto flex items-center justify-center w-9 h-9 rounded-md hover:bg-accent-light dark:hover:bg-accent-light-dark text-muted hover:text-accent dark:hover:text-accent-dark transition-colors"
          title={pinned ? "طي القائمة" : "تثبيت القائمة"}
        >
          <Icon name={pinned ? "chevron_right" : "menu"} size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {/* Home link */}
        <SidebarItem
          icon="home"
          label="الرئيسية"
          active={isActive("/dashboard")}
          pinned={pinned}
          onClick={() => navigate("/dashboard")}
        />

        {GROUPS.filter((g) => g.key !== "home").map((group) => {
          const items = group.ids
            .map((id) => moduleMap[id])
            .filter((m) => m && hasPermission(m));

          if (items.length === 0) return null;

          return (
            <div key={group.key} className="mt-3">
              {pinned && (
                <div className="px-4 py-1.5 text-[11px] font-bold text-muted dark:text-muted-dark uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              {!pinned && <div className="mx-3 my-1 border-t border-line dark:border-line-dark" />}
              {items.map((mod) => (
                <SidebarItem
                  key={mod.id}
                  icon={mod.icon}
                  label={mod.label}
                  active={isActive(mod.path)}
                  pinned={pinned}
                  onClick={() => navigate(mod.path)}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Bottom: settings shortcut */}
      <div className="border-t border-line dark:border-line-dark p-2">
        <SidebarItem
          icon="settings"
          label="الإعدادات"
          active={isActive("/settings")}
          pinned={pinned}
          onClick={() => navigate("/settings")}
        />
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, active, pinned, onClick }) {
  return (
    <button
      onClick={onClick}
      title={!pinned ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md transition-colors text-sm font-medium ${
        active
          ? "bg-accent text-white"
          : "text-ink dark:text-ink-dark hover:bg-accent-light dark:hover:bg-accent-light-dark hover:text-accent dark:hover:text-accent-dark"
      } ${pinned ? "" : "justify-center"}`}
    >
      <Icon name={icon} size={20} className={active ? "text-white" : ""} />
      {pinned && <span className="truncate">{label}</span>}
    </button>
  );
}
