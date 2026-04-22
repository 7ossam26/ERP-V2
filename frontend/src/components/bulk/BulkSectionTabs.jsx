import React from "react";
import { NavLink } from "react-router-dom";

const TABS = [
  { label: "نقطة البيع", path: "/bulk/pos" },
  { label: "التحصيلات", path: "/bulk/collections" },
  { label: "الطلبات", path: "/bulk/orders" },
];

export default function BulkSectionTabs() {
  return (
    <div className="flex items-center gap-1 border-b border-border-light dark:border-border-dark mb-4">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            `pb-2 px-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
              isActive
                ? "border-primary text-primary dark:text-accent"
                : "border-transparent text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
