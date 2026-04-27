import React from "react";

const ZoneChips = ({ zones, selectedId, onChange, branchId }) => {
  if (!branchId) {
    return (
      <p className="text-xs text-text-light/40 dark:text-text-dark/40">
        اختر الفرع أولاً لعرض مناطق التوصيل المتاحة
      </p>
    );
  }

  if (zones.length === 0) {
    return (
      <p className="text-xs text-text-light/40 dark:text-text-dark/40">
        لا توجد مناطق توصيل لهذا الفرع
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="منطقة التوصيل">
      {zones.map((z) => {
        const selected = String(z.id) === String(selectedId);
        return (
          <button
            key={z.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(String(z.id))}
            className={`
              min-h-[58px] px-4 py-3 rounded-lg text-right text-sm font-extrabold border-2 transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${selected
                ? "bg-primary border-primary text-white shadow-md"
                : "bg-white dark:bg-surface-dark border-primary/20 text-text-light dark:text-text-dark hover:border-primary/60 hover:bg-primary/5"
              }
            `}
          >
            <span className="block leading-tight">{z.name}</span>
            <span
              className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-xs tabular-nums ${
                selected ? "bg-white/15 text-white/90" : "bg-primary/10 text-primary"
              }`}
            >
              {Number(z.fee).toFixed(0)} ج.م
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ZoneChips;
