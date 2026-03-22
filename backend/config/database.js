/**
 * ERP-V2 Desktop — Database Configuration (SQLite via Prisma)
 *
 * Replaces the MySQL PrismaClient config.
 * - DATABASE_URL is set by main.js before this module is required.
 * - Provides initializeDatabase() for first-run schema push.
 * - Provides close() for graceful shutdown.
 */

const { PrismaClient } = require("../prisma/generated/client");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const prisma = new PrismaClient({
  log: IS_PRODUCTION ? ["error"] : ["error", "warn"],
});

function getPrismaCommand() {
  const isWin = process.platform === "win32";

  // Find prisma/build/index.js directly to avoid relying on .bin wrappers which electron-builder ignores
  let rootPrisma = path.join(__dirname, "..", "..", "node_modules", "prisma", "build", "index.js");
  if (rootPrisma.includes("app.asar")) {
    rootPrisma = rootPrisma.replace("app.asar", "app.asar.unpacked");
  }

  if (fs.existsSync(rootPrisma)) {
    return {
      command: `"${process.execPath}" "${rootPrisma}"`,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
    };
  }

  // Check backend node_modules as backup
  let backendPrisma = path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js");
  if (backendPrisma.includes("app.asar")) {
    backendPrisma = backendPrisma.replace("app.asar", "app.asar.unpacked");
  }

  if (fs.existsSync(backendPrisma)) {
    return {
      command: `"${process.execPath}" "${backendPrisma}"`,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
    };
  }

  // Fallback to npx (will work in dev when npx is on PATH)
  const binName = isWin ? "npx.cmd prisma" : "npx prisma";
  return {
    command: binName,
    env: process.env
  };
}

/**
 * Initialize the SQLite database:
 * 1. Run prisma db push to sync schema (only if DB is new/missing)
 * 2. Enable WAL mode for better concurrency
 * 3. Enable foreign key enforcement
 */
async function initializeDatabase() {
  try {
    console.log("[DATABASE] Initializing SQLite database...");
    console.log(`[DATABASE] DATABASE_URL = ${process.env.DATABASE_URL}`);

    // Extract actual file path from DATABASE_URL (strip "file:" prefix)
    const dbUrl = process.env.DATABASE_URL || "";
    const dbFilePath = dbUrl.replace(/^file:/, "");
    const dbExists = dbFilePath && fs.existsSync(dbFilePath);

    // Run prisma db push to create/sync tables
    let schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
    if (schemaPath.includes("app.asar")) {
      schemaPath = schemaPath.replace("app.asar", "app.asar.unpacked");
    }
    const { command: prismaCmd, env: prismaEnv } = getPrismaCommand();

    console.log(`[DATABASE] Prisma Command: ${prismaCmd}`);
    console.log(`[DATABASE] DB exists: ${dbExists}`);

    const execCwd = schemaPath.includes("app.asar.unpacked") 
      ? path.dirname(schemaPath) 
      : path.join(__dirname, "..");

    execSync(
      `${prismaCmd} db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      {
        cwd: execCwd,
        stdio: IS_PRODUCTION ? "pipe" : "inherit",
        env: prismaEnv,
        windowsHide: true,
        shell: true, // Required on Windows for .cmd files
      }
    );

    // Connect and configure SQLite PRAGMAs
    await prisma.$connect();

    // Enable WAL mode for better performance and backup safety
    await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL");

    // Enable foreign key enforcement (SQLite has it OFF by default)
    await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON");

    console.log("[DATABASE] ✅ Database initialized successfully");
  } catch (error) {
    console.error("[DATABASE] ❌ Failed to initialize database:", error.message);
    throw error;
  }
}

/**
 * Gracefully close the database connection.
 */
async function close() {
  try {
    await prisma.$disconnect();
    console.log("[DATABASE] Database connection closed.");
  } catch (error) {
    console.error("[DATABASE] Error closing database:", error.message);
  }
}

// Export prisma as default (backward-compatible with existing require("./config/database"))
module.exports = prisma;
module.exports.prisma = prisma;
module.exports.initializeDatabase = initializeDatabase;
module.exports.close = close;
