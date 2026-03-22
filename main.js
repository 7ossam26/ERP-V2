/**
 * ERP-V2 Desktop — Electron Main Process
 *
 * Responsibilities:
 *  - Single-instance lock
 *  - Environment injection (BEFORE any require)
 *  - Database initialization + seeding
 *  - Spawn internal Express server
 *  - Create secure BrowserWindow
 *  - System tray (minimize to tray)
 *  - Print IPC support
 *  - Graceful shutdown (HTTP server → Prisma → quit)
 */

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

// ── Prevent multiple instances ──────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ── Paths ───────────────────────────────────────────────────────────────────
const USER_DATA = app.getPath("userData");
const DB_PATH = path.join(USER_DATA, "erp-v2.db");
const LOGS_DIR = path.join(USER_DATA, "logs");
const BACKUPS_DIR = path.join(USER_DATA, "backups");

// Backend directory: in dev it's ./backend, in production it's in extraResources
const BACKEND_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "backend")
  : path.join(__dirname, "backend");

// Ensure directories exist
[LOGS_DIR, BACKUPS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Environment config (MUST be set BEFORE requiring backend) ───────────────
const IS_DEV = !app.isPackaged;
const PORT = IS_DEV ? 3001 : 0;

process.env.NODE_ENV = IS_DEV ? "development" : "production";
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "b0a5f54f9695ce89255622f0a15c5518dab3a6037bc4fb75884d5cb962a25741";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "365d";
process.env.AUDIT_SECRET =
  process.env.AUDIT_SECRET ||
  "2a9b8dc3c31e6743dee9d3490f0c48624f341d0655281b0a0495018bb5069332";
process.env.ERP_DB_PATH = DB_PATH;
process.env.ERP_LOGS_DIR = LOGS_DIR;
process.env.ERP_BACKUPS_DIR = BACKUPS_DIR;
process.env.ERP_USER_DATA = USER_DATA;

// ── Globals ─────────────────────────────────────────────────────────────────
let mainWindow = null;
let httpServer = null;
let serverPort = null;
let tray = null;
let isQuitting = false;

// ── Create Window ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "ERP System",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: true,
      devTools: IS_DEV,
    },
    show: false,
  });

  // Show when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools();
  });

  // In dev mode, load from Vite dev server (port 5173)
  // In production, load from the embedded Express server
  const VITE_DEV_URL = "http://localhost:5173";
  const loadUrl = IS_DEV ? VITE_DEV_URL : `http://localhost:${serverPort}`;
  mainWindow.loadURL(loadUrl);

  // ── Minimize to tray instead of closing (Production only) ─────────
  mainWindow.on("close", (event) => {
    if (!isQuitting && !IS_DEV) {
      event.preventDefault();
      mainWindow.hide();
      // Show balloon only on first hide
      if (tray && !mainWindow._trayNotified) {
        tray.displayBalloon({
          iconType: "info",
          title: "ERP System",
          content: "App is still running in the background.",
        });
        mainWindow._trayNotified = true;
      }
    } else if (IS_DEV) {
       // In dev mode, always quit fully when the window closes to prevent orphaned processes
       isQuitting = true;
       app.quit();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = IS_DEV
      ? url.startsWith("http://localhost:5173") || url.startsWith(`http://localhost:${serverPort}`)
      : url.startsWith(`http://localhost:${serverPort}`);
    if (!allowed) {
      event.preventDefault();
    }
  });

  // Block new window creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Block DevTools shortcut in production
  if (!IS_DEV) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12" || (input.control && input.shift && input.key === "I")) {
        event.preventDefault();
      }
    });
  }
}

// ── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "build", "icon.ico");
  let trayIcon;

  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple 16x16 fallback icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("ERP System");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click to restore
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Start Express Server ────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const { createServer } = require(path.join(BACKEND_DIR, "index"));
      const expressApp = createServer();

      httpServer = expressApp.listen(PORT, "127.0.0.1", () => {
        serverPort = httpServer.address().port;
        console.log(`[ELECTRON] Express server running on port ${serverPort}`);
        resolve(serverPort);
      });

      httpServer.on("error", (err) => {
        console.error("[ELECTRON] Server error:", err);
        reject(err);
      });
    } catch (err) {
      console.error("[ELECTRON] Failed to start server:", err);
      reject(err);
    }
  });
}

// ── Graceful shutdown ───────────────────────────────────────────────────────
let shutdownComplete = false;

async function gracefulShutdown() {
  if (shutdownComplete) return;
  shutdownComplete = true;

  console.log("[ELECTRON] Graceful shutdown initiated...");

  // 1. Close HTTP server
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => {
        console.log("[ELECTRON] HTTP server closed.");
        resolve();
      });
      setTimeout(resolve, 5000); // Force after 5s
    });
  }

  // 2. Close Prisma database connection
  try {
    const { close } = require(path.join(BACKEND_DIR, "config", "database"));
    await close();
    console.log("[ELECTRON] Database closed.");
  } catch (err) {
    console.error("[ELECTRON] Error closing database:", err.message);
  }
}

// ── IPC Handlers ────────────────────────────────────────────────────────────
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-app-path", () => USER_DATA);
ipcMain.handle("get-server-port", () => serverPort);

// Print support
ipcMain.handle("print-page", async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: "No window available" };

  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent || false,
        printBackground: options.printBackground !== false,
        ...options,
      },
      (success, failureReason) => {
        resolve({ success, error: failureReason || null });
      }
    );
  });
});

ipcMain.handle("print-to-pdf", async () => {
  if (!mainWindow) return { success: false, error: "No window available" };

  try {
    const pdfData = await mainWindow.webContents.printToPDF({});
    return { success: true, data: pdfData };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── App lifecycle ───────────────────────────────────────────────────────────
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    console.log("[ELECTRON] Starting up...");
    console.log(`[ELECTRON] User Data: ${USER_DATA}`);
    console.log(`[ELECTRON] Database: ${DB_PATH}`);
    console.log(`[ELECTRON] Mode: ${IS_DEV ? "DEVELOPMENT" : "PRODUCTION"}`);

    // Initialize database & create tables
    const { initializeDatabase } = require(path.join(BACKEND_DIR, "config", "database"));
    await initializeDatabase();

    // Run seed if database is empty
    const { runSeedIfNeeded } = require(path.join(BACKEND_DIR, "scripts", "seed-desktop"));
    await runSeedIfNeeded();

    // Start Express
    await startServer();

    // Create system tray
    createTray();

    // Create window
    createWindow();

    console.log("[ELECTRON] ✅ Application ready.");
  } catch (err) {
    console.error("[ELECTRON] Fatal startup error:", err);
    dialog.showErrorBox(
      "Startup Error",
      `The application failed to start.\n\n${err.message}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // On Windows, clicking X hides to tray (handled by close event)
  // Only quit if isQuitting is true
  if (isQuitting) {
    gracefulShutdown().then(() => app.quit());
  }
});

app.on("before-quit", async () => {
  isQuitting = true;
  await gracefulShutdown();
});

// ── Crash safety ────────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[ELECTRON] Uncaught Exception:", err);
  try {
    fs.appendFileSync(
      path.join(LOGS_DIR, "crash.log"),
      `[${new Date().toISOString()}] UNCAUGHT: ${err.stack || err.message}\n`
    );
  } catch (e) { /* ignore */ }
});

process.on("unhandledRejection", (reason) => {
  console.error("[ELECTRON] Unhandled Rejection:", reason);
  try {
    fs.appendFileSync(
      path.join(LOGS_DIR, "crash.log"),
      `[${new Date().toISOString()}] REJECTION: ${reason}\n`
    );
  } catch (e) { /* ignore */ }
});
