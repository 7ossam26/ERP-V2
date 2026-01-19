const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log("🛠️  Preparing to seed LOCAL database...");

// 1. Load .env.local explicitly to setup the environment
const envLocalPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envLocalPath)) {
    console.log(`📂 Loading .env.local config from: ${envLocalPath}`);
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));

    for (const k in envConfig) {
        if (envConfig.hasOwnProperty(k)) {
            process.env[k] = envConfig[k];
        }
    }
} else {
    console.error("❌ .env.local not found! Cannot safely seed local DB.");
    process.exit(1);
}

// 2. Validate we are using the local DB
const dbUrl = process.env.DATABASE_URL;
console.log(`🎯 Target Database: ${dbUrl}`);

if (!dbUrl || (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1"))) {
    console.error("❌ SAFETY CHECK FAILED: DATABASE_URL does not look local. Aborting.");
    process.exit(1);
}

// 3. Run the original seed script
// We use require to execute it. Note that seedSuperadmin.js runs main() automatically.
console.log("🚀 Launching seedSuperadmin.js...");
try {
    require('../seedSuperadmin.js');
} catch (err) {
    console.error("❌ Error importing seed script:", err);
}
