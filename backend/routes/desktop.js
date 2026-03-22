/**
 * ERP-V2 Desktop — Desktop-Specific API Routes
 *
 * Endpoints for desktop features: app info, backup, restore, license, print.
 */

const express = require("express");
const router = express.Router();
const fs = require("fs");
const { createBackup, listBackups, restoreBackup } = require("../utils/backup");
const { getLicenseKey, validateLicense, saveLicense, removeLicense, isLicenseValid } = require("../utils/license");

// ─── App Info ──────────────────────────────────────────────────────────────
router.get("/info", (req, res) => {
  const dbPath = process.env.ERP_DB_PATH;
  let dbSize = 0;

  try {
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size;
    }
  } catch (err) { /* ignore */ }

  res.json({
    version: process.env.npm_package_version || "1.0.0",
    databasePath: dbPath,
    databaseSize: dbSize,
    databaseSizeMB: (dbSize / 1024 / 1024).toFixed(2),
    logsDir: process.env.ERP_LOGS_DIR,
    backupsDir: process.env.ERP_BACKUPS_DIR,
    uptime: process.uptime(),
    nodeEnv: process.env.NODE_ENV,
    licensed: isLicenseValid(),
  });
});

// ─── Backup ────────────────────────────────────────────────────────────────
router.post("/backup", async (req, res, next) => {
  try {
    const result = await createBackup();
    res.json({ message: "Backup created successfully", backup: result });
  } catch (error) {
    next(error);
  }
});

router.get("/backups", (req, res) => {
  const backups = listBackups();
  res.json({ backups, count: backups.length });
});

router.post("/restore", async (req, res, next) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "Backup filename is required" });
    }
    const result = await restoreBackup(filename);
    res.json({ message: "Database restored successfully", result });
  } catch (error) {
    next(error);
  }
});

// ─── License ───────────────────────────────────────────────────────────────
router.get("/license", (req, res) => {
  const key = getLicenseKey();
  if (!key) {
    return res.json({ hasLicense: false, valid: false });
  }
  const result = validateLicense(key);
  res.json({
    hasLicense: true,
    valid: result.valid,
    key: key.substring(0, 9) + "...", // Mask last part
  });
});

router.post("/license", (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: "License key is required" });
  }
  const result = saveLicense(key);
  if (result.valid) {
    res.json({ message: "License saved successfully", valid: true });
  } else {
    res.status(400).json({ error: result.reason, valid: false });
  }
});

router.delete("/license", (req, res) => {
  const result = removeLicense();
  res.json({ message: "License removed", ...result });
});

module.exports = router;
