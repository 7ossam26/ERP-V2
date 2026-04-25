// utils/debugLog.js
// Ring-buffered debug log persisted to localStorage so a reload (or a silent
// crash followed by a reload) doesn't drop the breadcrumbs that explain it.
//
// Usage:
//   import debugLog from "./utils/debugLog";
//   debugLog.push("sse", "connect", { retryMs });
//   debugLog.error("global", err, { source: "onerror" });
//   debugLog.dump();   // returns array
//   debugLog.clear();
//
// Entries are also mirrored to console.* so live debugging still works.

const STORAGE_KEY = "debug:errors";
const MAX_ENTRIES = 200;

function readBuffer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(entries) {
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or serialization failed — drop silently.
  }
}

function append(entry) {
  const buf = readBuffer();
  buf.push(entry);
  writeBuffer(buf);
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

function safeData(data) {
  if (data == null) return undefined;
  try {
    // Strip out things that don't serialize well.
    return JSON.parse(JSON.stringify(data));
  } catch {
    return { _unserialisable: String(data) };
  }
}

function errorShape(err) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === "object") {
    return safeData(err);
  }
  return { message: String(err) };
}

const debugLog = {
  /**
   * Record a breadcrumb.
   * @param {string} source  short tag — "sse", "global", "render", etc.
   * @param {string} event   short verb — "connect", "open", "ticket-failed", etc.
   * @param {object} [data]  small structured context.
   */
  push(source, event, data) {
    const entry = {
      ts: nowIso(),
      level: "info",
      source,
      event,
      data: safeData(data),
    };
    append(entry);
    if (typeof console !== "undefined" && console.debug) {
      console.debug(`[${source}] ${event}`, data ?? "");
    }
  },

  /**
   * Record an error breadcrumb.
   */
  error(source, err, data) {
    const entry = {
      ts: nowIso(),
      level: "error",
      source,
      event: "error",
      err: errorShape(err),
      data: safeData(data),
    };
    append(entry);
    if (typeof console !== "undefined" && console.error) {
      console.error(`[${source}] error`, err, data ?? "");
    }
  },

  /** Read the full ring buffer. */
  dump() {
    return readBuffer();
  },

  /** Wipe the ring buffer. */
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures in private or restricted contexts.
    }
  },

  STORAGE_KEY,
  MAX_ENTRIES,
};

export default debugLog;
