const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Try loading envs from multiple locations
const envPaths = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env')
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        console.log(`📂 Loading env from: ${envPath}`);
        dotenv.config({ path: envPath });
    }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPermissions() {
    try {
        console.log("🔍 Checking user permissions...");
        const users = await prisma.user.findMany({
            include: {
                role: {
                    include: {
                        permissions: true
                    }
                }
            }
        });

        console.log(`Found ${users.length} users.`);


        const results = [];
        for (const user of users) {
            const userData = {
                username: user.username,
                id: user.id,
                role: user.role ? user.role.name : 'No Role',
                hasSensitiveAccess: user.hasSensitiveAccess,
                categoriesPermission: 'Not Found',
                allPermissions: []
            };

            if (user.role) {
                const categoriesPerm = user.role.permissions.find(p => p.module === 'CATEGORIES');
                userData.categoriesPermission = categoriesPerm ? (categoriesPerm.canAccess ? 'Granted' : 'Denied') : 'Not Found';

                userData.allPermissions = user.role.permissions.map(p => p.module);
            }
            results.push(userData);
        }

        const fs = require('fs');
        fs.writeFileSync('perms_ds_result.json', JSON.stringify(results, null, 2));
        console.log("✅ Wrote results to perms_ds_result.json");


    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkPermissions();
