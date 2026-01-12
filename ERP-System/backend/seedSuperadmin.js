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
            // Creation Permissions
            "CREATES_WAREHOUSES",
            "CREATES_EMPLOYEES",
            "CREATES_SUPPLIERS",
            "CREATES_CLIENTS",
            "CREATES_CATEGORIES",
            "CREATES_ITEMS",
            "CREATES_TREASURIES",
            "CREATES_BRANCHES",
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
    console.log("   [DEBUG] Creating initial warehouse...");
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Main Warehouse",
      },
    });
    console.log(`   [DEBUG] Warehouse created: ID ${warehouse.id}`);

    console.log("   [DEBUG] Creating initial treasury...");
    const treasury = await prisma.treasury.create({
      data: {
        name: "Main Treasury",
        balance: 0,
      },
    });
    console.log(`   [DEBUG] Treasury created: ID ${treasury.id}`);

    console.log("   [DEBUG] Creating main branch...");
    const branch = await prisma.branch.create({
      data: {
        name: "Main Branch",
        address: "Headquarters",
        warehouseId: warehouse.id,
        treasuryId: treasury.id,
        isAllBranches: false,
      },
    });
    console.log(`   [DEBUG] Branch created: ID ${branch.id}`);

    // Create "All Branches" special branch for users who can see all branch data
    console.log("   [DEBUG] Checking/Creating All Branches infrastructure...");

    // 1. Warehouse
    let allBranchesWarehouse = await prisma.warehouse.findFirst({
      where: { name: "All Branches Warehouse" }
    });
    if (!allBranchesWarehouse) {
      allBranchesWarehouse = await prisma.warehouse.create({
        data: { name: "All Branches Warehouse" }
      });
      console.log(`   [DEBUG] All Branches Warehouse created: ${allBranchesWarehouse.id}`);
    } else {
      console.log(`   [DEBUG] All Branches Warehouse exists: ${allBranchesWarehouse.id}`);
    }

    // 2. Treasury
    let allBranchesTreasury = await prisma.treasury.findFirst({
      where: { name: "All Branches Treasury" }
    });
    if (!allBranchesTreasury) {
      allBranchesTreasury = await prisma.treasury.create({
        data: { name: "All Branches Treasury", balance: 0 }
      });
      console.log(`   [DEBUG] All Branches Treasury created: ${allBranchesTreasury.id}`);
    } else {
      console.log(`   [DEBUG] All Branches Treasury exists: ${allBranchesTreasury.id}`);
    }

    // 3. Branch
    let allBranchesBranch = await prisma.branch.findFirst({
      where: { isAllBranches: true }
    });

    if (!allBranchesBranch) {
      allBranchesBranch = await prisma.branch.create({
        data: {
          name: "All Branches",
          address: "N/A - Special Branch for Multi-Branch Access",
          warehouseId: allBranchesWarehouse.id,
          treasuryId: allBranchesTreasury.id,
          isAllBranches: true,
        },
      });
      console.log(`   [DEBUG] All Branches branch created: ID ${allBranchesBranch.id}`);
    } else {
      console.log(`   [DEBUG] All Branches branch exists: ID ${allBranchesBranch.id}`);
    }

    console.log("   [DEBUG] Creating/Updating superadmin user...");
    const superadmin = await prisma.user.upsert({
      where: { username: "superadmin" },
      update: {
        password: hashedPassword,
        roleId: superadminRole.id,
        branchId: branch.id,
      },
      create: {
        name: "Superadmin",
        username: "superadmin",
        password: hashedPassword,
        roleId: superadminRole.id,
        branchId: branch.id,
        isActive: true,
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
