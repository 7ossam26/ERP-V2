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

const isProduction = process.env.NODE_ENV === "production";
const RAMEX_PROD_HOST = process.env.RAMEX_PROD_HOST || "ramex.example.com"; // Set real domain in Phase 8
console.log(`>>> [BOOT] RAMEX_PROD_HOST: ${RAMEX_PROD_HOST}`);
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

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.error(
          `>>> [CORS] BLOCKED: Origin '${origin}' not in allowed list.`,
        );
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Force restart trigger
console.log("🔄 Server updated");

// --- TEMPORARY: Database Setup Route (Robust & Optimized) ---
const { spawn } = require("child_process");
const seedMain = require("./scripts/seed-production.js");

// --- DANGEROUS: Complete Database Reset & Re-seed ---
app.get("/api/dangerous-reset-db", async (req, res) => {
  console.log(">>> [RESET] Request received to WIPE database...");

  // 1. Security Check
  if (req.query.secret !== "RESET_MY_DB_NOW") {
    console.warn(">>> [RESET] Access denied. Invalid secret.");
    return res
      .status(403)
      .json({ error: "Access denied. Invalid secret key." });
  }

  const log = [];
  const logMsg = (msg) => {
    console.log(`>>> [RESET] ${msg}`);
    log.push(msg);
  };

  try {
    // 2. Drop All Tables
    logMsg("Starting table wipe...");

    // Disable foreign key checks to allow arbitrary drop order
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");

    // Get all tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE();
    `;

    logMsg(`Found ${tables.length} tables to drop.`);

    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME;
      // Skip internal tables if any, or dropped implicitly
      logMsg(`Dropping table: ${tableName}`);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    }

    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
    logMsg("All tables dropped successfully.");

    // 3. Re-run Migration logic (reusing logic from setup endpoint would be ideal, but for safety/isolation we copy-paste standard run)
    const migrationPath = path.join(__dirname, "prisma/migration.sql");
    if (fs.existsSync(migrationPath)) {
      logMsg("Applying migration.sql...");
      const sqlContent = fs.readFileSync(migrationPath, "utf8");
      const statements = sqlContent
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (let i = 0; i < statements.length; i++) {
        try {
          await prisma.$executeRawUnsafe(statements[i]);
        } catch (err) {
          // Ignore "already exists" if we just dropped them (shouldn't happen) or other non-criticals
          logMsg(`Warning on stmt ${i}: ${err.message}`);
        }
      }
    } else {
      throw new Error("migration.sql not found!");
    }

    // 4. Run Seeder
    logMsg("Running seeder...");
    seedMain()
      .then(() => {
        logMsg("Seeding Execution Function returned.");
        res.json({
          message: "Database reset and re-seeded successfully!",
          log: log,
        });
      })
      .catch((seedErr) => {
        logMsg(`Seeding failed: ${seedErr.message}`);
        res
          .status(500)
          .json({ error: "Seeding failed", details: seedErr.message, log });
      });
  } catch (error) {
    console.error(">>> [RESET] Critical Error:", error);
    res
      .status(500)
      .json({ error: "Reset failed", details: error.message, log });
  }
});

// --- 1. TABLES SETUP ENDPOINT ---
app.get("/api/setup-tables", async (req, res) => {
  console.log(">>> [SETUP] Starting Table Creation (Direct MySQL Mode)...");

  // Use mysql2 directly to bypass Prisma engine panics on large schema execution
  const mysql = require("mysql2/promise");
  let connection;

  try {
    const migrationPath = path.join(__dirname, "prisma/migration.sql");
    const migrationResult = [];

    if (fs.existsSync(migrationPath)) {
      console.log(`>>> [SETUP] Found migration SQL at: ${migrationPath}`);

      console.log(">>> [SETUP] Connecting to database via mysql2...");
      connection = await mysql.createConnection(process.env.DATABASE_URL);

      const sqlContent = fs.readFileSync(migrationPath, "utf8");

      const statements = sqlContent
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`>>> [SETUP] Found ${statements.length} SQL statements...`);

      for (let i = 0; i < statements.length; i++) {
        try {
          await connection.query(statements[i]);
        } catch (sqlErr) {
          console.error(`>>> [SETUP] Warning at stmt ${i}: ${sqlErr.message}`);
          migrationResult.push({ index: i, error: sqlErr.message });
        }
      }
      res.json({
        message: "Tables setup finished (via mysql2)",
        warnings: migrationResult,
      });
    } else {
      res.status(404).json({ error: "migration.sql not found" });
    }
  } catch (error) {
    console.error(`>>> [SETUP] Critical Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        console.error(">>> [SETUP] Error closing connection:", e.message);
      }
    }
  }
});

// --- 2. SEED ENDPOINT ---
// --- 2. SEED ENDPOINT ---
app.get("/api/setup-seed", async (req, res) => {
  console.log(">>> [SETUP] Starting Seeding (via mysql2)...");
  try {
    // We skip the prisma.role.count() check because we are intentionally creating tables via mysql2
    // and bypassing the flaky Prisma engine on this specific production environment.

    await seedMain();
    res.json({ message: "Seeding completed successfully" });
  } catch (error) {
    console.error(`>>> [SETUP] Seed Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});
// ---------------------------------------

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
  const healthHost =
    process.env.NODE_ENV === "production"
      ? "ramex-store.localhost"
      : "localhost";
  console.log(
    `📍 [SERVER] Health check available at: http://${healthHost}:${PORT}/api/health`,
  );
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
