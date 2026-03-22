/**
 * ERP-V2 Desktop — Express Server (Factory Function)
 *
 * Exports createServer() for main.js to call.
 * Removed: CORS, rate limiting, HTTPS redirect, setup/reset endpoints.
 * Kept: Helmet, body parsing, audit capture, all API routes, static file serving.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");

function createServer() {
  const app = express();

  // ─── Security Headers ────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "http://localhost:*"],
        },
      },
      hsts: false, // No HTTPS in desktop app
    })
  );

  // ─── Body Parsing ────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── Audit Capture ───────────────────────────────────────────────────
  const auditCapture = require("./middleware/auditCapture");
  app.use(auditCapture);

  // ─── Health Check ────────────────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      message: "ERP Desktop Server is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─── API Routes ──────────────────────────────────────────────────────
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/superadmin", require("./routes/superadmin"));
  app.use("/api/employees", require("./routes/employees"));
  app.use("/api/warehouses", require("./routes/warehouses"));
  app.use("/api/treasuries", require("./routes/treasuries"));
  app.use("/api/branches", require("./routes/branches"));
  app.use("/api/expenses", require("./routes/expenses"));
  app.use("/api/clients", require("./routes/clients"));
  app.use("/api/suppliers", require("./routes/suppliers"));
  app.use("/api/categories", require("./routes/categories"));
  app.use("/api/items", require("./routes/items"));
  app.use("/api/inventory", require("./routes/inventory"));
  app.use("/api/purchases", require("./routes/purchases"));
  app.use("/api/sales", require("./routes/sales"));
  app.use("/api/reports", require("./routes/reports"));
  app.use("/api/settings", require("./routes/settings"));
  app.use("/api/stock-transfers", require("./routes/stockTransfer"));
  app.use("/api/shifts", require("./routes/shifts"));
  app.use("/api/supplier-accounts", require("./routes/supplierAccounts"));
  app.use("/api/deposits", require("./routes/deposits"));
  app.use("/api/withdrawals", require("./routes/withdrawals"));
  app.use("/api/users", require("./routes/users"));
  app.use("/api/delivery-men", require("./routes/delivery.routes"));
  app.use("/api/delivery-zones", require("./routes/deliveryZone.routes"));
  app.use("/api/bom", require("./routes/bom"));
  app.use("/api/audit", require("./routes/audit"));
  app.use("/api/import", require("./routes/dataImport"));
  app.use("/api/desktop", require("./routes/desktop"));

  // ─── Error Handler ───────────────────────────────────────────────────
  const errorHandler = require("./middleware/errorHandler");
  app.use(errorHandler);

  // ─── Static Frontend Files ───────────────────────────────────────────
  const CLIENT_DIST_PATH_PROD = path.join(__dirname, "client_dist");
  const CLIENT_DIST_PATH_LOCAL = path.join(__dirname, "../frontend/dist");

  let CLIENT_DIST_PATH = CLIENT_DIST_PATH_LOCAL;
  if (fs.existsSync(CLIENT_DIST_PATH_PROD)) {
    CLIENT_DIST_PATH = CLIENT_DIST_PATH_PROD;
    console.log(`[SERVER] Serving frontend from: ${CLIENT_DIST_PATH}`);
  } else {
    console.log(`[SERVER] Fallback frontend path: ${CLIENT_DIST_PATH}`);
  }

  if (fs.existsSync(CLIENT_DIST_PATH)) {
    app.use(express.static(CLIENT_DIST_PATH));

    // SPA Catch-all
    app.get(/.*/, (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
    });
  } else {
    console.log("[SERVER] ⚠️ No frontend build found. API-only mode.");
  }

  return app;
}

module.exports = { createServer };
