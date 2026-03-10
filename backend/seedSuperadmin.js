const prisma = require("./config/database");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("🌱 [DEBUG] Starting seeding process...");

  try {
    // 1. Define Roles
    console.log("   [DEBUG] Defining roles array...");
    const roles = [
      {
        name: "Superadmin",
        description: "Full system access with developer controls",
      },
      {
        name: "Admin",
        description: "Company/Branch manager with administrative access",
      },
      { name: "Manager", description: "Department manager" },
      { name: "Employee", description: "Standard employee access" },
    ];

    // 2. Create Roles
    console.log("   [DEBUG] iterating roles...");
    for (const roleData of roles) {
      console.log(`   [DEBUG] Processing role: ${roleData.name}`);
      try {
        const role = await prisma.role.upsert({
          where: { name: roleData.name },
          update: {},
          create: roleData,
        });
        console.log(
          `✅ [DEBUG] Role ensuring success: ${role.name} (ID: ${role.id})`
        );

        if (role.name === "Superadmin") {
          console.log("   [DEBUG] Assigning Superadmin permissions...");
          const modules = [
            // Module Access Permissions
            "HR",
            "INVENTORY",
            "POS",
            "PURCHASES",
            "SALES",
            "REPORTS",
            "TREASURIES",
            "BRANCHES",
            "EMPLOYEES",
            "CLIENTS",
            "SUPPLIERS",
            "CATEGORIES",
            "ITEMS",
            "WAREHOUSES",
            "SETTINGS",
            "EXPENSES",
            "DEPOSITS",
            // Creation Permissions
            "CREATES_WAREHOUSES",
            "CREATES_EMPLOYEES",
            "CREATES_SUPPLIERS",
            "CREATES_CLIENTS",
            "CREATES_CATEGORIES",
            "CREATES_ITEMS",
            "CREATES_TREASURIES",
            "CREATES_BRANCHES",
            "CREATES_DEPOSITS",
            "DELIVERY_MEN",
            "CREATES_DELIVERY_MEN",
            "DELIVERY_ZONES",
            "CREATES_DELIVERY_ZONES",
            "DELIVERY_SETTLEMENT",
            "CREATES_PRODUCTION",
          ];

          for (const module of modules) {
            await prisma.permission.upsert({
              where: {
                roleId_module: { roleId: role.id, module: module },
              },
              update: {
                canAccess: true,
              },
              create: {
                roleId: role.id,
                module: module,
                canAccess: true,
              },
            });
          }
          console.log("   [DEBUG] Permissions assigned.");
        }
      } catch (err) {
        console.error(
          `❌ [DEBUG] Error processing role ${roleData.name}:`,
          err
        );
        throw err;
      }
    }

    // 3. Create Superadmin User
    console.log("   [DEBUG] Fetching Superadmin role...");
    const superadminRole = await prisma.role.findUnique({
      where: { name: "Superadmin" },
    });

    if (!superadminRole) {
      throw new Error("Superadmin role not found after creation attempt");
    }
    console.log(`   [DEBUG] Superadmin role found: ID ${superadminRole.id}`);

    console.log("   [DEBUG] Hashing password...");
    const hashedPassword = await bcrypt.hash("246810@Ad", 10);
    console.log("   [DEBUG] Password hashed.");

    // Create initial infrastructure (Warehouse, Treasury, Branch)
    console.log("   [DEBUG] Checking/Creating initial warehouse...");
    let warehouse = await prisma.warehouse.findFirst({
      where: { name: "المخزن الرئيسي" },
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          name: "المخزن الرئيسي",
        },
      });
      console.log(`   [DEBUG] Warehouse created: ID ${warehouse.id}`);
    } else {
      console.log(`   [DEBUG] Main Warehouse already exists: ID ${warehouse.id}`);
    }

    console.log("   [DEBUG] Checking/Creating initial treasury...");
    let treasury = await prisma.treasury.findFirst({
      where: { name: "الخزنة الرئيسية" },
    });
    if (!treasury) {
      treasury = await prisma.treasury.create({
        data: {
          name: "الخزنة الرئيسية",
          balance: 0,
        },
      });
      console.log(`   [DEBUG] Treasury created: ID ${treasury.id}`);
    } else {
      console.log(`   [DEBUG] Main Treasury already exists: ID ${treasury.id}`);
    }

    console.log("   [DEBUG] Checking/Creating main branch...");
    let branch = await prisma.branch.findFirst({
      where: { name: "الفرع الرئيسي" },
    });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: "الفرع الرئيسي",
          address: "Headquarters",
          warehouseId: warehouse.id,
          treasuryId: treasury.id,
        },
      });
      console.log(`   [DEBUG] Branch created: ID ${branch.id}`);
    } else {
      console.log(`   [DEBUG] Main Branch already exists: ID ${branch.id}`);
    }

    console.log("   [DEBUG] Creating/Updating superadmin user...");
    const superadmin = await prisma.user.upsert({
      where: { username: "superadmin" },
      update: {
        password: hashedPassword,
        roleId: superadminRole.id,
        branchId: branch.id,
        hasSensitiveAccess: true,
      },
      create: {
        name: "Superadmin",
        username: "superadmin",
        password: hashedPassword,
        roleId: superadminRole.id,
        branchId: branch.id,
        isActive: true,
        hasSensitiveAccess: true,
      },
    });
    console.log(`👤 [DEBUG] Superadmin user ready: ${superadmin.username}`);
  } catch (error) {
    console.error("❌ [DEBUG] Fatal Error in main():", error);
    throw error;
  }

  console.log("✨ Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ [DEBUG] Top-level error catch:", e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("🔌 [DEBUG] Disconnecting Prisma...");
    await prisma.$disconnect();
  });
