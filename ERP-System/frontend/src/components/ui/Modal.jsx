import React, { Fragment } from "react";

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true">
      <div
        className="fixed inset-0 bg-background-dark/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"></div>
      <div className="relative bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-lg transform transition-all flex flex-col max-h-[90vh] border border-white/10 dark:border-border-dark animate-fade-in-up">
        <div className="px-6 py-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-accent/5 dark:bg-primary/5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {/* Icon Logic can be passed or generic */}
            <div className="bg-primary text-white p-2 rounded-lg shadow-sm">
              <span className="material-icons-round text-xl">warehouse</span>
            </div>
            <h3 className="text-xl font-bold text-primary dark:text-text-dark">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center">
            <span className="material-icons-round text-2xl">close</span>
          </button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
