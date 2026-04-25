# SSE Review & Crash Triage Plan

**Symptom reported:** App crashes when navigating; no console logs and no audit trail visible.
**Goal:** Get visibility into the failure, then sweep all SSE-related code paths for known and latent bugs.

---

## 1. SSE Surface Area (current state)

### Backend
| File | Role |
|---|---|
| [routes/events.js](../backend/routes/events.js) | `POST /events/ticket` (single-use, 30s TTL) → `GET /events/stream` opens long-lived response, replays from `Last-Event-ID`, subscribes to user topic, heartbeat every 25s, cleans up on `req.on("close")`. |
| [lib/eventBus.js](../backend/lib/eventBus.js) | Singleton in-memory `EventEmitter`, `maxListeners = 0`. Redis adapter is stubbed. |
| [lib/orderService.js](../backend/lib/orderService.js) | Three publishers: `publishNewOrderNotifications`, `drainPendingForBranch`, `broadcastStatusChange`. All publish via `bus.publish` (sync emit, fire-and-forget). |
| [controllers/callCenter.controller.js](../backend/controllers/callCenter.controller.js), [routes/orders.js](../backend/routes/orders.js) | Call sites for the publishers. |

### Frontend
| File | Role |
|---|---|
| [services/eventStreamService.js](../frontend/src/services/eventStreamService.js) | Singleton `EventStream`: ticket → `EventSource` → reconnect with exponential backoff (1s → 30s cap); persists `lastEventId` in `localStorage`; pub/sub for subscribers and status. |
| [contexts/RealtimeNotificationsContext.jsx](../frontend/src/contexts/RealtimeNotificationsContext.jsx) | Calls `eventStream.start()` once on mount; subscribes to events; merges live + REST history. **Never calls `eventStream.stop()`.** |
| [components/orders/IncomingOrderTray.jsx](../frontend/src/components/orders/IncomingOrderTray.jsx) | Direct subscriber. Currently *unrendered* in POSPage but file still imports `eventStream`. |
| [components/pos/PreparationQueueModal.jsx](../frontend/src/components/pos/PreparationQueueModal.jsx) | Direct subscriber, mounts/unmounts with the modal. |
| [components/ErrorBoundary.jsx](../frontend/src/components/ErrorBoundary.jsx) | Wraps app. `console.error` only — no remote/buffered logging. |

---

## 2. Phase 1 — Capture the crash *(2–3 hrs)*

The reason "app crash, no logs" is the worst-case state is that errors fired from `EventSource` callbacks (or any non-render path) escape both React's render error path and the ErrorBoundary. First job is **getting visibility**.

### 1.1 Global error/rejection logger
Add to [main.jsx](../frontend/src/main.jsx) **before** mounting React:

- `window.addEventListener("error", …)` — sync errors.
- `window.addEventListener("unhandledrejection", …)` — async/Promise.
- Persist last 50 entries to `localStorage["debug:errors"]` so the next reload doesn't lose them.
- Mirror to `console.error` for live debugging.

Each entry: `{ ts, source, message, stack, url, line, col }`.

### 1.2 SSE telemetry breadcrumbs
Inside [eventStreamService.js](../frontend/src/services/eventStreamService.js), at every state transition:
- `_connect` start/end, ticket success/failure
- `onopen`, `onerror`, `_scheduleReconnect` with `retryMs`
- `_dispatch` per event type
- `start` / `stop`

Push into the same `localStorage["debug:errors"]` ring buffer (capped, e.g., 200 entries). Tag with `source: "sse"`.

### 1.3 Backend SSE lifecycle log
[routes/events.js](../backend/routes/events.js) currently only `console.error`s replay failures. Add:
- `connect` log line: userId, lastEventId, replay count.
- `disconnect` log line: userId, duration, reason (close/error).
- `publish` count per topic per minute (cheap counter; flush on interval).

### 1.4 Reproduce
With breadcrumbs on, reproduce the navigation crash. Inspect:
- Browser console
- `localStorage["debug:errors"]`
- Backend stdout

→ The breadcrumb that immediately precedes the crash points at the right phase to investigate next.

---

## 3. Phase 2 — Fix confirmed risks *(independent of the crash)*

Each row is an actual issue found while mapping. Triaged by impact.

| # | Issue | File | Severity | Fix sketch |
|---|---|---|---|---|
| **R1** | `eventStream.stop()` is **never called**. Logout works only because `AuthService.logout` does `window.location.href = "/"` (hard reload). If the provider mounts pre-login, a connection loop runs against `/events/ticket` returning 401. | [RealtimeNotificationsContext.jsx:65-70](../frontend/src/contexts/RealtimeNotificationsContext.jsx#L65) | High | Call `eventStream.stop()` in the cleanup of the main `useEffect`. Gate `start()` on token presence + watch `storage` events to react to cross-tab logout. |
| **R2** | `localStorage["sse:lastEventId"]` is **shared across users** on the same device. `clearReplayCursor()` exists but is never called. Backend filters by `userId`, so not a leak — but cursor namespace is wrong for User B. | [eventStreamService.js:14,158](../frontend/src/services/eventStreamService.js#L14) | Med | Namespace the key by `userId`. Call `clearReplayCursor()` from `AuthService.logout`. |
| **R3** | No reaction to **token rotation**. Effect deps are `[refresh]` (stable); the EventSource keeps running. Self-heals on next reconnect because tickets are single-use, but worth tightening. | [RealtimeNotificationsContext.jsx:65-112](../frontend/src/contexts/RealtimeNotificationsContext.jsx#L65-L112) | Low | Listen for `storage` events on the `token` key and `stop()` + `start()` if it changes. |
| **R4** | A subscriber that throws is logged but **may corrupt React state** if the throw happens inside `setNotifications((prev) => …)`. ErrorBoundary won't catch this — it's outside the render tree. | [eventStreamService.js:127-133](../frontend/src/services/eventStreamService.js#L127) | High | Wrap each subscriber body in try/catch. Buffer to debug log. Suspected primary cause of the silent crash. |
| **R5** | `bus.publish` is **not awaited**. In-memory it's sync so fine; but when `EVENT_BUS=redis` lands, missing await will silently drop publishes. | [orderService.js:88-95,196-202](../backend/lib/orderService.js#L88) | Low (future) | `await Promise.all(publishes)` before returning from publishers. Add now to avoid retrofit. |
| **R6** | `branchId` type drift. `PreparationQueueModal` accepts both string and number forms; `IncomingOrderTray` uses `===` only. Dormant since the tray isn't rendered. | [IncomingOrderTray.jsx:53](../frontend/src/components/orders/IncomingOrderTray.jsx#L53) | Low | Coerce both sides to `Number(...)` once. |
| **R7** | `IncomingOrderTray.jsx` is **dead code** but still imports `eventStream`. Risk of accidental re-introduction without thinking through subscription lifecycle. | [IncomingOrderTray.jsx](../frontend/src/components/orders/IncomingOrderTray.jsx) | Low | Decision: delete or keep behind a feature flag. |

---

## 4. Phase 3 — Hypotheses for the silent navigate crash

Ranked by likelihood given the recent changes:

1. **Subscriber throw escapes React.** Likely culprit: the deduplication path in `RealtimeNotificationsContext` reads `event.id`, but an `ORDER_STATUS_CHANGED` payload with a missing field crashes a downstream component synchronously inside `setState`. ErrorBoundary doesn't catch since the throw originates in an `EventSource` callback.
   → Confirmed by **Phase 1** breadcrumbs + **R4** fix.

2. **Render error during route change.** A page that reads from `useRealtimeNotifications` may render before the provider's first `refresh()` completes. If a downstream component dereferences a payload field that no longer exists (e.g., `n.payload.clientName.toLowerCase()`), you'll get a render error. ErrorBoundary *should* catch this — if it doesn't, ensure the boundary actually wraps the route tree, not just the app shell. Verify in [main.jsx](../frontend/src/main.jsx) and [App.jsx](../frontend/src/App.jsx).

3. **EventSource reconnect storm.** If `/events/ticket` returns 401 repeatedly (token expired silently), the loop runs forever with backoff capped at 30s. Won't crash a healthy tab but burns CPU. Confirm by counting `[SSE] ticket request failed` lines in the breadcrumb buffer.

4. **Backend listener leak under load.** `bus.emitter.setMaxListeners(0)` masks the warning. If a SSE connection's `unsubscribe` doesn't fire because `req.on("close")` is delayed (proxy buffering), listeners accumulate. Long-running symptom — drift over hours/days, not a navigate-time crash. Watch backend RSS.

---

## 5. Phase 4 — Verification checklist

After Phase 1 + 2 land, verify:

- [ ] Open POS, log out, log in as a different user → exactly **one** EventSource visible in DevTools Network tab.
- [ ] Throttle network in DevTools → reconnects with exponential backoff, `retryMs` resets after a successful `onopen`.
- [ ] Backend log shows a matching `disconnect` for every `connect` line, including tab close.
- [ ] Force `/events/ticket` → 500 once (e.g., short-circuit in middleware) → frontend retries, recovers, no white screen.
- [ ] Manually publish `{ type: "NEW_CALL_CENTER_ORDER", payload: null }` → bell stays alive, breadcrumb captures the error.
- [ ] Logout from one tab → other tab on same browser closes its EventSource (after **R3** lands).

---

## 6. Recommended execution order

1. **Phase 1.1 + 1.2** *(30 min)* — global error logger + SSE breadcrumbs. Highest leverage; tells us the answer.
2. **Phase 1.3** *(15 min)* — backend connect/disconnect logs.
3. **Reproduce** the crash with the new visibility.
4. **R4** *(20 min)* — wrap subscribers in try/catch; ship even if Phase 1 didn't pinpoint the cause.
5. **R1 + R2** *(45 min)* — proper `stop()` on logout, namespaced cursor.
6. **Phase 4** verification.
7. **R5–R7** as cleanup batch.

Total: ~3–4 hours for full sweep. ~1 hour to get visibility + the most likely fix shipped.

---

## 7. Out of scope (note for later)

- Switching to Redis-backed bus (interface is ready; no code yet).
- Per-branch topic subscriptions instead of per-user (would simplify `broadcastStatusChange`).
- WebSocket migration (current SSE design is fine for one-way push; revisit only if bidirectional needs emerge).
