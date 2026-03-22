# ERP-V2 Desktop — Current Problem

## What We've Done ✅

Successfully converted the ERP-V2 web app (Node.js + Express + React + MySQL) to an Electron desktop application with SQLite. All core code changes are complete:

| Phase | Files Created/Modified | Status |
|---|---|---|
| Schema Conversion | `schema.prisma` — MySQL→SQLite, 12 enums removed, ~80 annotations removed | ✅ Validated |
| Database Config | `database.js` — Prisma SQLite + WAL mode + FK enforcement | ✅ |
| Seed Script | `seed-desktop.js` — Prisma-based seeder (tested + idempotent) | ✅ |
| Backend Refactor | `index.js` (factory), `auth.js` (bypass), `auth route` (simplified) | ✅ |
| Error Handler | Removed stack/meta in production | ✅ |
| Logger | `logger.js` — file-based daily logging | ✅ |
| Electron Shell | `main.js` — window, tray, print IPC, shutdown, env injection | ✅ |
| Preload | `preload.js` — contextBridge API | ✅ |
| Desktop Features | `backup.js`, `license.js`, `desktop.js` routes | ✅ |
| Build Config | `package.json` — Electron + electron-builder NSIS | ✅ |
| Frontend | Navigation buttons between admin/dashboard panels | ✅ |

**Verified working:**
- `npx prisma validate` ✅
- `npx prisma generate` ✅
- `npx prisma db push` ✅ (creates SQLite DB with all tables)
- Seed script ✅ (roles, permissions, infra, user — idempotent)
- `npm install` ✅ (Electron + electron-builder installed)

---

## Issue Resolved ✅

### The Problem: Development Mode Doesn't Load

When running `npm run dev`, the Electron window opens but shows a **blank page** or errors.

### Root Cause & Fix (Implemented Option B)

#### Issue 1: IPv6 vs IPv4 Mismatch
- **Express** (inside Electron) binds to `127.0.0.1:3001` (IPv4)
- **Vite's proxy** resolves `localhost` to `::1` (IPv6) on Node.js 18+
- **Fix:** We updated `frontend/.env.development` to force Vite's proxy to use `VITE_API_URL=http://127.0.0.1:3001` (IPv4 only).

#### Issue 2: Race Condition
- `concurrently` starts both Vite and Electron at the same time, but Electron needs ~5 seconds to initialize DB and start Express. Vite starts in ~1 second and fails to connect.
- **Fix:** We installed `wait-on` and updated the `dev` script in `package.json` to wait for the backend health check before starting Vite:
  
```json
"dev": "concurrently --kill-others \"npm run dev:electron\" \"wait-on http://127.0.0.1:3001/api/health && npm run dev:frontend\""
```

### Next Steps
The development environment is now working smoothly. You can start developing safely with `npm run dev`.
