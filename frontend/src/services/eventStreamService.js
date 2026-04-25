// services/eventStreamService.js
// Thin wrapper around the native EventSource for our /api/events/stream SSE
// endpoint. Handles:
//   - stream-ticket auth (POST /api/events/ticket → single-use, 30s TTL token
//     used in ?ticket= so the long-lived JWT never travels in the URL)
//   - Last-Event-ID replay on reconnect (persisted in localStorage)
//   - exponential backoff reconnect (1s -> 30s cap)
//   - multiple subscribers via a tiny pub/sub
// Expose a singleton; the React hook consumes it.

import { api } from "./apiClient.js";
import debugLog from "../utils/debugLog.js";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";
const LEGACY_STORAGE_KEY = "sse:lastEventId";

function getCurrentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.id == null ? "" : String(user.id);
  } catch {
    return "";
  }
}

class EventStream {
  constructor() {
    this.source = null;
    this.listeners = new Set();
    this.retryMs = 1_000;
    this.maxRetryMs = 30_000;
    this.stopped = true;
    this.status = "closed"; // 'open' | 'connecting' | 'closed'
    this.statusListeners = new Set();
    this.reconnectTimer = null;
    this.connectGeneration = 0;
  }

  _replayCursorKey() {
    const userId = getCurrentUserId();
    return userId ? `${LEGACY_STORAGE_KEY}:${userId}` : LEGACY_STORAGE_KEY;
  }

  _clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  _setStatus(s) {
    if (this.status !== s) {
      debugLog.push("sse", "status", { from: this.status, to: s });
    }
    this.status = s;
    for (const fn of this.statusListeners) {
      try {
        fn(s);
      } catch (err) {
        debugLog.error("sse", err, { event: "statusListener-threw" });
      }
    }
  }

  start() {
    debugLog.push("sse", "start", { stopped: this.stopped });
    if (!this.stopped && (this.source || this.status === "connecting")) {
      debugLog.push("sse", "start-skip-active", {
        hasSource: !!this.source,
        status: this.status,
      });
      return;
    }
    this.stopped = false;
    this._clearReconnectTimer();
    this._connect();
  }

  stop() {
    debugLog.push("sse", "stop", { hadSource: !!this.source });
    this.stopped = true;
    this.connectGeneration += 1;
    this._clearReconnectTimer();
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this._setStatus("closed");
  }

  async _connect() {
    if (this.stopped) {
      debugLog.push("sse", "connect-skip-stopped");
      return;
    }
    if (this.source) {
      debugLog.push("sse", "connect-skip-active-source");
      return;
    }
    const generation = ++this.connectGeneration;
    const token = localStorage.getItem("token");
    if (!token) {
      debugLog.push("sse", "connect-skip-no-token");
      this._setStatus("closed");
      return;
    }

    this._setStatus("connecting");
    debugLog.push("sse", "ticket-request");

    let ticket;
    try {
      const res = await api.post("/events/ticket");
      ticket = res?.ticket;
      debugLog.push("sse", "ticket-ok", { hasTicket: !!ticket });
    } catch (err) {
      if (this.stopped || generation !== this.connectGeneration) return;
      if (err?.status === 401) {
        debugLog.error("sse", err, { event: "ticket-unauthorized-stop" });
        this.stop();
        return;
      }
      debugLog.error("sse", err, { event: "ticket-failed", retryMs: this.retryMs });
      this._scheduleReconnect();
      return;
    }
    if (!ticket || this.stopped || generation !== this.connectGeneration) {
      debugLog.push("sse", "connect-abort", {
        hasTicket: !!ticket,
        stopped: this.stopped,
        stale: generation !== this.connectGeneration,
      });
      if (!this.stopped) this._scheduleReconnect();
      return;
    }

    const lastEventId = localStorage.getItem(this._replayCursorKey()) || "";
    const qs = new URLSearchParams({ ticket });
    if (lastEventId) qs.set("lastEventId", lastEventId);
    const url = `${API_BASE_URL}/events/stream?${qs.toString()}`;

    try {
      this.source = new EventSource(url);
      debugLog.push("sse", "eventsource-created", { lastEventId: lastEventId || null });
    } catch (err) {
      debugLog.error("sse", err, { event: "eventsource-construct-failed" });
      this._scheduleReconnect();
      return;
    }

    const source = this.source;

    source.onopen = () => {
      if (this.stopped || generation !== this.connectGeneration || source !== this.source) {
        return;
      }
      const prevRetry = this.retryMs;
      this.retryMs = 1_000; // reset backoff
      debugLog.push("sse", "open", { prevRetryMs: prevRetry });
      this._setStatus("open");
    };

    source.onerror = (ev) => {
      if (this.stopped || generation !== this.connectGeneration || source !== this.source) {
        source.close();
        return;
      }
      // EventSource auto-reconnects on its own, but only if the connection
      // opened at least once. We close + reopen ourselves to make the replay
      // path explicit (lastEventId query param on each retry).
      const readyState = this.source?.readyState;
      debugLog.push("sse", "error", {
        readyState,
        retryMs: this.retryMs,
        type: ev?.type,
      });
      if (this.source) {
        this.source.close();
        this.source = null;
      }
      this._setStatus("closed");
      this._scheduleReconnect();
    };

    // Generic messages
    source.onmessage = (e) => this._dispatch(e);
    // Named events (matches `event: <type>` on the server side)
    for (const type of ["NEW_CALL_CENTER_ORDER", "ORDER_STATUS_CHANGED"]) {
      source.addEventListener(type, (e) => this._dispatch(e));
    }
  }

  _dispatch(e) {
    if (!e?.data) return;
    let parsed;
    try {
      parsed = JSON.parse(e.data);
    } catch (err) {
      debugLog.error("sse", err, { event: "dispatch-parse-failed", raw: String(e.data).slice(0, 200) });
      return;
    }
    // Persist the last event id for replay on reconnect.
    if (parsed.id != null) {
      localStorage.setItem(this._replayCursorKey(), String(parsed.id));
    } else if (e.lastEventId) {
      localStorage.setItem(this._replayCursorKey(), String(e.lastEventId));
    }
    debugLog.push("sse", "dispatch", {
      type: parsed.type,
      id: parsed.id,
      replay: parsed.replay || false,
      listeners: this.listeners.size,
    });
    for (const fn of this.listeners) {
      try {
        fn(parsed);
      } catch (err) {
        // R4 (plan): a subscriber throw could otherwise corrupt React state
        // silently. We isolate per-subscriber and breadcrumb so the next
        // reload still has the trail.
        debugLog.error("sse", err, { event: "listener-threw", type: parsed.type, id: parsed.id });
      }
    }
  }

  _scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) {
      debugLog.push("sse", "reconnect-already-scheduled");
      return;
    }
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, this.maxRetryMs);
    debugLog.push("sse", "reconnect-scheduled", { delayMs: delay, nextMs: this.retryMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, delay);
  }

  /**
   * Register a callback that receives every event { id, type, payload, createdAt }.
   * Returns an unsubscribe function.
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  /** Reset the replay cursor — useful on logout. */
  clearReplayCursor() {
    localStorage.removeItem(this._replayCursorKey());
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

const eventStream = new EventStream();
export default eventStream;
