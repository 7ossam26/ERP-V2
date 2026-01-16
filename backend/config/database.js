require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

console.log("🔌 [DB] Initializing database configuration...");

if (!process.env.DATABASE_URL) {
  console.error("❌ [DB] Error: DATABASE_URL is not defined in environment variables!");
  // We throw here, which will likely crash the app, but now it will be logged clearly.
  throw new Error("DATABASE_URL is not defined");
} else {
  // Log masked URL for debugging (never log the full secret in prod logs)
  const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]*@/, ":****@");
  console.log(`🔌 [DB] Found DATABASE_URL: ${maskedUrl}`);
}

console.log("🔌 [DB] Creating PrismaClient instance...");
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;
