import React from 'react';
import toast from 'react-hot-toast';
import Icon from "../components/ui/Icon";

/**
 * Shows an enhanced error toast with optional resolution guidance.
 * @param {string|Error|object} error - The error to display
 * @param {string} defaultMessage - Default message if error parsing fails
 */
export const showErrorToast = (error, defaultMessage = "حدث خطأ. يرجى المحاولة مرة أخرى.") => {
    let errorMessage = defaultMessage;
    let resolution = null;

    // Handle different error formats
    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error?.message) {
        // APIError from fetch-based client — message already contains backend error text
        errorMessage = error.message;
        resolution = error?.data?.resolution;
    } else if (error?.error && typeof error.error === 'string') {
        // Custom error object format
        errorMessage = error.error;
        resolution = error.resolution;
    }

    // Display enhanced toast
    if (resolution) {
        toast((t) => (
            <div className="flex items-start gap-3 min-w-[280px] max-w-md">
                <Icon name="error" className="text-2xl text-red-500 flex-shrink-0" />
                <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug mb-2">
                        {errorMessage}
                    </div>
                    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Icon name="lightbulb" className="text-sm text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {resolution}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-1 transition-colors flex-shrink-0"
                    aria-label="Close">
                    <Icon name="close" size={18} />
                </button>
            </div>
        ), {
            duration: 6000,
            position: 'top-right',
            className: '!bg-white dark:!bg-slate-800 !shadow-xl !rounded-xl !border !border-red-200 dark:!border-red-900/50',
        });
    } else {
        // Fallback to standard error toast
        toast.error(errorMessage, {
            duration: 4000,
            position: 'top-right',
        });
    }
};

/**
 * Shows a confirmation toast with Yes/No buttons.
 * @param {string} message - The confirmation message to display.
 * @param {Function} onConfirm - The callback to execute when "Confirm" is clicked.
 * @param {object} options - Optional customization (e.g., custom labels, colors).
 */
export const confirmAction = (message, onConfirm, options = {}) => {
    const {
        confirmText = "نعم",
        cancelText = "لا",
        confirmColor = "bg-red-600 hover:bg-red-700",
        icon = "⚠️"
    } = options;

    toast((t) => (
        <div className="flex flex-col gap-3 min-w-[250px] p-1">
            <div className="flex items-start gap-3">
                <span className="text-xl">{icon}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-normal pt-1">
                    {message}
                </span>
            </div>
            <div className="flex gap-2 justify-end mt-2">
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                >
                    {cancelText}
                </button>
                <button
                    onClick={() => {
                        toast.dismiss(t.id);
                        onConfirm();
                    }}
                    className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-sm transition-colors ${confirmColor}`}
                >
                    {confirmText}
                </button>
            </div>
        </div>
    ), {
        duration: Infinity,
        position: 'top-center',
        className: '!bg-white dark:!bg-slate-800 !shadow-xl !rounded-xl !border !border-gray-100 dark:!border-slate-700',
    });
};

export default confirmAction;
