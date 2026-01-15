const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    try {
        const suppliers = await prisma.supplier.findMany();
        console.log(`Total Suppliers: ${suppliers.length}`);

        const accounts = await prisma.supplierAccount.findMany();
        console.log(`Total Supplier Accounts: ${accounts.length}`);
        console.log('Accounts:', JSON.stringify(accounts, null, 2));

        const purchases = await prisma.purchase.findMany({
            where: { paymentMethod: { in: ['DEFERRED', 'MIXED'] } }
        });
        console.log(`Deferred/Mixed Purchases: ${purchases.length}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
