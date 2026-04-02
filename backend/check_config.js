const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: { url: "mysql://root:@127.0.0.1:3306/erp_system" }
    }
});

async function main() {
    try {
        const config = await prisma.systemConfiguration.findFirst({
            select: { id: true, bankTreasuryId: true }
        });
        console.log("Config:", config);
        if (!config || !config.bankTreasuryId) {
            console.log("Fixing bankTreasuryId...");
            const treasury = await prisma.treasury.findFirst();
            if (treasury) {
                await prisma.systemConfiguration.update({
                    where: { id: config ? config.id : 1 },
                    data: { bankTreasuryId: treasury.id }
                });
                console.log("Assigned bankTreasuryId to", treasury.id);
            }
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
