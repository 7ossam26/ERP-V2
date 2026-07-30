import React, { useEffect, useRef, useState } from "react";
import { Scale, X } from "lucide-react";

const PRESETS = [
  { label: "1/8", value: 0.125 },
  { label: "1/4", value: 0.25 },
  { label: "1/2", value: 0.5 },
  { label: "1", value: 1 },
];

const formatKg = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return "0";
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
};

const WeightPickerModal = ({ item, currentQty = 0, onConfirm, onClose }) => {
  const [value, setValue] = useState(currentQty > 0 ? String(currentQty) : "");
  const inputRef = useRef(null);
  // Max sellable weight: on-hand plus whatever the item's BOM can still produce.
  const stock = Number(item?.available ?? item?.stock) || 0;

  const submit = () => {
    const n = parseFloat(value);
    if (!isFinite(n) || n <= 0) return;
    const clamped = Math.min(n, stock);
    onConfirm(clamped);
  };

  const pick = (preset) => {
    const clamped = Math.min(preset, stock);
    setValue(String(clamped));
    onConfirm(clamped);
  };

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!item) return null;

  const lineTotal = (parseFloat(value) || 0) * Number(item.price || 0);
  const overStock = parseFloat(value) > stock;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border-light bg-surface-light p-5 shadow-soft dark:border-border-dark dark:bg-surface-dark"
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">
              اختر الوزن
            </p>
            <h3 className="mt-0.5 truncate text-base font-extrabold text-text-light dark:text-text-dark">
              {item.name}
            </h3>
            <p className="mt-1 text-xs tabular-nums text-text-light/60 dark:text-text-dark/60">
              {Number(item.price).toFixed(2)} ج.م / كيلو · متاح {formatKg(stock)} كجم
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-text-light/45 transition-colors hover:bg-stock-out/10 hover:text-stock-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stock-out dark:text-text-dark/45"
          >
            <X size={16} />
          </button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const disabled = p.value > stock;
            return (
              <button
                key={p.label}
                type="button"
                disabled={disabled}
                onClick={() => pick(p.value)}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-border-light bg-white py-3 transition-all hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-gray-800"
              >
                <span className="text-xl font-extrabold text-text-light dark:text-text-dark">
                  {p.label}
                </span>
                <span className="text-[10px] font-medium text-text-light/50 dark:text-text-dark/50">
                  كيلو
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-text-light/60 dark:text-text-dark/60">
            أو أدخل كمية مخصصة
          </label>
          <div className="relative">
            <Scale
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary/60"
            />
            <input
              ref={inputRef}
              type="number"
              min="0"
              step="0.001"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.000"
              className="h-12 w-full rounded-lg border border-border-light bg-white pl-14 pr-9 text-center text-lg font-bold tabular-nums text-text-light placeholder:text-text-light/25 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-gray-800 dark:text-text-dark"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-light/50 dark:text-text-dark/50">
              كيلو
            </span>
          </div>
          {overStock && (
            <p className="mt-1.5 text-xs font-bold text-stock-out">
              الكمية أكبر من المخزون المتاح ({formatKg(stock)} كجم)
            </p>
          )}
        </div>

        {/* Total preview */}
        <div className="mt-4 flex items-center justify-between rounded-lg border-t-2 border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2.5 dark:bg-primary/[0.08]">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-light/70 dark:text-text-dark/70">
            الإجمالي
          </span>
          <span className="text-xl font-bold tabular-nums text-text-light dark:text-text-dark">
            {lineTotal.toFixed(2)}
            <span className="mr-1 text-xs font-medium text-text-light/50 dark:text-text-dark/50">
              ج.م
            </span>
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-light bg-white py-2.5 text-sm font-bold text-text-light/70 transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark/70"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!parseFloat(value) || parseFloat(value) <= 0}
            className="rounded-lg bg-primary py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeightPickerModal;
