import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function PromptModal({
  open,
  title = "إدخال",
  message,
  label,
  placeholder = "",
  initialValue = "",
  validate,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  onConfirm,
  onClose,
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("هذا الحقل مطلوب");
      return;
    }
    if (validate) {
      const err = validate(trimmed);
      if (err) { setError(err); return; }
    }
    onConfirm(trimmed);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm border border-border-light dark:border-border-dark p-6 animate-fade-in-up">
        {title && (
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-2">{title}</h3>
        )}
        {message && (
          <p className="text-sm text-text-light/70 dark:text-text-dark/70 mb-3">{message}</p>
        )}
        <div className="mb-4">
          {label && (
            <label className="block text-xs text-text-light/60 dark:text-text-dark/60 mb-1">
              {label}
            </label>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-light dark:text-text-dark"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark text-text-light/70 dark:text-text-dark/70 hover:bg-accent/30 dark:hover:bg-primary/10 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-xl bg-primary hover:bg-primary-hover text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
