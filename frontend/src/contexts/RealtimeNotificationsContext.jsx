/* eslint-disable react-refresh/only-export-components */
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
import eventStream from "../services/eventStreamService.js";
import notificationService from "../services/notificationService";
import { AUTH_CHANGED_EVENT } from "../utils/authEvents.js";

const RealtimeNotificationsContext = createContext(null);

// Per-user key so the preference survives logout/login without spilling
// between accounts on the same machine.
const getAlertsKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.id ? `alertsEnabled_${user.id}` : "alertsEnabled";
  } catch {
    return "alertsEnabled";
  }
};

const readAuthToken = () => localStorage.getItem("token") || "";

export const RealtimeNotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("closed");
  const [authToken, setAuthToken] = useState(readAuthToken);
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => localStorage.getItem(getAlertsKey()) === "true",
  );
  const soundRef = useRef(null);
  const alertsEnabledRef = useRef(alertsEnabled);

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
      } catch {
        // Audio setup can fail in restricted browser contexts.
      }
    }
  }, []);

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);

  useEffect(() => {
    const syncAuth = () => {
      setAuthToken(readAuthToken());
      setAlertsEnabled(localStorage.getItem(getAlertsKey()) === "true");
    };

    const handleStorage = (event) => {
      if (!event || event.key === null || event.key === "token" || event.key === "user") {
        syncAuth();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
    };
  }, []);

  // Wire up the SSE stream. Re-runs only if the token changes (login/logout).
  useEffect(() => {
    if (!authToken) {
      eventStream.stop();
      setConnectionStatus("closed");
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    refresh();
    eventStream.start();

    const offStatus = eventStream.onStatus(setConnectionStatus);

    const off = eventStream.subscribe((event) => {
      // ORDER_STATUS_CHANGED is a refresh hint — nudge history, but do NOT
      // increment unreadCount and do NOT prepend into the visible list
      // (bell stays focused on NEW_CALL_CENTER_ORDER). The row is already
      // marked-read server-side so history fetch won't raise unread.
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
      eventStream.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, refresh]);

  const playAlert = useCallback(() => {
    if (!alertsEnabledRef.current) return;
    const audio = soundRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    } catch {
      // Alert playback is best-effort.
    }
  }, []);

  const showBrowserNotification = useCallback(
    (payload) => {
      if (!alertsEnabledRef.current) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification("طلب جديد من الكول سنتر", {
          body: payload?.clientName
            ? `${payload.clientName} — ${Number(payload.total || 0).toFixed(2)}`
            : `إجمالي: ${Number(payload?.total || 0).toFixed(2)}`,
          tag: `order-${payload?.orderId}`,
        });
      } catch {
        // Browser notification construction is best-effort.
      }
    },
    [],
  );

  /**
   * Called from "Enable alerts" button — a user gesture unlocks autoplay and
   * can prompt for browser-notification permission. Persisted so the setting
   * survives tab reloads.
   */
  const enableAlerts = useCallback(async () => {
    localStorage.setItem(getAlertsKey(), "true");
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
      } catch {
        // Unlocking audio is best-effort.
      }
    }
    // Ask for browser-notification permission (idempotent).
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Permission prompts can be blocked by the browser.
      }
    }
  }, []);

  const disableAlerts = useCallback(() => {
    localStorage.setItem(getAlertsKey(), "false");
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
