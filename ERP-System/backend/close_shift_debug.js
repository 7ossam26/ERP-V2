const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const activeShift = await prisma.shift.findFirst({
            where: { status: 'OPEN' }
        });

        if (activeShift) {
            console.log(`Closing Shift ID: ${activeShift.id}`);
            await prisma.shift.update({
                where: { id: activeShift.id },
                data: {
                    status: 'CLOSED',
                    endTime: new Date(),
                    endCash: 0
                }
            });
            console.log('Shift Closed Successfully');
        } else {
            console.log('No active shift found to close.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
