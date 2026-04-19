// components/orders/NotificationBell.jsx
// Small bell icon with unread count + dropdown history + "Enable alerts" gate.
// Mounts inside any header where a logged-in user can benefit from seeing it
// (POS, main dashboard). Consumes the RealtimeNotificationsContext.

import React, { useState } from "react";
import { useRealtimeNotifications } from "../../contexts/RealtimeNotificationsContext";

const typeLabel = {
  NEW_CALL_CENTER_ORDER: "طلب كول سنتر جديد",
  ORDER_STATUS_CHANGED: "تحديث حالة طلب",
};

const NotificationBell = ({ className = "" }) => {
  const {
    notifications,
    unreadCount,
    connectionStatus,
    alertsEnabled,
    enableAlerts,
    disableAlerts,
    markRead,
    markAllRead,
  } = useRealtimeNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`} dir="rtl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
        title="الإشعارات">
        <span className="material-symbols-outlined text-lg">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-[340px] max-h-[70vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col z-50 text-gray-900 dark:text-gray-100">
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-bold">الإشعارات</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  connectionStatus === "open"
                    ? "bg-green-100 text-green-700"
                    : connectionStatus === "connecting"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-200 text-gray-700"
                }`}>
                {connectionStatus === "open"
                  ? "متصل"
                  : connectionStatus === "connecting"
                    ? "جارٍ الاتصال"
                    : "غير متصل"}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {!alertsEnabled && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-b dark:border-gray-700 text-xs">
              <div className="font-bold mb-1">تنبيهات الصوت معطلة</div>
              <div className="text-gray-600 dark:text-gray-300 mb-2">
                اضغط لتفعيل الصوت والإشعارات المنبثقة.
              </div>
              <button
                onClick={enableAlerts}
                className="px-3 py-1 bg-primary text-white rounded text-xs hover:opacity-90">
                تفعيل التنبيهات
              </button>
            </div>
          )}
          {alertsEnabled && (
            <div className="px-3 py-1 text-[11px] text-gray-500 flex justify-between items-center border-b dark:border-gray-700">
              <span>التنبيهات مفعلة</span>
              <button onClick={disableAlerts} className="text-red-500 hover:underline">
                إيقاف
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-1 border-b dark:border-gray-700 text-xs">
            <span className="text-gray-500">{unreadCount} غير مقروء</span>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-primary hover:underline disabled:opacity-40 disabled:no-underline">
              تعليم الكل كمقروء
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">لا توجد إشعارات</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id || `${n.type}-${n.createdAt}`}
                  className={`p-3 border-b dark:border-gray-700 text-sm ${
                    n.readAt ? "opacity-60" : ""
                  }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-xs">{typeLabel[n.type] || n.type}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {n.payload?.clientName || "-"} —{" "}
                        {Number(n.payload?.total || 0).toFixed(2)}
                      </div>
                      {n.payload?.saleNumber && (
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          #{n.payload.saleNumber}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString("ar-EG") : ""}
                      </div>
                    </div>
                    {!n.readAt && n.id && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-[11px] text-primary hover:underline whitespace-nowrap ml-2">
                        تعليم كمقروء
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
