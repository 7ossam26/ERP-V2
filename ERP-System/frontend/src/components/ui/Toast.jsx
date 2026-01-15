import React, { useEffect } from "react";

/**
 * Toast Notification Component
 * Displays temporary notification messages with different types
 */
const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Auto-close after 4 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

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
      className={`fixed top-4 right-4 ${style.bg} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-down z-50 min-w-[300px] max-w-md`}
      role="alert">
      <span className="material-icons-round text-2xl">{style.icon}</span>
      <span className="flex-1 font-medium">{message}</span>
      <button
        onClick={onClose}
        className="material-icons-round text-xl hover:bg-white/20 rounded-lg p-1 transition-colors"
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

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  return { toast, showToast, hideToast };
};

export default Toast;
