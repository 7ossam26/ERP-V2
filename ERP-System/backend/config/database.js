require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

console.log("🔌 Connecting to database...");

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

module.exports = prisma;
