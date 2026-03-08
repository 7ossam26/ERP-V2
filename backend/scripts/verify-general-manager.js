const { getUserBranchFilter } = require("../middleware/auth");
const prisma = require("../config/database");
const dotenv = require("dotenv");
const path = require("path");

// Load env
const envBackend = path.resolve(__dirname, "../.env");
dotenv.config({ path: envBackend });
// If not found, try root
if (!process.env.DATABASE_URL) {
    const envRoot = path.resolve(__dirname, "../../.env");
    dotenv.config({ path: envRoot });
}

console.log("DB URL Loaded:", process.env.DATABASE_URL ? "YES" : "NO");

async function verify() {
    console.log("🧪 Starting General Manager Verification...");

    try {
        // 1. Setup Data
        // Ensure we have at least 2 branches
        const branches = await prisma.branch.findMany({ take: 2 });
        if (branches.length < 2) {
            console.log("⚠️ Not enough branches to test. Creating temp branches...");
            // Create dummy branches if needed (simplified)
            // For now, assuming production/dev has branches. If not, we might fail.
            // Let's create them to be safe.
            await prisma.branch.create({
                data: {
                    name: "Test Branch A",
                    address: "Test",
                    warehouse: { create: { name: "Test Warehouse A" } },
                    treasury: { create: { name: "Test Treasury A" } }
                }
            });
            await prisma.branch.create({
                data: {
                    name: "Test Branch B",
                    address: "Test",
                    warehouse: { create: { name: "Test Warehouse B" } },
                    treasury: { create: { name: "Test Treasury B" } }
                }
            });
        }

        const allBranches = await prisma.branch.findMany({ take: 3 });
        const branchA = allBranches[0];
        const branchB = allBranches[1];

        console.log(`📍 Using Branches: ${branchA.name} (${branchA.id}), ${branchB.name} (${branchB.id})`);

        // Get Role
        const role = await prisma.role.findUnique({ where: { name: "General Manager" } });
        if (!role) throw new Error("General Manager role not found");

        // Create Test User
        const testUsername = "gen_man_test_" + Date.now();
        const user = await prisma.user.create({
            data: {
                name: "Test General Manager",
                username: testUsername,
                password: "password123",
                roleId: role.id,
                branchId: branchA.id, // Primary Branch A
                isActive: true,
                accessibleBranches: {
                    connect: [{ id: branchB.id }] // Access to Branch B as well
                }
            },
            include: { accessibleBranches: true }
        });

        console.log(`👤 Created User: ${user.username} (ID: ${user.id})`);
        console.log(`   - Home Branch: ${user.branchId}`);
        console.log(`   - Accessible: ${user.accessibleBranches.map(b => b.id).join(", ")}`);

        // 2. Test Logic
        console.log("🔍 Testing getUserBranchFilter...");
        const filter = await getUserBranchFilter(user.id);

        console.log("📊 Filter Result:", JSON.stringify(filter, null, 2));

        // 3. Validation
        const allowedIds = filter.id.in || [filter.id];
        const hasA = allowedIds.includes(branchA.id);
        const hasB = allowedIds.includes(branchB.id);

        if (hasA && hasB) {
            console.log("✅ SUCCESS: User has access to both Home Branch and Accessible Branch.");
        } else {
            console.error("❌ FAILURE: User missing access to one or more branches.");
        }

        // Cleanup
        await prisma.user.delete({ where: { id: user.id } });
        console.log("🧹 Cleanup done.");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
