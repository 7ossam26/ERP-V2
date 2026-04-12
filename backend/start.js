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

require("./index.js");
