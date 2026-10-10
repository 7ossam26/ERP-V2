console.log(">>> [BOOT] Starting backend application...");
const express = require("express");
const fs = require("fs");
const path = require("path"); // Ensure path is available early
const cors = require("cors");

// --- ENV LOADING STRATEGY ---
// Priority (highest wins): .env.local > backend/.env > root/.env
//
// For local development: create backend/.env.local to override production settings.
// For production deployment: backend/.env.local should NOT exist.
const envRoot = path.resolve(__dirname, "../.env");
const envBackend = path.resolve(__dirname, ".env");
const envRootLocal = path.resolve(__dirname, "../.env.local");
const envBackendLocal = path.resolve(__dirname, ".env.local");

// Variables already present in the process environment (set by the platform,
// e.g. Dokploy) must always win. The file loads below use `override: true` to
// order the files among themselves; without this snapshot a stale .env file
// baked into an image could silently replace the platform's DATABASE_URL.
const platformEnv = { ...process.env };

// Step 1: Load base configs (lower priority)
if (fs.existsSync(envRoot)) {
  console.log(`>>> [ENV] Loading root .env (${envRoot})...`);
  require("dotenv").config({ path: envRoot });
}
if (fs.existsSync(envBackend)) {
  console.log(`>>> [ENV] Loading backend .env (${envBackend})...`);
  require("dotenv").config({ path: envBackend, override: true });
}

// Step 2: Always load .env.local files on top — these WIN over everything.
// On production servers, these files won't exist, so nothing happens.
// On local dev, create backend/.env.local to override NODE_ENV, DB, ports, etc.
if (fs.existsSync(envRootLocal)) {
  console.log(
    `>>> [ENV] Loading root .env.local (${envRootLocal}) — local dev override...`,
  );
  require("dotenv").config({ path: envRootLocal, override: true });
}
if (fs.existsSync(envBackendLocal)) {
  console.log(
    `>>> [ENV] Loading backend .env.local (${envBackendLocal}) — local dev override...`,
  );
  require("dotenv").config({ path: envBackendLocal, override: true });
}
Object.assign(process.env, platformEnv);

const isProduction = process.env.NODE_ENV === "production";
console.log(
  `>>> [ENV] Final NODE_ENV: ${process.env.NODE_ENV} (isProduction: ${isProduction})`,
);
// ---------------------------------------

// --- DEBUGGING: Write logs to a file ---
const LOG_FILE = path.join(__dirname, "deployment.log");
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (err) {
    // Ignore file write errors to avoid infinite loops
  }
}

// Override console methods to trace everything
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  const msg = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  logToFile(`INFO: ${msg}`);
  originalLog.apply(console, args);
};

console.error = function (...args) {
  const msg = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  logToFile(`ERROR: ${msg}`);
  originalError.apply(console, args);
};

console.log(`>>> [BOOT] Logging to file: ${LOG_FILE}`);
// ---------------------------------------

const app = express();
// Enable proxy trust for Hostinger Load Balancer (fixes rate limit error)
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;

console.log(
  `>>> [BOOT] Environment detected. PORT: ${PORT}, PID: ${process.pid}`,
);
console.log(`>>> [BOOT] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(">>> [BOOT] Attempting to set up server...");

const helmet = require("helmet");

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false, // Disable HSTS in development
  }),
);

// CORS configuration — origins come from FRONTEND_URL env var (comma-separated).
// In production: set in backend/.env
// In development: overridden by backend/.env.local
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [];

// Always allow localhost in development mode
if (process.env.NODE_ENV !== "production") {
  const localOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:3001",
  ];
  localOrigins.forEach((origin) => {
    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin);
  });
}

console.log(`>>> [CORS] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`>>> [CORS] Allowed Origins: ${JSON.stringify(allowedOrigins)}`);

// The production frontend is served by this same server and calls `/api`
// same-origin. Browsers still send an Origin header on same-origin POSTs, so
// an origin whose host matches the request's Host is always allowed —
// otherwise login would depend on FRONTEND_URL listing the exact domain.
const isSameOrigin = (origin, req) => {
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
};

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const corsOptions = {
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };
    // Allow requests with no origin (like mobile apps or curl requests)
    if (
      !origin ||
      isSameOrigin(origin, req) ||
      allowedOrigins.indexOf(origin) !== -1
    ) {
      return callback(null, { ...corsOptions, origin: true });
    }
    console.error(`>>> [CORS] BLOCKED: Origin '${origin}' not in allowed list.`);
    callback(new Error("Not allowed by CORS"));
  }),
);

const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // limit each IP to 2000 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later" },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// HTTPS enforcement (production only)
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    // Only redirect if explicitly http, not if missing or already https
    if (proto && proto === "http") {
      console.log(`>>> [HTTPS] Redirecting ${req.url} from HTTP to HTTPS`);
      return res.redirect(301, "https://" + req.headers.host + req.url);
    }
    next();
  });
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit capture — wraps res.json on mutating requests after body is parsed
const auditCapture = require("./middleware/auditCapture");
app.use(auditCapture);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "ERP Backend Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Import routes
const authRouter = require("./routes/auth");
const employeesRouter = require("./routes/employees");
// ... other imports

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/superadmin", require("./routes/superadmin"));
app.use("/api/employees", employeesRouter);
const warehousesRouter = require("./routes/warehouses");
const treasuriesRouter = require("./routes/treasuries");
const branchesRouter = require("./routes/branches");
const clientsRouter = require("./routes/clients");
const suppliersRouter = require("./routes/suppliers");
const categoriesRouter = require("./routes/categories");
const itemsRouter = require("./routes/items");
const purchasesRouter = require("./routes/purchases");
const salesRouter = require("./routes/sales");
const settingsRouter = require("./routes/settings");

// Database connection
const prisma = require("./config/database");

// API Routes
app.use("/api/employees", employeesRouter);
app.use("/api/warehouses", warehousesRouter);
app.use("/api/treasuries", treasuriesRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/expense-categories", require("./routes/expenseCategories"));
app.use("/api/clients", clientsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/items", itemsRouter);
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/purchases", purchasesRouter);
app.use("/api/sales", salesRouter);
app.use("/api/reports", require("./routes/reports"));
app.use("/api/settings", settingsRouter);
app.use("/api/stock-transfers", require("./routes/stockTransfer"));
app.use("/api/shifts", require("./routes/shifts"));
app.use("/api/supplier-accounts", require("./routes/supplierAccounts"));
app.use("/api/deposits", require("./routes/deposits"));
app.use("/api/withdrawals", require("./routes/withdrawals"));
app.use("/api/users", require("./routes/users"));
app.use("/api/delivery-men", require("./routes/delivery.routes"));
app.use("/api/delivery-zones", require("./routes/deliveryZone.routes"));
app.use("/api/bom",   require("./routes/bom"));
app.use("/api/audit", require("./routes/audit"));
app.use("/api/import", require("./routes/dataImport"));
app.use("/api/export", require("./routes/dataExport"));
app.use("/api/initial-inventory", require("./routes/initialInventory"));
app.use("/api/stock-writeoffs", require("./routes/stockWriteOffs"));
app.use("/api/call-center", require("./routes/callCenter"));
app.use("/api/events", require("./routes/events"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/bulk", require("./routes/bulk"));

// Start the TTL cron for Notification rows (retention = 30 days per D8).
const { startNotificationPurgeCron } = require("./lib/notificationPurge");
startNotificationPurgeCron();

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Force restart trigger
console.log("🔄 Server updated");

// Database setup is deliberately NOT exposed over HTTP. The former
// /api/dangerous-reset-db, /api/setup-tables and /api/setup-seed routes were
// unauthenticated and could drop every table, replay migration.sql, or reset
// the superadmin password. Initialise a database from the container shell
// instead — see docs/DATABASE_INITIALIZATION.md.

// Serve Static Frontend Files (Production)
const CLIENT_DIST_PATH_PROD = path.join(__dirname, "client_dist");
const CLIENT_DIST_PATH_LOCAL = path.join(__dirname, "../frontend/dist");

let CLIENT_DIST_PATH = CLIENT_DIST_PATH_LOCAL; // Default fallback

// Prioritize the production build folder (client_dist) if it exists
if (fs.existsSync(CLIENT_DIST_PATH_PROD)) {
  CLIENT_DIST_PATH = CLIENT_DIST_PATH_PROD;
  console.log(`>>> [STATIC] Found production build at: ${CLIENT_DIST_PATH}`);
} else {
  console.log(`>>> [STATIC] fallback to local build at: ${CLIENT_DIST_PATH}`);
}

console.log(`>>> [STATIC] Checking for frontend build at: ${CLIENT_DIST_PATH}`);

if (fs.existsSync(CLIENT_DIST_PATH)) {
  console.log("📂 [STATIC] Serving static frontend files.");
  app.use(express.static(CLIENT_DIST_PATH));

  // SPA Catch-all: Request to non-API routes returns index.html
  app.get(/.*/, (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
  });
} else {
  console.log("⚠️ [STATIC] Frontend build NOT found at:", CLIENT_DIST_PATH);
  console.log("    This is expected if you are only running the backend API.");
  console.log(
    "    If this is a production deployment including frontend, run 'npm run build:ui' first.",
  );
}

// Start server
console.log(">>> [BOOT] Calling app.listen...");
const server = app.listen(PORT, () => {
  console.log(`🚀 [SERVER] Server successfully running on port ${PORT}`);
  console.log(`📍 [SERVER] Health check available at: /api/health (port ${PORT})`);
});

server.on("error", (error) => {
  console.error("❌ Server error:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

// Force restart trigger
console.log("🔄 Server updated");

// --- GRACEFUL SHUTDOWN ---
const gracefulShutdown = async (signal) => {
  console.log(`>>> [SHUTDOWN] Received ${signal}. Closing server...`);

  if (server) {
    server.close(() => {
      console.log(">>> [SHUTDOWN] HTTP server closed.");
    });
  }

  try {
    await prisma.$disconnect();
    console.log(">>> [SHUTDOWN] Prisma client disconnected.");
    process.exit(0);
  } catch (err) {
    console.error(">>> [SHUTDOWN] Error during disconnection:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
