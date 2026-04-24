import React from "react";
import { createPortal } from "react-dom";
import { FaLock, FaUserSlash, FaHistory, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const ShiftBlockedModal = ({ isOpen, blockerInfo }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleExit = () => {
    navigate("/dashboard");
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-200 dark:border-red-900 mx-4">
        {/* Header */}
        <div
          className={`p-8 text-center text-white ${blockerInfo?.status === "PENDING_REVIEW" ? "bg-orange-600" : "bg-red-600"}`}>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm animate-pulse">
            <FaLock className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-2">
            {blockerInfo?.status === "PENDING_REVIEW"
              ? "الوردية معلقة"
              : "الدخول محظور"}
          </h2>
          <p
            className={`${blockerInfo?.status === "PENDING_REVIEW" ? "text-orange-100" : "text-red-100"} font-medium text-lg`}>
            {blockerInfo?.status === "PENDING_REVIEW"
              ? "توجد وردية سابقة بانتظار موافقة المدير"
              : "يوجد وردية نشطة بالفعل في هذا الفرع"}
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div
            className={`rounded-xl p-6 border ${
              blockerInfo?.status === "PENDING_REVIEW"
                ? "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/50"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50"
            }`}>
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-full mt-1 ${
                  blockerInfo?.status === "PENDING_REVIEW"
                    ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                    : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                }`}>
                <FaUserSlash className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-1">
                  {blockerInfo?.status === "PENDING_REVIEW"
                    ? "بواسطة الموظف"
                    : "وردية نشطة بواسطة"}
                </h3>
                <p
                  className={`text-2xl font-extrabold ${
                    blockerInfo?.status === "PENDING_REVIEW"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                  {blockerInfo?.user?.name || "مستخدم غير معروف"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2">
                  <FaHistory />
                  <span>بدأت الوردية: </span>
                  <span className="font-mono dir-ltr">
                    {blockerInfo?.startTime
                      ? new Date(blockerInfo.startTime).toLocaleString("ar-EG")
                      : "وقت غير معروف"}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-bold">الفرع:</span>{" "}
                {blockerInfo?.branch?.name || "غير محدد"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Shift ID: {blockerInfo?.id} | Branch ID: {blockerInfo?.branchId}
              </p>
            </div>
          </div>

          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            <p>لا يمكن فتح أكثر من وردية واحدة لنفس الفرع في نفس الوقت.</p>
            <p>يرجى الانتظار حتى يتم إغلاق الوردية الحالية.</p>
          </div>

          <button
            onClick={handleExit}
            className="w-full bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
            <FaArrowLeft className="w-5 h-5" />
            <span>العودة إلى لوحة التحكم</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShiftBlockedModal;
