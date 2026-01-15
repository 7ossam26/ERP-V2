const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const userId = 1; // Superadmin
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { branch: true },
    });

    let branchId = null;
    if (user.branch && user.branch.isAllBranches !== true) {
        branchId = user.branchId;
    }

    const whereClause = {};
    if (branchId) {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            select: { treasuryId: true }
        });
        if (branch) {
            whereClause.treasuryId = branch.treasuryId;
        }
    }

    const expenses = await prisma.expense.findMany({
        where: whereClause,
        include: { treasury: true }
    });

    console.log(`User Branch ID: ${user.branchId}, isAllBranches: ${user.branch.isAllBranches}`);
    console.log(`Resulting branchId filter: ${branchId}`);
    console.log(`Resulting whereClause: ${JSON.stringify(whereClause)}`);
    console.log(`Count: ${expenses.length}`);
    if (expenses.length > 0) {
        console.log(`First Expense Treasury ID: ${expenses[0].treasuryId}`);
    }
}

test().finally(() => prisma.$disconnect());
