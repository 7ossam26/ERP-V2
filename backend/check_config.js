const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: { url: "mysql://root:@127.0.0.1:3306/erp_system" }
    }
});

async function main() {
    try {
        const config = await prisma.systemConfiguration.findFirst({
            select: { id: true, visaTreasuryId: true }
        });
        console.log("Config:", config);
        if (!config || !config.visaTreasuryId) {
            console.log("Fixing visaTreasuryId...");
            const treasury = await prisma.treasury.findFirst();
            if (treasury) {
                await prisma.systemConfiguration.update({
                    where: { id: config ? config.id : 1 },
                    data: { visaTreasuryId: treasury.id }
                });
                console.log("Assigned visaTreasuryId to", treasury.id);
            }
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
