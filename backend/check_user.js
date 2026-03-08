const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

console.log("🔍 Starting diagnostic check...");

// 1. Emulate how index.js loads envs to ensure we see what it sees
const envRootLocal = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envRootLocal)) {
    console.log(`📂 Loading .env.local from: ${envRootLocal}`);
    const envConfig = dotenv.parse(fs.readFileSync(envRootLocal));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// 2. Check Database URL
const dbUrl = process.env.DATABASE_URL;
console.log(`🔌 Database URL: ${dbUrl}`);

const prisma = new PrismaClient();

async function checkUser() {
    try {
        console.log("👤 Searching for 'superadmin'...");
        const user = await prisma.user.findUnique({
            where: { username: 'superadmin' },
            include: { role: true }
        });

        if (!user) {
            console.error("❌ User 'superadmin' NOT FOUND in database!");
            return;
        }

        console.log(`✅ User found: ID=${user.id}, Role=${user.role?.name}, Active=${user.isActive}`);

        // 3. Test Password
        const inputPass = "246810@Ad";
        console.log(`🔑 Testing password: '${inputPass}'`);

        const isMatch = await bcrypt.compare(inputPass, user.password);

        if (isMatch) {
            console.log("✅ Password MATCHES!");
        } else {
            console.error("❌ Password DOES NOT MATCH hash!");
            console.log("   Hash in DB:", user.password);
        }

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
