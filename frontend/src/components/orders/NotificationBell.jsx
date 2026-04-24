// components/orders/NotificationBell.jsx
import React, { useState } from "react";
import { useRealtimeNotifications } from "../../contexts/RealtimeNotificationsContext";

const TYPE_META = {
  NEW_CALL_CENTER_ORDER: {
    label: "طلب كول سنتر جديد",
    icon: "support_agent",
    color: "text-red-500",
    border: "border-r-red-500",
    bg: "bg-red-50 dark:bg-red-900/10",
  },
  ORDER_STATUS_CHANGED: {
    label: "تحديث حالة طلب",
    icon: "sync_alt",
    color: "text-blue-500",
    border: "border-r-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/10",
  },
};

const DEFAULT_META = {
  label: "إشعار",
  icon: "notifications",
  color: "text-gray-400",
  border: "border-r-gray-300",
  bg: "",
};

const STATUS_DOT = {
  open: "bg-emerald-400",
  connecting: "bg-amber-400 animate-pulse",
  closed: "bg-gray-400",
};
const STATUS_LABEL = {
  open: "متصل",
  connecting: "جارٍ الاتصال",
  closed: "غير متصل",
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
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        title="الإشعارات">
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div
            className="absolute top-full mt-2 left-0 w-[380px] max-h-[75vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col z-50"
            dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="font-black text-gray-800 dark:text-gray-100 text-sm">الإشعارات</span>
                {unreadCount > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Connection dot */}
                <div className="flex items-center gap-1.5" title={STATUS_LABEL[connectionStatus] || ""}>
                  <span
                    className={`w-2 h-2 rounded-full ${STATUS_DOT[connectionStatus] || "bg-gray-400"}`}
                  />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {STATUS_LABEL[connectionStatus] || connectionStatus}
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* Alerts enable/disable strip */}
            {!alertsEnabled ? (
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">volume_off</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">تنبيهات الصوت معطلة</span>
                </div>
                <button
                  onClick={enableAlerts}
                  className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg transition-colors">
                  تفعيل
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined text-[14px]">volume_up</span>
                  <span className="font-bold">التنبيهات مفعلة</span>
                </div>
                <button
                  onClick={disableAlerts}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
                  إيقاف الصوت
                </button>
              </div>
            )}

            {/* Mark all read */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[11px] text-gray-400">{notifications.length} إشعار</span>
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="text-[11px] font-bold text-primary hover:underline disabled:opacity-30 disabled:no-underline transition-opacity">
                تعليم الكل كمقروء
              </button>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-300 dark:text-gray-600">
                  <span className="material-symbols-outlined text-4xl">notifications_off</span>
                  <p className="text-xs">لا توجد إشعارات</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const meta = TYPE_META[n.type] || DEFAULT_META;
                  return (
                    <div
                      key={n.id || `${n.type}-${n.createdAt}`}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 border-r-2 ${meta.border} ${
                        n.readAt ? "opacity-50" : meta.bg
                      } transition-opacity`}>
                      {/* Icon */}
                      <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>
                        <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mt-0.5">
                          {n.payload?.clientName || "—"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {n.payload?.saleNumber && (
                            <span className="text-[11px] text-gray-400 font-mono">#{n.payload.saleNumber}</span>
                          )}
                          {n.payload?.total != null && (
                            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                              {Number(n.payload.total).toFixed(2)} ج.م
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
                          {n.createdAt ? new Date(n.createdAt).toLocaleString("ar-EG") : ""}
                        </p>
                      </div>

                      {/* Mark read */}
                      {!n.readAt && n.id && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/10 transition-colors mt-0.5"
                          title="تعليم كمقروء"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
