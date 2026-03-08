const prisma = require('./config/database');

async function fixAutoIncrement() {
    console.log('>>> Fixing AUTO_INCREMENT for items table (Aggressive Mode)...');
    try {
        // 1. Get the max ID
        const result = await prisma.$queryRaw`SELECT MAX(id) as maxId FROM items`;
        const maxId = result[0].maxId || 0;
        // JUMP 100 AHEAD to be absolutely safe from any caching or off-by-one errors
        const nextId = parseInt(maxId) + 100;

        console.log(`Current MAX ID: ${maxId}. Setting AUTO_INCREMENT to ${nextId} (+100 safety buffer)`);

        // 2. Set AUTO_INCREMENT
        await prisma.$executeRawUnsafe(`ALTER TABLE items AUTO_INCREMENT = ${nextId}`);

        console.log('✅ Successfully updated items AUTO_INCREMENT.');
    } catch (error) {
        console.error('❌ Failed to fix auto increment:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixAutoIncrement();
