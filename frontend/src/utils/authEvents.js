export const AUTH_CHANGED_EVENT = "auth:changed";

export function emitAuthChanged(detail = {}) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail }));
  } catch {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}
