// services/eventStreamService.js
// Thin wrapper around the native EventSource for our /api/events/stream SSE
// endpoint. Handles:
//   - auth-via-query (EventSource can't send Authorization headers)
//   - Last-Event-ID replay on reconnect (persisted in localStorage)
//   - exponential backoff reconnect (1s -> 30s cap)
//   - multiple subscribers via a tiny pub/sub
// Expose a singleton; the React hook consumes it.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const STORAGE_KEY = "sse:lastEventId";

class EventStream {
  constructor() {
    this.source = null;
    this.listeners = new Set();
    this.retryMs = 1_000;
    this.maxRetryMs = 30_000;
    this.stopped = true;
    this.status = "closed"; // 'open' | 'connecting' | 'closed'
    this.statusListeners = new Set();
  }

  _setStatus(s) {
    this.status = s;
    for (const fn of this.statusListeners) {
      try {
        fn(s);
      } catch {}
    }
  }

  start() {
    this.stopped = false;
    this._connect();
  }

  stop() {
    this.stopped = true;
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this._setStatus("closed");
  }

  _connect() {
    if (this.stopped) return;
    const token = localStorage.getItem("token");
    if (!token) {
      // not logged in — do nothing; caller will start() again after login
      this._setStatus("closed");
      return;
    }

    const lastEventId = localStorage.getItem(STORAGE_KEY) || "";
    const qs = new URLSearchParams({ token });
    if (lastEventId) qs.set("lastEventId", lastEventId);
    const url = `${API_BASE_URL}/events/stream?${qs.toString()}`;

    this._setStatus("connecting");
    try {
      this.source = new EventSource(url);
    } catch (err) {
      console.error("[SSE] EventSource construction failed:", err);
      this._scheduleReconnect();
      return;
    }

    this.source.onopen = () => {
      this.retryMs = 1_000; // reset backoff
      this._setStatus("open");
    };

    this.source.onerror = () => {
      // EventSource auto-reconnects on its own, but only if the connection
      // opened at least once. We close + reopen ourselves to make the replay
      // path explicit (lastEventId query param on each retry).
      if (this.source) {
        this.source.close();
        this.source = null;
      }
      this._setStatus("closed");
      this._scheduleReconnect();
    };

    // Generic messages
    this.source.onmessage = (e) => this._dispatch(e);
    // Named events (matches `event: <type>` on the server side)
    for (const type of ["NEW_CALL_CENTER_ORDER", "ORDER_STATUS_CHANGED"]) {
      this.source.addEventListener(type, (e) => this._dispatch(e));
    }
  }

  _dispatch(e) {
    if (!e?.data) return;
    let parsed;
    try {
      parsed = JSON.parse(e.data);
    } catch {
      return;
    }
    // Persist the last event id for replay on reconnect.
    if (parsed.id != null) {
      localStorage.setItem(STORAGE_KEY, String(parsed.id));
    } else if (e.lastEventId) {
      localStorage.setItem(STORAGE_KEY, String(e.lastEventId));
    }
    for (const fn of this.listeners) {
      try {
        fn(parsed);
      } catch (err) {
        console.error("[SSE] listener threw:", err);
      }
    }
  }

  _scheduleReconnect() {
    if (this.stopped) return;
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, this.maxRetryMs);
    setTimeout(() => this._connect(), delay);
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
    localStorage.removeItem(STORAGE_KEY);
  }
}

const eventStream = new EventStream();
export default eventStream;
