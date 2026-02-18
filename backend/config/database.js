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

// Add connection pooling parameters for shared hosting optimization
const baseUrl = process.env.DATABASE_URL;
const urlWithPooling = baseUrl.includes('?')
  ? `${baseUrl}&connection_limit=5&pool_timeout=20&connect_timeout=10`
  : `${baseUrl}?connection_limit=5&pool_timeout=20&connect_timeout=10`;

console.log("🔌 [DB] Connection pooling enabled: connection_limit=5, pool_timeout=20s, connect_timeout=10s");

console.log("🔌 [DB] Creating PrismaClient instance...");
const prisma = new PrismaClient({
  log: ['warn', 'error'], // Only log warnings and errors, not every query
  datasources: {
    db: {
      url: urlWithPooling,
    },
  },
  // Aggressive connection pooling for shared hosting
  __internal: {
    engine: {
      cwd: process.cwd(),
    },
  },
});

// Add connection lifecycle logging
prisma.$on('beforeExit', async () => {
  console.log('🔌 [DB] Prisma is disconnecting...');
});

module.exports = prisma;
