import React, { useState } from "react";
import { cairoTodayISO, computePresetRange } from "../../utils/dateRange";

const PRESETS = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "الأمس" },
  { key: "last7", label: "آخر 7 أيام" },
  { key: "custom", label: "تخصيص" },
];

const DateFilterBar = ({ value, onChange }) => {
  const [customOpen, setCustomOpen] = useState(value?.preset === "custom");
  const [customFrom, setCustomFrom] = useState(value?.from || cairoTodayISO());
  const [customTo, setCustomTo] = useState(value?.to || cairoTodayISO());

  const selectPreset = (key) => {
    if (key === "custom") {
      setCustomOpen(true);
      return; // wait for user to pick dates and click تطبيق
    }
    setCustomOpen(false);
    const range = computePresetRange(key);
    onChange({ preset: key, ...range });
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    // Swap a reversed range instead of silently querying an empty window
    const [from, to] =
      customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    setCustomFrom(from);
    setCustomTo(to);
    onChange({ preset: "custom", from, to });
  };

  return (
    <div className="flex flex-col gap-3 bg-surface-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="material-symbols-outlined text-primary text-[20px]">
          calendar_month
        </span>
        <span className="text-sm font-bold text-text-light dark:text-text-dark ml-2">
          الفترة الزمنية:
        </span>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => {
            const active = value?.preset === p.key;
            return (
              <button
                key={p.key}
                onClick={() => selectPreset(p.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
                  active
                    ? "bg-primary text-white border-primary shadow-sm shadow-primary/20"
                    : "bg-transparent text-text-secondary dark:text-gray-400 border-border-light dark:border-border-dark hover:border-primary/50 hover:text-primary"
                }`}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      {customOpen && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end pt-2 border-t border-border-light dark:border-border-dark">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-secondary dark:text-gray-400">
              من
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm text-text-light dark:text-text-dark"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-secondary dark:text-gray-400">
              إلى
            </label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm text-text-light dark:text-text-dark"
            />
          </div>
          <button
            onClick={applyCustom}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold transition-colors">
            تطبيق
          </button>
        </div>
      )}
    </div>
  );
};

export default DateFilterBar;
