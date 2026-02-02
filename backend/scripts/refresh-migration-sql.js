const fs = require('fs');
const path = require('path');

const prismaDir = path.join(__dirname, '../prisma');
const migrationsDir = path.join(prismaDir, 'migrations');
const outputFile = path.join(prismaDir, 'migration.sql');

console.log('>>> [REFRESH] Starting migration.sql refresh...');
console.log(`>>> [REFRESH] Prisma Directory: ${prismaDir}`);

try {
    // 1. Get all items in migrations directory
    const items = fs.readdirSync(migrationsDir);

    // 2. Filter for directories that look like migrations (start with timestamp)
    // Ignoring 'migration_lock.toml' and any other non-directories
    const migrationDirs = items.filter(item => {
        const itemPath = path.join(migrationsDir, item);
        return fs.statSync(itemPath).isDirectory() && /^\d{14}_/.test(item);
    });

    // 3. Sort chronologically (timestamps ensure alphabetical sort works)
    migrationDirs.sort();

    console.log(`>>> [REFRESH] Found ${migrationDirs.length} migration directories.`);

    let fullSql = '-- AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.\n';
    fullSql += '-- Run "npm run refresh-migration" to update this file.\n\n';

    let count = 0;

    // 4. Iterate and concatenate
    for (const dirName of migrationDirs) {
        const migrationFile = path.join(migrationsDir, dirName, 'migration.sql');

        if (fs.existsSync(migrationFile)) {
            const sqlContent = fs.readFileSync(migrationFile, 'utf8');
            fullSql += `-- Migration: ${dirName}\n`;
            fullSql += sqlContent;
            fullSql += '\n\n';
            count++;
        } else {
            console.warn(`>>> [REFRESH] Warning: No migration.sql found in ${dirName}`);
        }
    }

    // 5. Write to output file
    fs.writeFileSync(outputFile, fullSql);

    console.log(`>>> [REFRESH] Success! Concatenated ${count} migrations into ${outputFile}`);
    console.log('>>> [REFRESH] You can now commit string backend/prisma/migration.sql and deploy.');

} catch (error) {
    console.error('>>> [REFRESH] Error refreshing migration.sql:', error);
    process.exit(1);
}
