const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const expenses = await prisma.expense.findMany({
        include: {
            treasury: true
        }
    });
    console.log(JSON.stringify(expenses, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
