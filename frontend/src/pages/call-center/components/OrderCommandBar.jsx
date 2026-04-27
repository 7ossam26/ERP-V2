import React from "react";
import { HelpCircle, AlertCircle } from "lucide-react";

const Segment = ({ label, value, amber, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1 rounded-md hover:bg-primary/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    {amber && <AlertCircle size={12} className="text-stock-low flex-shrink-0" />}
    <span className="text-xs text-text-light/60 dark:text-text-dark/60">{label}:</span>
    <span className={`text-xs font-semibold tabular-nums ${amber ? "text-text-light/40 dark:text-text-dark/40" : "text-text-light dark:text-text-dark"}`}>
      {value}
    </span>
  </button>
);

const Divider = () => (
  <span className="text-border-light dark:text-border-dark text-sm select-none">·</span>
);

const OrderCommandBar = ({
  branch,
  customer,
  itemCount,
  total,
  onJumpToBranch,
  onJumpToCustomer,
  onJumpToCart,
  onShowShortcuts,
}) => {
  return (
    <header
      role="status"
      aria-label="حالة الطلب الحالي"
      className="sticky top-0 z-30 flex items-center justify-between px-6 h-12 bg-surface-raised dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-soft"
    >
      <div className="flex items-center gap-1 flex-wrap">
        <Segment
          label="الفرع"
          value={branch?.name ?? "—"}
          amber={!branch}
          onClick={onJumpToBranch}
        />
        <Divider />
        <Segment
          label="العميل"
          value={customer ? `${customer.name}${customer.totalOrders ? ` (${customer.totalOrders} طلبات)` : ""}` : "—"}
          amber={!customer}
          onClick={onJumpToCustomer}
        />
        <Divider />
        <Segment
          label="الأصناف"
          value={itemCount > 0 ? String(itemCount) : "—"}
          amber={itemCount === 0}
          onClick={onJumpToCart}
        />
        <Divider />
        <Segment
          label="الإجمالي"
          value={`${Number(total).toFixed(2)} ج.م`}
          amber={false}
          onClick={onJumpToCart}
        />
      </div>

      <button
        type="button"
        onClick={onShowShortcuts}
        aria-label="اختصارات لوحة المفاتيح"
        className="p-1.5 rounded-md text-text-light/50 dark:text-text-dark/50 hover:text-primary hover:bg-primary/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <HelpCircle size={16} />
      </button>
    </header>
  );
};

export default OrderCommandBar;
