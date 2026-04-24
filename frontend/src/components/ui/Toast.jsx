import React, { useEffect } from "react";

/**
 * Toast Notification Component
 * Displays temporary notification messages with different types
 * Now supports resolution guidance for errors
 */
const Toast = ({ message, resolution, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, resolution ? 6000 : 4000); // Longer duration for messages with resolution

    return () => clearTimeout(timer);
  }, [onClose, resolution]);

  const typeStyles = {
    success: {
      bg: "bg-green-500 dark:bg-green-600",
      icon: "check_circle",
    },
    error: {
      bg: "bg-red-500 dark:bg-red-600",
      icon: "error",
    },
    info: {
      bg: "bg-blue-500 dark:bg-blue-600",
      icon: "info",
    },
    warning: {
      bg: "bg-yellow-500 dark:bg-yellow-600",
      icon: "warning",
    },
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      className={`fixed top-4 right-4 ${style.bg} text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 animate-slide-down z-50 min-w-[300px] max-w-md`}
      role="alert">
      <span className="material-icons-round text-2xl flex-shrink-0">{style.icon}</span>
      <div className="flex-1">
        <div className="font-semibold text-base leading-snug">{message}</div>
        {resolution && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <div className="flex items-start gap-2">
              <span className="material-icons-round text-sm mt-0.5 flex-shrink-0">lightbulb</span>
              <span className="text-sm text-white/90 leading-relaxed">{resolution}</span>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="material-icons-round text-xl hover:bg-white/20 rounded-lg p-1 transition-colors flex-shrink-0"
        aria-label="إغلاق">
        close
      </button>
    </div>
  );
};


/**
 * Custom hook for managing toast notifications
 * @returns {object} { toast, showToast, hideToast }
 */
export const useToast = () => {
  const [toast, setToast] = React.useState(null);

  const showToast = (message, type = "info", resolution = null) => {
    setToast({ message, type, resolution });
  };

  const hideToast = () => {
    setToast(null);
  };

  return { toast, showToast, hideToast };
};

export default Toast;
