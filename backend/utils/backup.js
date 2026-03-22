/**
 * ERP-V2 Desktop — Database Backup Utility
 *
 * Handles SQLite database backup/restore:
 * - Create timestamped backups
 * - List available backups
 * - Restore from a backup
 * - Auto-clean backups older than 30 days
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = () => process.env.ERP_DB_PATH;
const BACKUPS_DIR = () => process.env.ERP_BACKUPS_DIR || path.join(__dirname, "..", "backups");

/**
 * Create a backup of the current database.
 * Flushes WAL before copying for data integrity.
 */
async function createBackup() {
  const prisma = require("../config/database");
  const dbPath = DB_PATH();
  const backupsDir = BACKUPS_DIR();

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Flush WAL to main database file before backup
  try {
    await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch (err) {
    console.warn("[BACKUP] WAL checkpoint warning:", err.message);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `erp-v2-${timestamp}.db`;
  const backupPath = path.join(backupsDir, backupName);

  fs.copyFileSync(dbPath, backupPath);

  const stat = fs.statSync(backupPath);
  console.log(`[BACKUP] ✅ Created: ${backupName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  return {
    filename: backupName,
    path: backupPath,
    size: stat.size,
    createdAt: new Date().toISOString(),
  };
}

/**
 * List all available backups sorted by date (newest first).
 */
function listBackups() {
  const backupsDir = BACKUPS_DIR();

  if (!fs.existsSync(backupsDir)) return [];

  const files = fs.readdirSync(backupsDir)
    .filter((f) => f.startsWith("erp-v2-") && f.endsWith(".db"))
    .map((f) => {
      const filePath = path.join(backupsDir, f);
      const stat = fs.statSync(filePath);
      return {
        filename: f,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return files;
}

/**
 * Restore database from a backup file.
 * CRITICAL: Prisma must be disconnected before restore.
 */
async function restoreBackup(filename) {
  const prisma = require("../config/database");
  const dbPath = DB_PATH();
  const backupsDir = BACKUPS_DIR();
  const backupPath = path.join(backupsDir, filename);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${filename}`);
  }

  // Disconnect Prisma before overwriting database
  await prisma.$disconnect();

  // Copy backup over current database
  fs.copyFileSync(backupPath, dbPath);

  // Reconnect Prisma
  await prisma.$connect();

  console.log(`[BACKUP] ✅ Restored from: ${filename}`);
  return { success: true, filename };
}

/**
 * Delete backups older than 30 days.
 */
function cleanOldBackups() {
  const backupsDir = BACKUPS_DIR();
  if (!fs.existsSync(backupsDir)) return;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupsDir);
  let removed = 0;

  for (const file of files) {
    if (!file.startsWith("erp-v2-") || !file.endsWith(".db")) continue;

    const filePath = path.join(backupsDir, file);
    const stat = fs.statSync(filePath);

    if (stat.mtimeMs < thirtyDaysAgo) {
      fs.unlinkSync(filePath);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[BACKUP] Cleaned ${removed} old backup(s).`);
  }
}

module.exports = { createBackup, listBackups, restoreBackup, cleanOldBackups };
