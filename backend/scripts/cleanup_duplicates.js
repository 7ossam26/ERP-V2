const path = require('path');
const dotenv = require('dotenv');

// Load root .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const { PrismaClient } = require('@prisma/client');

// console.log("DB URL:", process.env.DATABASE_URL); // Debugging

const prisma = new PrismaClient();

async function cleanup() {
    console.log('Starting cleanup...');

    // 1. Clean up Categories
    const categories = await prisma.category.groupBy({
        by: ['name'],
        _count: {
            name: true,
        },
        having: {
            name: {
                _count: {
                    gt: 1,
                },
            },
        },
    });

    console.log(`Found ${categories.length} duplicate category names.`);

    for (const catGroup of categories) {
        const name = catGroup.name;
        const dups = await prisma.category.findMany({
            where: { name },
            orderBy: { id: 'asc' },
        });

        // Keep the first one, delete the rest
        const [keep, ...remove] = dups;
        console.log(`Keeping category "${name}" (ID: ${keep.id}), removing ${remove.length} duplicates.`);

        for (const rem of remove) {
            await prisma.category.delete({
                where: { id: rem.id },
            });
        }
    }

    // 2. Clean up Items
    const items = await prisma.item.groupBy({
        by: ['name'],
        _count: {
            name: true,
        },
        having: {
            name: {
                _count: {
                    gt: 1,
                },
            },
        },
    });

    console.log(`Found ${items.length} duplicate item names.`);

    for (const itemGroup of items) {
        const name = itemGroup.name;
        const dups = await prisma.item.findMany({
            where: { name },
            orderBy: { id: 'asc' },
        });

        const [keep, ...remove] = dups;
        console.log(`Keeping item "${name}" (ID: ${keep.id}), removing ${remove.length} duplicates.`);

        for (const rem of remove) {
            const id = rem.id;
            // Manually delete dependencies that are Restrict
            // PurchaseItem, SaleItem, Inventory, StockTransferItem
            // Note: This deletes the detailed records. Parent records (Sale, Purchase) remain but might be incomplete.
            // Given "test db" status, this is acceptable.

            await prisma.inventory.deleteMany({ where: { itemId: id } });
            await prisma.purchaseItem.deleteMany({ where: { itemId: id } });
            await prisma.saleItem.deleteMany({ where: { itemId: id } });
            await prisma.stockTransferItem.deleteMany({ where: { itemId: id } });

            // Relations that cascade (ItemSupplier, ItemCategory) will be handled by prisma delete
            await prisma.item.delete({
                where: { id },
            });
        }
    }

    console.log('Cleanup complete.');
}

cleanup()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
