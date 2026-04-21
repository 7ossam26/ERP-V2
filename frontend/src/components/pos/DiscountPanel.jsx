import React from "react";
import { roundMoney } from "../../utils/money";

export const DEFAULT_DISCOUNT_REASONS = [
  { code: "STAFF_DISCOUNT", label: "خصم موظف", customerLabel: "خصم موظف" },
  { code: "LOYAL_CUSTOMER", label: "عميل مميز", customerLabel: "خصم عميل مميز" },
  { code: "DAMAGED_ITEM", label: "منتج تالف", customerLabel: "خصم منتج تالف" },
  { code: "MANAGER_COMP", label: "مجاملة إدارة", customerLabel: "خصم إداري" },
  { code: "PROMO", label: "عرض ترويجي", customerLabel: "عرض ترويجي" },
  { code: "OTHER", label: "أخرى", customerLabel: "خصم" },
];

// Keep old name as alias so existing imports don't break
export const DISCOUNT_REASONS = DEFAULT_DISCOUNT_REASONS;

export const reasonLabel = (code, reasons = DEFAULT_DISCOUNT_REASONS) => {
  const r = reasons.find((x) => x.code === code);
  return r ? r.label : code || "";
};

// Pure math helper — rounds to nearest 1 EGP, matches backend/utils/money.js.
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
    onChange({
      discountType,
      discountValue,
      discountReason,
      ...patch,
    });
  };

  const handleTypeChange = (e) => {
    // Mutually exclusive: switching type clears the numeric value
    update({ discountType: e.target.value, discountValue: "" });
  };

  const handleValueChange = (e) => {
    update({ discountValue: e.target.value });
  };

  const handleReasonChange = (e) => {
    update({ discountReason: e.target.value });
  };

  const clear = () => {
    update({
      discountType: "PERCENTAGE",
      discountValue: "",
      discountReason: "",
    });
  };

  const isDisabled = disabled || !(Number(subtotal) > 0);
  const hasValue = Number(discountValue) > 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <label className={`text-xs whitespace-nowrap ${compact ? "text-gray-500" : "font-bold text-gray-700 dark:text-gray-300"}`}>
          الخصم:
        </label>
        <select
          className="border rounded p-1 text-xs bg-white dark:bg-gray-800 disabled:opacity-50"
          value={discountType}
          onChange={handleTypeChange}
          disabled={isDisabled}
        >
          <option value="PERCENTAGE">%</option>
          <option value="VALUE">ج.م</option>
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          className="flex-1 border rounded p-1 text-sm disabled:opacity-50"
          value={discountValue}
          onChange={handleValueChange}
          placeholder="0"
          disabled={isDisabled}
        />
        {hasValue && !isDisabled && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-red-500 hover:text-red-700 px-1"
            title="إزالة الخصم"
          >
            ✕
          </button>
        )}
      </div>
      {hasValue && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">السبب:</label>
          <select
            className="flex-1 border rounded p-1 text-xs bg-white dark:bg-gray-800"
            value={discountReason}
            onChange={handleReasonChange}
            disabled={isDisabled}
          >
            <option value="">— اختر السبب —</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {isDisabled && Number(subtotal) <= 0 && (
        <p className="text-[10px] text-gray-400">أضف عناصر للسلة لتفعيل الخصم</p>
      )}
    </div>
  );
};

export default DiscountPanel;
