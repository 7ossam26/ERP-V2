const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "mysql://root:@127.0.0.1:3306/erp_system"
        }
    }
});

async function main() {
    try {
        await prisma.$executeRawUnsafe("ALTER TABLE sales MODIFY COLUMN payment_method ENUM('CASH', 'INSTAPAY', 'CARD') NOT NULL DEFAULT 'CASH'");
        console.log("Migration successful!");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
