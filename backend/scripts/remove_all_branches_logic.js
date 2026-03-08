const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("🚀 Starting cleanup of 'All Branches' logic...");

        // 1. Find the "All Branches" branch
        // We try to find it by name since the isAllBranches column might be removed from the schema/client already
        console.log("🔍 Searching for 'All Branches' branch...");
        const allBranchesBranch = await prisma.branch.findFirst({
            where: {
                name: { contains: "All Branch" } // Flexible match for "All Branches"
            },
            include: {
                users: true
            }
        });

        if (!allBranchesBranch) {
            console.log("⚠️  'All Branches' branch not found. It might have been already deleted.");
        } else {
            console.log(`✅ Found 'All Branches' (ID: ${allBranchesBranch.id}).`);
            console.log(`   It has ${allBranchesBranch.users.length} users assigned.`);

            // 2. Unassign users (Set branchId = NULL)
            if (allBranchesBranch.users.length > 0) {
                console.log("🛠️  Unassigning users...");
                const updateResult = await prisma.user.updateMany({
                    where: { branchId: allBranchesBranch.id },
                    data: { branchId: null }
                });
                console.log(`✅ Updated ${updateResult.count} users to have NULL branch.`);
            }

            // 3. Delete the Branch (and cascade/handle relations if strictly needed, but let's just deactivate/delete)
            console.log("🗑️  Deleting 'All Branches' branch...");

            // We first need to delete the branch to free up the warehouse/treasury constraint if we want to delete them too
            // But Prisma relations might restrict deletion if linked to other things. 
            // Force delete using deleteMany to avoid some constraints checks if possible, or just delete.
            try {
                await prisma.branch.delete({
                    where: { id: allBranchesBranch.id }
                });
                console.log("✅ 'All Branches' branch deleted.");
            } catch (e) {
                console.error("❌ Failed to delete branch directly (might be used in sales/history). Marking as inactive instead.");
                await prisma.branch.update({
                    where: { id: allBranchesBranch.id },
                    data: { isActive: false, name: "DELETED - All Branches" }
                });
            }
        }

        // 4. Delete "All Treasuries" and "All Branches Warehouse"
        // Clean up Treasuries
        console.log("🔍 Searching for 'All Treasuries'...");
        const allTreasury = await prisma.treasury.findFirst({
            where: { name: { contains: "All Treasur" } }
        });

        if (allTreasury) {
            console.log(`✅ Found 'All Treasuries' (ID: ${allTreasury.id}). Deleting...`);
            try {
                await prisma.treasury.delete({ where: { id: allTreasury.id } });
                console.log("✅ Treasury deleted.");
            } catch (e) {
                console.log("⚠️  Could not delete treasury (likely used). Marking inactive.");
                await prisma.treasury.update({ where: { id: allTreasury.id }, data: { isActive: false } });
            }
        } else {
            console.log("⚠️  'All Treasuries' not found.");
        }

        // Clean up Warehouses
        console.log("🔍 Searching for 'All Branches Warehouse'...");
        const allWarehouse = await prisma.warehouse.findFirst({
            where: { name: { contains: "All Branches" } }
        });

        if (allWarehouse) {
            console.log(`✅ Found 'All Branches Warehouse' (ID: ${allWarehouse.id}). Deleting...`);
            try {
                await prisma.warehouse.delete({ where: { id: allWarehouse.id } });
                console.log("✅ Warehouse deleted.");
            } catch (e) {
                console.log("⚠️  Could not delete warehouse (likely used). Marking inactive.");
                await prisma.warehouse.update({ where: { id: allWarehouse.id }, data: { isActive: false } });
            }
        } else {
            console.log("⚠️  'All Branches Warehouse' not found.");
        }

        console.log("🏁 Cleanup complete.");

    } catch (error) {
        console.error("❌ Error during cleanup:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
