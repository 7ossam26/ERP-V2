const express = require("express");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log("Attempting to start server...");

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
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL?.split(",") || [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.error("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
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
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect("https://" + req.headers.host + req.url);
    }
    next();
  });
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Force restart trigger
console.log("🔄 Server updated");

// Serve Static Frontend Files (Production)
const path = require("path");
const CLIENT_DIST_PATH = path.join(__dirname, "client_dist");

if (fs.existsSync(CLIENT_DIST_PATH)) {
  console.log("📂 Serving static frontend from:", CLIENT_DIST_PATH);
  app.use(express.static(CLIENT_DIST_PATH));

  // SPA Catch-all: Request to non-API routes returns index.html
  app.get(/.*/, (req, res) => {
    if (req.path.startsWith("/api")) {
      // Should verify if we want to return 404 json or html here
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
  });
} else {
  console.log("⚠️  Frontend build not found at:", CLIENT_DIST_PATH);
  console.log("    Run 'npm run build:ui' to generate it.");
}

// Start server
console.log("Calling app.listen...");
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
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
