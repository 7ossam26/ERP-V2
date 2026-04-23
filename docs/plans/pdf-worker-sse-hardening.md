# PDF Worker + SSE Production-Readiness Hardening

**Branch:** `feat/call-center-phase-1`
**Date:** 2026-04-23
**Status:** Pillar 3 ready to implement; Pillar 1 + 2 superseded for bulk invoice printing on 2026-04-23

---

## 1. Overview

> **Update - 2026-04-23:** Bulk order invoice printing now follows the browser-native HTML print path from [pdf-arabic-rendering.md](./pdf-arabic-rendering.md). That supersedes this plan's Pillar 1 (worker PDF rendering) and Pillar 2 (font prefetch) for the bulk invoice flow. Pillar 3 (SSE hardening) remains valid.

### Problem
Clicking **Print / PDF** on a bulk order ([BulkOrderDetailPage.jsx](frontend/src/pages/bulk/BulkOrderDetailPage.jsx)) sometimes freezes the browser tab for tens of seconds, leaves the button stuck on `جارٍ الإنشاء…`, and drops the SSE connection to the backend. Users misread the symptom as "the backend crashed".

### Diagnosis (confirmed with user)
- **B2 — Main-thread blocking.** `@react-pdf/renderer` v4 runs its layout reconciler synchronously. On the main thread, this blocks paint, input, *and* the EventSource heartbeat path. Eventually the PDF does render and a tab opens, but by then SSE has been marked dead.
- **T4 — Non-deterministic freeze duration.** Freeze length doesn't scale with line count — a 1-line order can hang as long as a 20-line one. Points at font fetch / parse racing with render, not layout cost.

### Goals
1. **PDF rendering off the main thread** via a dedicated Web Worker.
2. **Deterministic font loading** — fonts pre-fetched once at app bootstrap, registered from `ArrayBuffer`s inside the worker.
3. **SSE production-readiness hardening** — audit-driven, surgical fixes plus minimal observability.

### Non-goals
- ❌ Server-side PDF rendering (Puppeteer, headless Chrome, etc.).
- ❌ Switching PDF libraries (`pdfmake`, `jsPDF`).
- ❌ Changing the SSE wire protocol, event payloads, or pub/sub model.
- ❌ Redesigning the invoice layout in [BulkInvoicePDF.jsx](frontend/src/components/bulk/BulkInvoicePDF.jsx).
- ❌ Introducing a multi-tab leader-election scheme (recorded as future work).
- ❌ Feature flag / staged rollout — ship in place on `feat/call-center-phase-1`.

---

## 2. Diagnosis — Signal Trail

| Signal | Observation | Implication |
|---|---|---|
| Button stuck on "جارٍ الإنشاء…" | `pdf().toBlob()` runs long on main thread | Blocking render |
| "Backend drops" | No crash logs, only `[proxy] ECONNRESET /api/events/stream` | SSE dropout misread as backend death |
| 1-line order hangs equally | Line count doesn't drive freeze time | Font fetch/parse, not layout |
| Sometimes fast, sometimes minute+ | Non-deterministic | Race: fonts fetched lazily per render |
| Vite proxy noise already suppressed | ECONNRESET silenced in [vite.config.js](frontend/vite.config.js) | Confirms no backend error, just socket teardown |

---

## 3. Design

### 3.1 Pillar 1 + 2 — PDF Worker with Pre-fetched Fonts

#### File inventory after implementation

| Path | Status | Purpose |
|---|---|---|
| `frontend/src/workers/pdfWorker.js` | **new** | Web Worker entry. Imports React, `@react-pdf/renderer`, `BulkInvoicePDF`, `Font`. Handles render requests, owns font registration. |
| `frontend/src/utils/pdfFonts.js` | **new** | Bootstraps font fetch: returns a memoised `Promise<{regular, latin}>` of `ArrayBuffer`s. |
| `frontend/src/utils/pdfClient.js` | **new** | Main-thread RPC client. Owns singleton Worker, monotonic request id, pending-map, timeout logic. Exposes `renderOrderPdf(order, doc) → Promise<Blob>`. |
| `frontend/src/utils/pdfGenerate.js` | **modified** | Becomes a thin façade over `pdfClient` + synchronous tab-open flow. |
| `frontend/src/components/bulk/BulkInvoicePDF.jsx` | **modified** | Removes `Font.register` call; becomes pure presentational. Font registration moves into the worker. |
| `frontend/src/main.jsx` | **modified** | Calls `preloadPdfFonts()` at startup (fire-and-forget). |

#### Worker lifecycle

- **Single instance**, created lazily on first `renderOrderPdf` call.
- Stored in a module-level variable; reused across prints.
- **Recreated** on: hard timeout (30s), uncaught error, or explicit `terminate()` (only used in tests).

#### Font flow

1. **Bootstrap (main thread, app start):**
   ```
   pdfFonts.preload()
     → fetch('/fonts/Cairo-Regular.woff2').then(r => r.arrayBuffer())
     → fetch('/fonts/Cairo-Latin-Regular.woff2').then(r => r.arrayBuffer())
     → stores ArrayBuffers in module-level Promise
   ```
2. **First render:** `pdfClient` awaits `pdfFonts.preload()`, then posts the two `ArrayBuffer`s to the worker using `Transferable` (zero-copy hand-off).
3. **Worker:** receives buffers, wraps each in a `Blob`, obtains a `blob:` URL via `URL.createObjectURL`, calls `Font.register({ family: 'Cairo', fonts: [{src: blobUrl}, {src: blobUrlLatin}] })`.
4. **Subsequent renders:** worker reuses already-registered fonts; main thread omits `fonts` from the message.

> **Why not pass buffers as plain data?** `Transferable` avoids a structured-clone of 200–300 KB per font on every message. Font transfer happens **once**.

> **Why `blob:` URLs inside the worker?** `@react-pdf/font` passes `src` through `is-url()`; HTTP URLs and `blob:` URLs both pass, triggering the `fetch` path and avoiding the Node `fontkit.open()` fallback that we already know breaks in the browser. If during implementation we discover `is-url()` rejects `blob:`, the fallback is to serve fonts via a data URL constructed from the buffer — same deterministic guarantee, slightly larger in memory.

#### Message protocol

```
Main → Worker
  { kind: 'render', id: number, order: object, doc: object|null,
    fonts?: { regular: ArrayBuffer, latin: ArrayBuffer } }

Worker → Main
  { kind: 'result',    id: number, blob: Blob }
  { kind: 'error',     id: number, message: string, stack?: string }
  { kind: 'ready' }     // posted once on worker start, used by client to warm up
```

#### Tab-open UX (popup-blocker safe)

Current code calls `window.open` **after** `await pdf().toBlob()` — that's "programmatic open" in some browsers and gets blocked. New flow:

```js
// In openPdf handler (synchronous path until render starts):
const win = window.open("about:blank", "_blank");  // sync, passes blocker
try {
  const blob = await renderOrderPdf(order, doc);
  const url = URL.createObjectURL(blob);
  if (win && !win.closed) {
    win.location.href = url;
  } else {
    // fallback: anchor download
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.orderNumber || order.id}.pdf`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
} catch (err) {
  if (win && !win.closed) win.close();
  throw err;
}
```

#### Timeout + error handling

- **Hard 30 s timeout** on each `renderOrderPdf` call.
- On timeout: `worker.terminate()`, clear pending map entries (reject all with `TIMEOUT`), null the singleton. Next call creates a new worker.
- On worker `error` or `messageerror` event: same recovery path.
- Client surfaces a single toast `تعذر إنشاء PDF`; full error logged to console with `[PDF]` prefix.

#### Vite build config

Vite supports workers out-of-the-box via:
```js
new Worker(new URL("./pdfWorker.js", import.meta.url), { type: "module" })
```
No `vite.config.js` change required. In production build, Vite emits a hashed worker chunk; React + @react-pdf get bundled into that chunk only (verified by build stats after first implementation step).

---

### 3.2 Pillar 3 — SSE Audit Findings + Hardening

#### Audit scope

Files reviewed: [eventStreamService.js](frontend/src/services/eventStreamService.js) · [backend/routes/events.js](backend/routes/events.js) · [backend/lib/eventBus.js](backend/lib/eventBus.js) · [RealtimeNotificationsContext.jsx](frontend/src/contexts/RealtimeNotificationsContext.jsx) · [IncomingOrderTray.jsx](frontend/src/components/orders/IncomingOrderTray.jsx) · [vite.config.js](frontend/vite.config.js).

#### Findings

Severity legend: 🔴 bug · 🟡 robustness · 🟢 observability / polish.

**Client — `eventStreamService.js`**

| # | Severity | Finding | Fix |
|---|---|---|---|
| C1 | 🔴 | No **jitter** on reconnect backoff — after backend restart, all tabs reconnect in lockstep (thundering herd). | Add `±20 %` random jitter to `retryMs` before scheduling. |
| C2 | 🔴 | No **Page Visibility** handling. Hidden tabs hold an open EventSource, waste backend connections, and don't gracefully pause on system sleep. | On `document.visibilitychange`: when hidden → close source, pause reconnect. When visible → reconnect immediately (reset backoff). |
| C3 | 🟡 | `localStorage.sse:lastEventId` is shared across tabs with **no coordination**. Tab A receives id 100, tab B receives id 99, whichever writes last wins. Causes spurious replay on reconnect. | Use `BroadcastChannel('sse')` to broadcast the highest-seen id. Each tab takes `max(local, received)`. |
| C4 | 🟡 | `onerror` handler doesn't **distinguish** auth failures from network drops. Keeps retrying forever on 401. | Fetch `/events/ticket` returns 401 → surface "token expired" + call `clearReplayCursor()`; stop reconnecting until app re-authenticates. |
| C5 | 🟢 | Silent dropouts — no log line on close/reconnect. | Add structured `[SSE] action=<open|close|reconnect|error> retryMs=<n> lastEventId=<id>` console lines at `info` level. |
| C6 | 🟢 | Listener exceptions are caught but not rate-limited; a broken consumer spams console on every event. | Dedupe repeated errors with a 5 s window. |

**Server — `backend/routes/events.js`**

| # | Severity | Finding | Fix |
|---|---|---|---|
| S1 | 🔴 | No **per-user connection limit**. A buggy or hostile client can open hundreds of streams. | Track `Map<userId, Set<res>>`. Cap at 5 concurrent streams per user; close oldest on over-limit. |
| S2 | 🔴 | `purgeExpiredTickets` only runs when a **new ticket is issued**. If traffic pauses, expired entries pile up. | Add a `setInterval(purgeExpiredTickets, 60_000)` guarded by `unref()` so it doesn't keep the process alive. |
| S3 | 🔴 | Replay **silently truncates** at 200 missed events. Client has no way to know. | Change query to `take: 201`; if we got 201, drop the last and emit `event: replay-truncated` so the client hard-refreshes history. Currently truncation is only signalled when `lastKnown` is missing — distinct case. |
| S4 | 🟡 | `parseInt(lastEventIdHeader)` without radix — works by luck since no hex ids, but lint-flaggable and a footgun if ids ever become alphanumeric. | `parseInt(s, 10)`. |
| S5 | 🟡 | No **origin check** on `/events/stream`. EventSource sends `Origin`; we never compare. | Validate `req.headers.origin` against `env.ALLOWED_ORIGINS` (comma-separated). 403 otherwise. |
| S6 | 🟡 | Possible interaction with `compression` middleware — SSE responses must not be gzipped. Check if `Content-Type: text/event-stream` is excluded from compression. | Explicit `res.setHeader('Content-Encoding', 'identity')` before `flushHeaders()`, plus `compression({ filter })` that excludes `text/event-stream`. |
| S7 | 🟢 | No logs on stream open/close. Can't correlate client reconnect storms with server events. | Add `[SSE] open userId=X` and `[SSE] close userId=X duration=<ms> reason=<n>` logs. |
| S8 | 🟢 | `ticketStore` metrics absent. | Expose `/api/events/health` (auth-gated admin) returning `{ activeStreams, pendingTickets, lastPublishAt }`. |

**Client context — `RealtimeNotificationsContext.jsx`**

| # | Severity | Finding | Fix |
|---|---|---|---|
| X1 | 🔴 | No handler for `event: replay-truncated`. When server signals truncation, client never refreshes REST history — unread count stays stale. | Add a named event listener that calls `refresh()`. |
| X2 | 🔴 | `dismissForOrder` recomputes unread count from **stale `notifications`** captured in closure (line 198 of the original file). Off-by-N on rapid dismisses. | Compute inside functional `setUnreadCount` + functional `setNotifications` using `prev`. |
| X3 | 🟡 | No **explicit logout hook**. Relies on `token` removal + onerror death spiral. | When logout fires, call `eventStream.stop()` and `eventStream.clearReplayCursor()` deterministically. |
| X4 | 🟡 | `soundRef` initialised in `useEffect` — first notification can arrive before audio element exists. | Initialise synchronously in ref's initializer (`useRef(() => new Audio(...))` pattern via a helper). |

**Client consumer — `IncomingOrderTray.jsx`**

| # | Severity | Finding | Fix |
|---|---|---|---|
| T1 | 🟡 | Subscribes to `eventStream` directly, **in parallel** with the context subscription. Both fire `refresh()` paths for the same event — minor but wasteful. | Derive tray's refresh trigger from context instead of dual-subscribing. |

**Bus — `backend/lib/eventBus.js`**

| # | Severity | Finding | Fix |
|---|---|---|---|
| B1 | 🟢 | `publish` declared `async` but never awaits; API contract ambiguous for future Redis adapter. | Document: "publishers may omit `await`; in-memory publishes are synchronous-by-effect". No code change now. |

#### Observability additions (3-A minimum bar)

1. **Client:** structured `[SSE]` console logs at state transitions.
2. **Server:** `[SSE]` logs on connect / disconnect / replay / ticket issue / ticket reject.
3. **Admin health endpoint:** `GET /api/events/health` returning live counts (connections, tickets, last publish).
4. **No Prometheus / no external metrics pipeline** in this pass — recorded as future work.

---

## 4. Implementation Plan (ordered)

Each step is independently commit-able. Test after each. No step depends on a subsequent step's correctness.

### Phase A — PDF Worker (target: print button stops freezing)

1. **A1.** Create `frontend/src/utils/pdfFonts.js` with `preloadPdfFonts()`. Verify buffers arrive via DevTools Network tab at app boot.
2. **A2.** Create `frontend/src/workers/pdfWorker.js`. Handle `render` message, register fonts from buffers, return blob. Include the `ready` handshake.
3. **A3.** Create `frontend/src/utils/pdfClient.js` with singleton worker, RPC plumbing, 30 s timeout, error recovery.
4. **A4.** Rewrite `frontend/src/utils/pdfGenerate.js` to use the client + synchronous tab-open.
5. **A5.** Remove `Font.register` from `BulkInvoicePDF.jsx` (now a pure component).
6. **A6.** Hook `preloadPdfFonts()` into `frontend/src/main.jsx` (fire-and-forget on app mount).
7. **A7.** Manual QA: print 1-line order, print 20-line order (if one exists), print while SSE is active — confirm SSE stays connected (visible via the existing connection-status indicator, green/yellow dot).
8. **A8.** Build check: `npm run build` — inspect chunk sizes; confirm worker chunk is separate and main chunk didn't grow disproportionately.

### Phase B — SSE client hardening

9. **B1.** Fix C1 (jitter) + C5 (structured logs) — `eventStreamService.js`.
10. **B2.** Fix C2 (Page Visibility).
11. **B3.** Fix C3 (`BroadcastChannel` for `lastEventId`).
12. **B4.** Fix C4 (401 detection).
13. **B5.** Fix X1 (replay-truncated handler), X2 (stale closure), X3 (logout hook) — `RealtimeNotificationsContext.jsx`.
14. **B6.** Fix T1 (context-driven refresh) — `IncomingOrderTray.jsx`.

### Phase C — SSE server hardening

15. **C1.** Fix S1 (per-user connection cap).
16. **C2.** Fix S2 (interval-based ticket purge).
17. **C3.** Fix S3 (replay truncation detection).
18. **C4.** Fix S4 (parseInt radix).
19. **C5.** Fix S5 (origin check) — behind env var so dev doesn't break.
20. **C6.** Fix S6 (compression exclusion) — verify first; change only if compression is actually active on the route.
21. **C7.** Fix S7 (connect/disconnect logs).
22. **C8.** Add S8 (`/api/events/health`) — admin-gated.

### Phase D — Regression sweep

23. **D1.** Integration test: existing `backend/tests/integration/events.integration.test.js` still passes.
24. **D2.** Manual: open two tabs as same user, trigger a new call-center order, confirm both tabs receive it (BroadcastChannel) without duplicate toasts.
25. **D3.** Manual: kill backend, confirm both tabs show "offline", restart backend, confirm both reconnect (jittered, no thundering herd).
26. **D4.** Manual: print a PDF while a new order event arrives — confirm tray updates AND PDF renders, neither blocks the other.

---

## 5. Testing Strategy

- **Unit:** `pdfClient` timeout + worker-recreation logic — mock Worker.
- **Integration (existing):** `events.integration.test.js` — extend with truncation scenario (>200 events missed).
- **E2E manual:** the four QA scenarios in Phase D.
- **No new E2E automation** in this pass — PDF rendering is visually verified, SSE is verified via the connection-status dot that already exists.

---

## 6. Decision Log

| # | Decision | Alternatives | Reason |
|---|---|---|---|
| 1 | PDF stays 100 % client-side | Server-side Puppeteer / headless Chrome | User constraint; avoids backend CPU cost |
| 2 | Root cause = main-thread block + font race (B2 + T4) | Real backend crash; popup blocker (C); silent `.toBlob()` hang (D) | Matches observed behaviour |
| 3 | SSE review = broad production-readiness (Z+ / ii) | Narrow PDF-collateral only | User picked Z+ |
| 4 | PDF via **dedicated Web Worker** | `requestAnimationFrame` yielding on main thread; hidden `<iframe>` sandbox | Only option that actually frees the main thread |
| 5 | Fonts pre-fetched at app bootstrap, passed to worker as `ArrayBuffer` | Inline base64 in bundle; URL-only pre-warm | Deterministic; eliminates T4 race; no bundle bloat |
| 6 | SSE hardening: **audit + surgical + observability** | BroadcastChannel single-tab leader (deferred); no-op audit | Matches current scale; defer leader election |
| 7 | Synchronous `window.open('about:blank')` on click | Download anchor only | Preserves "open in new tab" UX without popup-blocker risk |
| 8 | 30 s hard timeout on PDF render | No timeout (silent hang); per-step timeouts | Bounded UX; worker-recreation recovers from any stuck state |
| 9 | Single worker instance reused | Worker-per-render | Avoids startup cost (React bundle) on every print |
| 10 | `blob:` URL inside worker for font registration | Data URL; passing buffer to Font.register directly | Minimal memory overhead; fallback to data URL if `is-url()` rejects `blob:` |
| 11 | Keep in-memory `ticketStore` + `EventBus` | Redis adapter now | Current deploy is single-instance; Redis wiring is already stubbed |
| 12 | No new E2E automation | Playwright spec for SSE-during-PDF | Out of scope for this pass; connection-status indicator is sufficient for manual QA |

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@react-pdf/renderer` v4 has hard `window` / `document` dependency and won't run in a Worker | Low-Medium | High (blocks Phase A) | Spike A2 first; if it fails, pivot to main-thread hardening (font pre-warm + `requestIdleCallback` chunking + SSE pause during render). Fallback plan documented. |
| `is-url()` rejects `blob:` URLs in worker context | Medium | Low | Fallback to `data:font/woff2;base64,…` URLs — same deterministic guarantee, one extra base64 encode per font, one-time cost |
| Worker chunk is too large (> 1 MB gzipped) | Low | Medium | Inspect with `vite build --report`. Current `@react-pdf` is ~200 KB gzipped + React ~40 KB — should land well under 300 KB |
| Page Visibility reconnect interacts badly with BroadcastChannel `lastEventId` | Medium | Low | Explicit ordering: on `visible`, read latest id from storage + BC, then reconnect |
| S1 (per-user cap) breaks a legitimate workflow (user opens 6 tabs) | Low | Medium | Cap at 5, close **oldest**, not newest. Include userId + count in the close-reason log |
| Origin check (S5) breaks Vite dev (port 5173 vs backend 3001) | Medium | Low | Gate behind `ALLOWED_ORIGINS` env var; default allows all in development mode |
| SSE + compression middleware interaction (S6) is a ghost — compression may not actually be on the route | Medium | Low | Verify before changing; if already excluded, skip the fix and document |

---

## 8. Future Work (explicitly out of scope)

- **Multi-tab leader election** via BroadcastChannel: only one tab per user opens SSE, others receive events through BC. Cuts server fan-out by N. Worth doing when concurrent users × tabs-per-user crosses ~500.
- **Redis event bus adapter**: interface is already stubbed in [eventBus.js](backend/lib/eventBus.js). Required for horizontal scaling.
- **Prometheus / external metrics** for SSE connection count, replay truncation rate, ticket churn.
- **Playwright E2E spec** that triggers a heavy PDF during active SSE + asserts the connection stays open.
- **Shared PDF renderer** for other modules (if the POS sales receipt / reports also need PDFs later, they can import `pdfClient.renderGenericPdf(component, props)`).

---

## 9. Assumptions (for future-me)

1. Vite version is 5+ and supports `new Worker(new URL(...), { type: 'module' })`. Verified: `frontend/package.json` uses Vite 5.x (to confirm at implementation time).
2. `@react-pdf/renderer` v4 core reconciler has no `window` / `document` dependency. Verified by reading its source in the prior debugging session.
3. Edge is the primary target; WOFF2 is supported.
4. Only `BulkInvoicePDF` consumes `@react-pdf/renderer` today (grep to confirm before touching `pdfGenerate.js` API).
5. No HTTP compression is configured for `text/event-stream`. To verify as part of S6 before making any change.
6. The `Notification` table TTL job exists elsewhere and is not in scope.

---

## 10. Confirmation Checklist (pre-implementation)

- [ ] User confirms plan
- [ ] Spike verifies `@react-pdf/renderer` runs in Web Worker context (A2)
- [ ] Spike verifies `is-url()` accepts `blob:` URLs OR we commit to data-URL fallback
- [ ] Confirm Vite version ≥ 5
- [ ] Confirm no other consumer of `@react-pdf/renderer` exists (grep `@react-pdf/renderer`)
- [ ] Confirm compression middleware configuration on `/api/events/stream` before S6

---
