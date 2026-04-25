import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "../ui/Icon";
import RmxLogo from "./RmxLogo";
import AuthService from "../../services/authService";
import { MODULES } from "../../config/modules";

const GROUPS = [
  {
    key: "setup",
    label: "التكويدات",
    ids: [
      "creates_warehouses", "creates_treasuries", "creates_branches",
      "creates_suppliers", "creates_categories", "creates_items",
      "creates_employees", "creates_clients", "creates_fabric_rolls",
    ],
  },
  {
    key: "ops",
    label: "العمليات",
    ids: ["purchases", "pos", "stock_transfer", "cashier_transfer", "supplier_accounts"],
  },
  {
    key: "inventory",
    label: "المخزون",
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
    ids: ["branches_sales", "hr", "shifts", "initial_inventory"],
  },
];

const PIN_KEY = "rmx_sidebar_pinned";

const defaultExpanded = Object.fromEntries(GROUPS.map((g) => [g.key, false]));

export default function Sidebar({ pinned: pinnedProp, onPinnedChange, onHoverChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedState, setPinnedState] = useState(() => {
    try { return localStorage.getItem(PIN_KEY) === "true"; } catch { return false; }
  });
  const [expandedGroups, setExpandedGroups] = useState(defaultExpanded);
  const pinned = typeof pinnedProp === "boolean" ? pinnedProp : pinnedState;
  const sidebarExpanded = pinned || hoverOpen;

  const setPinned = (value) => {
    const resolved = typeof value === "function" ? value(pinned) : value;
    setPinnedState(resolved);
    onPinnedChange?.(resolved);
  };

  useEffect(() => {
    try { localStorage.setItem(PIN_KEY, String(pinned)); } catch {}
  }, [pinned]);


  useEffect(() => {
    onHoverChange?.(hoverOpen);
  }, [hoverOpen, onHoverChange]);

  const moduleMap = Object.fromEntries(MODULES.map((m) => [m.id, m]));

  const hasPermission = (mod) => {
    if (!mod.code) return true;
    return AuthService.hasPermission(mod.code);
  };

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isGroupActive = (items) => items.some((mod) => isActive(mod.path));

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside
      onMouseEnter={() => !pinned && setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
      className={`fixed top-0 right-0 z-40 h-screen bg-surface dark:bg-surface-dark border-l border-line dark:border-line-dark flex flex-col transition-all duration-300 ${
        sidebarExpanded ? "w-sidebar" : "w-sidebar-collapsed"
      }`}
    >
      <div className="h-topbar flex items-center gap-2 px-2 border-b border-line dark:border-line-dark overflow-hidden">
        {sidebarExpanded && (
          <RmxLogo className="text-ink dark:text-ink-dark mr-2" />
        )}
        <button
          onClick={() => {
            setPinned(!pinned);
            if (pinned) setHoverOpen(false);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent-light dark:hover:bg-accent-light-dark text-muted hover:text-accent dark:hover:text-accent-dark transition-colors shrink-0 mr-auto"
          title={pinned ? "إلغاء تثبيت القائمة" : "تثبيت القائمة"}
        >
          <Icon name={pinned ? "push_pin" : "menu"} size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1.5 scrollbar-hide">
        <SidebarItem
          icon="home"
          label="الرئيسية"
          active={isActive("/dashboard")}
          expanded={sidebarExpanded}
          onClick={() => navigate("/dashboard")}
        />

        {GROUPS.map((group) => {
          const items = group.ids
            .map((id) => moduleMap[id])
            .filter((m) => m && hasPermission(m));

          if (items.length === 0) return null;

          const groupIsExpanded = expandedGroups[group.key] ?? true;

          return (
            <div key={group.key} className="mt-1">
              <div className="mx-3 my-1.5 border-t border-line dark:border-line-dark opacity-60" />

              {sidebarExpanded ? (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={`w-[calc(100%-8px)] mx-1 flex items-center justify-between px-2.5 py-1 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
                    isGroupActive(items)
                      ? "text-accent dark:text-accent-dark"
                      : "text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark"
                  }`}
                >
                  <span className="font-bold">{group.label}</span>
                  <Icon name={groupIsExpanded ? "expand_less" : "chevron_left"} size={16} />
                </button>
              ) : null}

              {(groupIsExpanded || !sidebarExpanded) && items.map((mod) => (
                <SidebarItem
                  key={mod.id}
                  icon={mod.icon}
                  label={mod.label}
                  active={isActive(mod.path)}
                  expanded={sidebarExpanded}
                  onClick={() => navigate(mod.path)}
                />
              ))}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line dark:border-line-dark p-1.5">
        <SidebarItem
          icon="settings"
          label="الإعدادات"
          active={isActive("/settings")}
          expanded={sidebarExpanded}
          onClick={() => navigate("/settings")}
        />
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, active, expanded, onClick }) {
  return (
    <button
      onClick={onClick}
      title={!expanded ? label : undefined}
      className={`w-[calc(100%-8px)] flex items-center gap-2.5 px-2.5 py-1.5 mx-1 rounded-md transition-colors text-[13px] font-medium ${
        active
          ? "bg-accent text-white"
          : "text-ink dark:text-ink-dark hover:bg-accent-light dark:hover:bg-accent-light-dark hover:text-accent dark:hover:text-accent-dark"
      } ${expanded ? "" : "justify-center"}`}
    >
      <Icon name={icon} size={18} className={active ? "text-white" : ""} />
      {expanded && <span className="truncate">{label}</span>}
    </button>
  );
}
