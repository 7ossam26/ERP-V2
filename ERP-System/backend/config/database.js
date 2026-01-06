require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

// Parse the DATABASE_URL
// Format: mysql://user:password@host:port/database
const url = new URL(process.env.DATABASE_URL);

console.log("🔌 Creating MySQL adapter...");

// Create adapter directly with connection details (Prisma 7 pattern)
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading '/'
  connectionLimit: 10,
});

// Initialize Prisma with adapter
const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

module.exports = prisma;
