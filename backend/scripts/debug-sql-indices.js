const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../prisma/migration.sql');
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

const statements = sqlContent
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

console.log(`Total statements: ${statements.length}`);

// The user's last error was at index 131.
// Let's print statements from 125 to the end to see where the new stuff actually is.
for (let i = 125; i < statements.length; i++) {
    console.log(`--- Index ${i} ---`);
    console.log(statements[i].substring(0, 100).replace(/\n/g, ' ')); // Print first 100 chars
}
