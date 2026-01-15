// scripts/check-db.js
// Run this script independently to verify your database connection credentials
// Usage: node scripts/check-db.js

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkConnection() {
    console.log('🔌 Testing Database Connection...');
    console.log(`   URL: ${process.env.DATABASE_URL ? 'Loaded from .env' : 'MISSING!'}`);

    if (!process.env.DATABASE_URL) {
        console.error('❌ Error: DATABASE_URL is not defined in your environment.');
        process.exit(1);
    }

    try {
        // Attempt to connect
        await prisma.$connect();
        console.log('✅ Connection Successful!');

        // Attempt a simple query
        const userCount = await prisma.user.count();
        console.log(`📊 Current User Count: ${userCount}`);

        // Check if roles exist
        const roleCount = await prisma.role.count();
        console.log(`🛡️  Current Role Count: ${roleCount}`);

        if (roleCount === 0) {
            console.warn('⚠️  Warning: No roles found. You might need to run the seed script.');
        }

    } catch (error) {
        console.error('\n❌ Connection Failed!');
        console.error('---------------------------------------------------');
        console.error(error.message);
        console.error('---------------------------------------------------');
        console.log('Troubleshooting tips:');
        console.log('1. Check if the Hostname/IP is correct (Hostinger MySQL often uses a specific domain, not localhost).');
        console.log('2. Verify the Database Name and Username (they often have a prefix like u12345_).');
        console.log('3. Ensure your password does not contain special characters that break the URL parsing (URL encode them if needed).');
    } finally {
        await prisma.$disconnect();
    }
}

checkConnection();
