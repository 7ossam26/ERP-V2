import React, { useState, useRef, useEffect } from "react";
import {
  EMPLOYEE_TRANSACTION_TYPES,
  EMPLOYEE_TRANSACTION_TYPE_ORDER,
} from "../../utils/employeeTransactionTypes";

/**
 * The HR header's single "معاملة جديدة" entry point.
 *
 * This replaced two separate إضافة سلفة / إضافة خصم buttons. With four types the
 * flat row would have been five buttons wide and would have kept implying that
 * سلفة is the primary action, so there is deliberately no default action here —
 * one trigger, four equally-weighted choices.
 *
 * Follows the click-outside pattern from components/BranchSwitcher.jsx rather
 * than the searchable select inside HRPage's TransactionForm, which never
 * handles outside clicks.
 */
const NewTransactionMenu = ({ disabled, disabledTitle, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // The gate can flip while the menu is open (a shift ends elsewhere).
  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  return (
    <div className="relative flex-1 md:flex-none" ref={menuRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        title={disabledTitle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary">
        <span className="material-symbols-outlined text-[20px]">add</span>
        <span>معاملة جديدة</span>
        <span
          className={`material-symbols-outlined text-[20px] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}>
          expand_more
        </span>
      </button>

      {isOpen && (
        /* right-0: the app is dir="rtl", so this anchors to the button's start edge */
        <div
          role="menu"
          className="absolute top-full right-0 mt-2 min-w-[220px] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-lg z-50 overflow-hidden">
          {EMPLOYEE_TRANSACTION_TYPE_ORDER.map((type) => {
            const meta = EMPLOYEE_TRANSACTION_TYPES[type];
            return (
              <button
                key={type}
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onSelect(type);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-border-light dark:border-border-dark last:border-0">
                <span
                  className={`material-symbols-outlined text-[20px] ${meta.text}`}>
                  {meta.icon}
                </span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NewTransactionMenu;
