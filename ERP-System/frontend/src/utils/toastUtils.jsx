import React from 'react';
import toast from 'react-hot-toast';

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
