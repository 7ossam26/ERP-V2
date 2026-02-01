const prisma = require("./config/database");

async function main() {
  try {
    console.log("🛠️ Fixing Manager Permissions...");

    // Find the Manager role
    const managerRole = await prisma.role.findUnique({
      where: { name: "Manager" },
    });

    if (!managerRole) {
      console.error("❌ Manager role not found!");
      return;
    }

    console.log(`✅ Found Manager role (ID: ${managerRole.id})`);

    // Upsert the SALES permission for Manager
    const perm = await prisma.permission.upsert({
      where: {
        roleId_module: {
          roleId: managerRole.id,
          module: "SALES",
        },
      },
      update: {
        canAccess: true,
      },
      create: {
        roleId: managerRole.id,
        module: "SALES",
        canAccess: true,
      },
    });

    console.log(
      `✅ Updated SALES permission for Manager: ${perm.canAccess ? "GRANTED" : "DENIED"}`,
    );

    // Also verify POS permission
    const posPerm = await prisma.permission.upsert({
      where: {
        roleId_module: {
          roleId: managerRole.id,
          module: "POS",
        },
      },
      update: { canAccess: true },
      create: {
        roleId: managerRole.id,
        module: "POS",
        canAccess: true,
      },
    });
    console.log(
      `✅ Updated POS permission for Manager: ${posPerm.canAccess ? "GRANTED" : "DENIED"}`,
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
