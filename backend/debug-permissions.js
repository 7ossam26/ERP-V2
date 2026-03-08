const prisma = require("./config/database");

async function main() {
  try {
    console.log("🔍 Checking Users and Permissions...");

    const users = await prisma.user.findMany({
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    console.log(`Found ${users.length} users.`);

    for (const user of users) {
      console.log(`\n👤 User: ${user.username} (ID: ${user.id})`);
      console.log(`   Role: ${user.role.name}`);

      const salesPerm = user.role.permissions.find((p) => p.module === "SALES");
      const posPerm = user.role.permissions.find((p) => p.module === "POS");

      console.log(
        `   - SALES Permission: ${salesPerm ? (salesPerm.canAccess ? "✅ YES" : "❌ NO") : "⚠️ NOT FOUND"}`,
      );
      console.log(
        `   - POS Permission: ${posPerm ? (posPerm.canAccess ? "✅ YES" : "❌ NO") : "⚠️ NOT FOUND"}`,
      );
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
