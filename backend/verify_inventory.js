const prisma = require('./config/database');

async function verifyInventory() {
    try {
        console.log("=== Checking Inventory Records ===");
        const inventory = await prisma.inventory.findMany({
            include: {
                item: { select: { name: true } },
                warehouse: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' },
            take: 10
        });

        console.log("\nRecent Inventory Records:");
        inventory.forEach(inv => {
            console.log(`- ${inv.item.name} @ ${inv.warehouse.name}: ${inv.quantity} units`);
        });

        console.log("\n=== Checking Recent Purchases ===");
        const purchases = await prisma.purchase.findMany({
            include: {
                items: {
                    include: { item: { select: { name: true } } }
                },
                warehouse: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 3
        });

        purchases.forEach(p => {
            console.log(`\nPurchase #${p.id} to ${p.warehouse.name}:`);
            p.items.forEach(item => {
                console.log(`  - ${item.item.name}: ${item.quantity} units`);
            });
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyInventory();
