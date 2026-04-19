// contexts/RealtimeNotificationsContext.jsx
// Single source of truth for the live notification feed.
// Starts the SSE connection after login, merges live events with REST history,
// exposes unread count + incoming-order list to consumers (POS tray, bell, etc.),
// and handles the user-gated "Enable alerts" flow (sound + browser notification).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import eventStream from "../services/eventStreamService";
import notificationService from "../services/notificationService";

const RealtimeNotificationsContext = createContext(null);

// Small helper: localStorage-backed flag for the alerts-enabled user gate.
const ALERTS_KEY = "alertsEnabled";

export const RealtimeNotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("closed");
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => localStorage.getItem(ALERTS_KEY) === "true",
  );
  const soundRef = useRef(null);

  // Initial fetch of recent history + unread count.
  const refresh = useCallback(async () => {
    try {
      const res = await notificationService.list({ page: 1, limit: 50 });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      // silent — the bell just shows empty on failure; SSE will fill it live
      console.warn("[notifications] refresh failed:", err?.message || err);
    }
  }, []);

  // Prepare the alert sound once. Browser autoplay policy needs a user gesture,
  // so we lazy-load and let "Enable alerts" be the gesture that unlocks it.
  useEffect(() => {
    if (!soundRef.current) {
      try {
        soundRef.current = new Audio("/sounds/ding.mp3");
        soundRef.current.preload = "auto";
      } catch {}
    }
  }, []);

  // Wire up the SSE stream. Re-runs only if the token changes (login/logout).
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    refresh();
    eventStream.start();

    const offStatus = eventStream.onStatus(setConnectionStatus);

    const off = eventStream.subscribe((event) => {
      // ORDER_STATUS_CHANGED is transient — just nudge a refresh.
      if (event.type === "ORDER_STATUS_CHANGED") {
        refresh();
        return;
      }
      if (event.type === "NEW_CALL_CENTER_ORDER") {
        // Prepend the live event; dedupe by id so reconnect-replay doesn't
        // double-add rows the history fetch already has.
        setNotifications((prev) => {
          if (event.id && prev.some((n) => n.id === event.id)) return prev;
          return [
            {
              id: event.id,
              type: event.type,
              payload: event.payload,
              createdAt: event.createdAt,
              readAt: null,
            },
            ...prev,
          ].slice(0, 50);
        });
        if (!event.replay) {
          setUnreadCount((c) => c + 1);
          playAlert();
          showBrowserNotification(event.payload);
        }
      }
    });

    return () => {
      off();
      offStatus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const playAlert = useCallback(() => {
    if (!alertsEnabled) return;
    const audio = soundRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }, [alertsEnabled]);

  const showBrowserNotification = useCallback(
    (payload) => {
      if (!alertsEnabled) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification("طلب جديد من الكول سنتر", {
          body: payload?.clientName
            ? `${payload.clientName} — ${Number(payload.total || 0).toFixed(2)}`
            : `إجمالي: ${Number(payload?.total || 0).toFixed(2)}`,
          tag: `order-${payload?.orderId}`,
        });
      } catch {}
    },
    [alertsEnabled],
  );

  /**
   * Called from "Enable alerts" button — a user gesture unlocks autoplay and
   * can prompt for browser-notification permission. Persisted so the setting
   * survives tab reloads.
   */
  const enableAlerts = useCallback(async () => {
    localStorage.setItem(ALERTS_KEY, "true");
    setAlertsEnabled(true);
    // Unlock the audio element (gesture-bound).
    const audio = soundRef.current;
    if (audio) {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch {}
    }
    // Ask for browser-notification permission (idempotent).
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {}
    }
  }, []);

  const disableAlerts = useCallback(() => {
    localStorage.setItem(ALERTS_KEY, "false");
    setAlertsEnabled(false);
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn("[notifications] markRead failed:", err?.message);
    }
  }, []);

  const dismissForOrder = useCallback(async (orderId) => {
    try {
      await notificationService.markReadByOrder(orderId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.payload?.orderId === orderId && !n.readAt
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      );
      // Recompute unread count from state; easier than tracking deltas.
      setUnreadCount((c) => {
        const before = c;
        const dismissed = notifications.filter(
          (n) => n.payload?.orderId === orderId && !n.readAt,
        ).length;
        return Math.max(0, before - dismissed);
      });
    } catch (err) {
      console.warn("[notifications] dismissForOrder failed:", err?.message);
    }
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (err) {
      console.warn("[notifications] markAllRead failed:", err?.message);
    }
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      connectionStatus,
      alertsEnabled,
      enableAlerts,
      disableAlerts,
      refresh,
      markRead,
      dismissForOrder,
      markAllRead,
    }),
    [
      notifications,
      unreadCount,
      connectionStatus,
      alertsEnabled,
      enableAlerts,
      disableAlerts,
      refresh,
      markRead,
      dismissForOrder,
      markAllRead,
    ],
  );

  return (
    <RealtimeNotificationsContext.Provider value={value}>
      {children}
    </RealtimeNotificationsContext.Provider>
  );
};

export const useRealtimeNotifications = () => {
  const ctx = useContext(RealtimeNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useRealtimeNotifications must be used within RealtimeNotificationsProvider",
    );
  }
  return ctx;
};
