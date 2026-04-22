import React from "react";

const STATUSES = {
  DRAFT:          { label: "مسودة",          cls: "bg-stone-100 text-stone-700 ring-stone-300 dark:bg-stone-800/40 dark:text-stone-300 dark:ring-stone-600" },
  QUOTED:         { label: "عرض سعر",        cls: "bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-600" },
  CONFIRMED:      { label: "مؤكد",           cls: "bg-primary/10 text-primary ring-primary/30 dark:bg-primary/20 dark:text-accent dark:ring-primary/40" },
  PARTIALLY_PAID: { label: "مدفوع جزئيًا",   cls: "bg-amber-50 text-amber-800 ring-amber-400 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-500" },
  PAID:           { label: "مدفوع",          cls: "bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-600" },
  CANCELLED:      { label: "ملغي",           cls: "bg-red-50 text-red-700 ring-red-300 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-600" },
  RETURNED:       { label: "مرتجع",          cls: "bg-purple-50 text-purple-700 ring-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-600" },
  ORDER:          { label: "طلب",            cls: "bg-primary/10 text-primary ring-primary/30 dark:bg-primary/20 dark:text-accent dark:ring-primary/40" },
  PAYMENT:        { label: "دفعة",           cls: "bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-600" },
  REFUND:         { label: "مرتجع",          cls: "bg-purple-50 text-purple-700 ring-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-600" },
};

export default function StatusChip({ status }) {
  const cfg = STATUSES[status] || { label: status, cls: "bg-stone-100 text-stone-600 ring-stone-300" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
