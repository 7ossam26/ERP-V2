import React from "react";
import { createPortal } from "react-dom";
import { FaLock, FaArrowLeft, FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const NoShiftModal = ({
  isOpen,
  onViewOnly,
  title = "لا توجد وردية نشطة",
  subtitle = "يجب فتح وردية أولاً لإضافة مصاريف",
  bodyTitle = "إضافة المصاريف محظورة",
  bodyText = "لا يمكن تسجيل مصاريف جديدة بدون وردية مفتوحة. توجه إلى نقطة البيع لبدء وردية جديدة.",
  footerPrimary = "يمكنك العودة للوحة التحكم وبدء وردية من نقطة البيع،",
  footerSecondary = "أو الاستمرار لعرض المصاريف السابقة فقط.",
  viewOnlyLabel = "عرض المصاريف السابقة فقط",
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-orange-200 dark:border-orange-900 mx-4">
        {/* Header */}
        <div className="p-8 text-center text-white bg-orange-500">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm animate-pulse">
            <FaLock className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-2">{title}</h2>
          <p className="text-orange-100 font-medium text-lg">{subtitle}</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="rounded-xl p-6 border bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/50">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full mt-1 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
                <FaLock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-1">
                  {bodyTitle}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {bodyText}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            <p>{footerPrimary}</p>
            <p>{footerSecondary}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
              <FaArrowLeft className="w-5 h-5" />
              <span>العودة إلى لوحة التحكم</span>
            </button>
            <button
              onClick={onViewOnly}
              className="w-full bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-3">
              <FaEye className="w-5 h-5" />
              <span>{viewOnlyLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default NoShiftModal;
