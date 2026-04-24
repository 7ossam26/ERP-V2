const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Try loading envs from multiple locations
const envPaths = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env')
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        console.log(`📂 Loading env from: ${envPath}`);
        dotenv.config({ path: envPath });
    }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAdminPermissions() {
    try {
        console.log("🔧 Fixing Admin role permissions...");

        // Find the Admin role
        const adminRole = await prisma.role.findUnique({
            where: { name: 'Admin' },
            include: { permissions: true }
        });

        if (!adminRole) {
            console.error("❌ Admin role not found!");
            return;
        }

        console.log(`✅ Found Admin role (ID: ${adminRole.id})`);

        // Check if CATEGORIES permission exists
        const categoriesPerm = adminRole.permissions.find(p => p.module === 'CATEGORIES');

        if (categoriesPerm) {
            if (categoriesPerm.canAccess) {
                console.log("✅ CATEGORIES permission already granted.");
                return;
            } else {
                // Update existing permission
                await prisma.permission.update({
                    where: { id: categoriesPerm.id },
                    data: { canAccess: true }
                });
                console.log("✅ Updated existing CATEGORIES permission to granted.");
            }
        } else {
            // Create new permission
            await prisma.permission.create({
                data: {
                    module: 'CATEGORIES',
                    canAccess: true,
                    roleId: adminRole.id
                }
            });
            console.log("✅ Created new CATEGORIES permission for Admin role.");
        }

        console.log("🎉 Admin role permissions fixed successfully!");

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

fixAdminPermissions();
