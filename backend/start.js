// Production startup script
// Loads env vars then starts the server (migrations run separately via `npm run migrate`)

const path = require("path");
const fs = require("fs");

// Load .env files — mirrors the priority logic in index.js
// dotenv.config() does NOT override vars already set by the platform
const envFiles = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, ".env.local"),
];
for (const f of envFiles) {
  if (fs.existsSync(f)) {
    require("dotenv").config({ path: f });
  }
}

if (!process.env.DATABASE_URL) {
  console.error(
    "FATAL: DATABASE_URL is not set.\n" +
      "  Local dev: add it to backend/.env\n" +
      "  Production: set it in Dokploy environment variables"
  );
  process.exit(1);
}

// Log only the target host/database (never credentials) so deployment logs
// show which database this container was actually given.
try {
  const dbUrl = new URL(process.env.DATABASE_URL);
  console.log(`>>> [DB] Target: ${dbUrl.host}${dbUrl.pathname}`);
} catch {
  console.error(">>> [DB] DATABASE_URL is not a valid URL.");
}

// Run baseline + migrations before starting the server
const { execSync } = require("child_process");
const scriptDir = __dirname;

try {
  console.log(">>> [MIGRATE] Applying direct schema fixes...");
  execSync("node scripts/fix-server-schema.js", {
    cwd: scriptDir,
    stdio: "inherit",
  });

  console.log(">>> [MIGRATE] Running migration baseline...");
  execSync("node scripts/baseline-migrations.js", {
    cwd: scriptDir,
    stdio: "inherit",
  });

  console.log(">>> [MIGRATE] Applying pending migrations...");
  execSync("npx prisma migrate deploy", {
    cwd: scriptDir,
    stdio: "inherit",
  });

  console.log(">>> [MIGRATE] Database is up to date.");
} catch (err) {
  console.error(">>> [MIGRATE] Migration failed — aborting startup.");
  process.exit(1);
}

require("./index.js");
