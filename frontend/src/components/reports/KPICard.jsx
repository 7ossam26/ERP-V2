import React from "react";

export default function KPICard({ label, value, icon, color = "primary", sub }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color] || colorMap.primary}`}>
        <span className="material-icons-round text-2xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
