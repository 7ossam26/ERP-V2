const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const shifts = await prisma.shift.findMany({
            where: { status: 'OPEN' },
            include: { user: true }
        });
        console.log('OPEN SHIFTS:', JSON.stringify(shifts, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
