import React, { Fragment, useEffect } from "react";

const Modal = ({ isOpen, onClose, title, children, zIndex }) => {
  // Handle ESC key press to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-0 sm:p-4 md:p-6 ${zIndex ? zIndex : "z-50"
        }`}
      role="dialog"
      aria-modal="true">
      <div
        className="fixed inset-0 bg-gray-950/50 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"></div>
      <div className="relative bg-surface-light dark:bg-surface-dark rounded-none sm:rounded-3xl shadow-2xl w-full sm:max-w-lg md:max-w-2xl transform transition-all flex flex-col h-full sm:h-auto sm:max-h-[90vh] border-0 sm:border sm:border-border-light dark:border-border-dark animate-fade-in-up">
        <div className="h-1 w-full bm-gradient shrink-0 sm:rounded-t-3xl" />
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-surface-raised dark:bg-primary/5">
          <div className="flex items-center gap-3">
            {/* Icon Logic can be passed or generic */}
            <div className="bm-gradient text-white p-1.5 sm:p-2 rounded-xl shadow-glow">
              <span className="material-icons-round text-lg sm:text-xl">warehouse</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-text-light dark:text-text-dark">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center min-w-touch min-h-touch">
            <span className="material-icons-round text-2xl">close</span>
          </button>
        </div>
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
