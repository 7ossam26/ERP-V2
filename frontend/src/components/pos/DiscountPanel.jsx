import React from "react";
import { roundMoney } from "../../utils/money";

export const DEFAULT_DISCOUNT_REASONS = [
  { code: "STAFF_DISCOUNT", label: "خصم موظف",     customerLabel: "خصم موظف" },
  { code: "LOYAL_CUSTOMER", label: "عميل مميز",    customerLabel: "خصم عميل مميز" },
  { code: "DAMAGED_ITEM",   label: "منتج تالف",    customerLabel: "خصم منتج تالف" },
  { code: "MANAGER_COMP",   label: "مجاملة إدارة", customerLabel: "خصم إداري" },
  { code: "PROMO",          label: "عرض ترويجي",   customerLabel: "عرض ترويجي" },
  { code: "OTHER",          label: "أخرى",         customerLabel: "خصم" },
];

export const DISCOUNT_REASONS = DEFAULT_DISCOUNT_REASONS;

export const reasonLabel = (code, reasons = DEFAULT_DISCOUNT_REASONS) => {
  const r = reasons.find((x) => x.code === code);
  return r ? r.label : code || "";
};

export const computeDiscountAmount = (subtotal, type, value) => {
  const s = Number(subtotal) || 0;
  const v = Number(value) || 0;
  if (s <= 0 || v <= 0) return 0;
  if (type === "PERCENTAGE") {
    const pct = Math.min(100, v);
    return roundMoney(Math.min(s, (s * pct) / 100));
  }
  return roundMoney(Math.min(s, v));
};

const DiscountPanel = ({
  subtotal = 0,
  discountType = "PERCENTAGE",
  discountValue = "",
  discountReason = "",
  onChange,
  disabled = false,
  className = "",
  compact = false,
  reasons = DEFAULT_DISCOUNT_REASONS,
}) => {
  const update = (patch) => {
    if (!onChange) return;
    onChange({ discountType, discountValue, discountReason, ...patch });
  };

  const clear = () => update({ discountType: "PERCENTAGE", discountValue: "", discountReason: "" });

  const isDisabled = disabled || !(Number(subtotal) > 0);
  const hasValue   = Number(discountValue) > 0;
  const discountAmt = computeDiscountAmount(subtotal, discountType, discountValue);

  return (
    <div className={`flex flex-col gap-2 ${className}`} dir="rtl">
      {/* Row: label + type toggle + value input */}
      <div className="flex items-center gap-2">
        <label className={`text-xs whitespace-nowrap font-bold ${compact ? "text-gray-500" : "text-gray-600 dark:text-gray-300"}`}>
          الخصم
        </label>

        {/* Type toggle pill */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-bold shrink-0">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => update({ discountType: "PERCENTAGE", discountValue: "" })}
            className={`px-2.5 py-1.5 transition-colors disabled:opacity-40 ${
              discountType === "PERCENTAGE"
                ? "bg-primary text-white"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}>
            %
          </button>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => update({ discountType: "VALUE", discountValue: "" })}
            className={`px-2.5 py-1.5 border-r border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-40 ${
              discountType === "VALUE"
                ? "bg-primary text-white"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}>
            ج.م
          </button>
        </div>

        {/* Input + clear */}
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            step="0.01"
            value={discountValue}
            onChange={(e) => update({ discountValue: e.target.value })}
            placeholder={isDisabled ? "أضف منتجاً أولاً" : "0"}
            disabled={isDisabled}
            className="w-full h-8 px-3 pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-40 disabled:bg-gray-50 dark:disabled:bg-gray-900 transition-colors tabular-nums"
          />
          {hasValue && !isDisabled && (
            <button
              type="button"
              onClick={clear}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
              title="إزالة الخصم">
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          )}
        </div>

        {/* Live amount badge */}
        {discountAmt > 0 && (
          <span className="text-xs font-black text-red-600 dark:text-red-400 whitespace-nowrap shrink-0 tabular-nums">
            -{discountAmt.toFixed(2)}
          </span>
        )}
      </div>

      {/* Reason selector — shown only when there's a value */}
      {hasValue && (
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[15px] text-gray-400 shrink-0">label</span>
          <select
            value={discountReason}
            onChange={(e) => update({ discountReason: e.target.value })}
            disabled={isDisabled}
            className="flex-1 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-40 transition-colors">
            <option value="">— سبب الخصم —</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          {!discountReason && (
            <span className="material-symbols-outlined text-[15px] text-amber-400 shrink-0" title="سبب الخصم مطلوب">warning</span>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscountPanel;
