require('dotenv').config();
console.log("Current Directory:", process.cwd());
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Defined" : "Undefined");
if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL Length:", process.env.DATABASE_URL.length);
}

try {
    const prisma = require('./config/database');
    console.log("Prisma/Config loaded successfully");
} catch (e) {
    console.error("Error loading config:", e);
}
