import React from "react";

const TONES = {
  default: "bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark",
  highlight: "bg-primary/5 dark:bg-primary/10 border-primary/30 dark:border-primary/40",
  danger: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700",
  success: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700",
};

const VALUE_TONES = {
  default: "text-primary dark:text-accent",
  highlight: "text-primary dark:text-accent",
  danger: "text-red-700 dark:text-red-400",
  success: "text-emerald-700 dark:text-emerald-400",
};

export default function SummaryCard({ label, value, tone = "default" }) {
  return (
    <div className={`rounded-xl border p-4 shadow-soft dark:shadow-soft-dark ${TONES[tone] || TONES.default}`}>
      <p className="text-xs text-text-light/60 dark:text-text-dark/60 mb-1">{label}</p>
      <p className={`text-xl font-bold ${VALUE_TONES[tone] || VALUE_TONES.default}`}>{value}</p>
    </div>
  );
}
