const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load root .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.warn("⚠️  Warning: .env.local not found at project root. Proceeding with Process Env if set.");
}

console.log("🛠️  Setting up Local Database...");
console.log(`📡 URL: ${process.env.DATABASE_URL}`);

try {
    // 1. Push Database Schema (Creates tables)
    // We need to run this from backend directory so it finds prisma/schema.prisma
    console.log("\n1️⃣  Pushing Database Schema...");
    execSync('npx prisma db push', {
        stdio: 'inherit',
        cwd: __dirname,
        env: process.env // Pass our modified env
    });

    // 2. Seed Data (Creates users)
    console.log("\n2️⃣  Seeding Database...");
    const seedMain = require('./prisma/seed.js');

    seedMain().then(() => {
        console.log("\n✅ Setup Complete! You can now start the server.");
    }).catch(err => {
        console.error("❌ Seed Error:", err);
    });

} catch (error) {
    console.error("\n❌ Setup Failed:", error.message);
    console.log("💡 Tip: Make sure to STOP the running server before running this script!");
}
