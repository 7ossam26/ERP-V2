import React from "react";
import { createPortal } from "react-dom";

export default function ConfirmModal({
  open,
  title = "تأكيد",
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  tone = "primary",
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  const btnCls =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-primary hover:bg-primary-hover text-white";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm border border-border-light dark:border-border-dark p-6 animate-fade-in-up">
        {title && (
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-2">{title}</h3>
        )}
        {message && (
          <p className="text-sm text-text-light/70 dark:text-text-dark/70 mb-5 whitespace-pre-line">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark text-text-light/70 dark:text-text-dark/70 hover:bg-accent/30 dark:hover:bg-primary/10 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-xl transition-colors ${btnCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
