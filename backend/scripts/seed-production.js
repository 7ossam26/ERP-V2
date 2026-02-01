// scripts/seed-production.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

// Load root .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Production Seeding...');

    // 1. ROLES
    // -------------------------------------------------------------
    const roles = [
        { name: 'Superadmin', description: 'Full system access' },
        { name: 'Admin', description: 'Administrative access' },
        { name: 'Manager', description: 'Department manager' },
        { name: 'Employee', description: 'Standard employee' },
    ];

    for (const r of roles) {
        await prisma.role.upsert({
            where: { name: r.name },
            update: {},
            create: r,
        });
    }
    console.log('✅ Roles synced');

    // 2. PERMISSIONS (Superadmin)
    // -------------------------------------------------------------
    const superadminRole = await prisma.role.findUnique({ where: { name: 'Superadmin' } });
    if (!superadminRole) throw new Error('Superadmin Role not found');

    const modules = [
        "HR", "INVENTORY", "POS", "PURCHASES", "SALES", "REPORTS",
        "TREASURIES", "BRANCHES", "EMPLOYEES", "CLIENTS", "SUPPLIERS",
        "CATEGORIES", "ITEMS", "WAREHOUSES", "SETTINGS", "EXPENSES", "DEPOSITS",
        "STOCK_TRANSFER", "CASH_TRANSFER", "TRANSFER_MANAGEMENT",
        "SUPPLIER_ACCOUNTS", "INVENTORY_COUNT",
        "CREATES_WAREHOUSES", "CREATES_EMPLOYEES", "CREATES_SUPPLIERS",
        "CREATES_CLIENTS", "CREATES_CATEGORIES", "CREATES_ITEMS",
        "CREATES_TREASURIES", "CREATES_BRANCHES", "CREATES_DEPOSITS"
    ];

    for (const module of modules) {
        await prisma.permission.upsert({
            where: { roleId_module: { roleId: superadminRole.id, module } },
            update: { canAccess: true },
            create: { roleId: superadminRole.id, module, canAccess: true },
        });
    }
    console.log('✅ Permissions synced');

    // 2.5. PERMISSIONS (Employee)
    // -------------------------------------------------------------
    const employeeRole = await prisma.role.findUnique({ where: { name: 'Employee' } });
    if (employeeRole) {
        const employeeModules = [
            "POS", "SALES", "CLIENTS", "ITEMS", "CATEGORIES", "INVENTORY",
            "CREATES_CLIENTS" // Needed for POS new client creation
        ];

        for (const module of employeeModules) {
            await prisma.permission.upsert({
                where: { roleId_module: { roleId: employeeRole.id, module } },
                update: { canAccess: true },
                create: { roleId: employeeRole.id, module, canAccess: true },
            });
        }
        console.log('✅ Employee Permissions synced');
    }

    // 3. INFRASTRUCTURE: "ALL BRANCHES" (Global/System Default) - MUST BE ID 1
    // -------------------------------------------------------------
    const ALL_BRANCHES_NAME = 'All Branches';

    // A. Global Warehouse (ID 1)
    let allWh = await prisma.warehouse.findUnique({ where: { id: 1 } });
    if (!allWh) {
        // Try creating with explicit ID
        allWh = await prisma.warehouse.create({
            data: { id: 1, name: `${ALL_BRANCHES_NAME} Warehouse` }
        });
        console.log(`✅ Created ${ALL_BRANCHES_NAME} Warehouse (ID: 1)`);
    } else {
        // Ensure name is correct if it exists
        if (!allWh.name.includes(ALL_BRANCHES_NAME)) {
            await prisma.warehouse.update({ where: { id: 1 }, data: { name: `${ALL_BRANCHES_NAME} Warehouse` } });
            console.log(`✅ Updated Warehouse ID 1 to be ${ALL_BRANCHES_NAME}`);
        }
    }

    // B. Global Treasury (ID 1)
    let allTr = await prisma.treasury.findUnique({ where: { id: 1 } });
    if (!allTr) {
        allTr = await prisma.treasury.create({
            data: { id: 1, name: `${ALL_BRANCHES_NAME} Treasury`, balance: 0 }
        });
        console.log(`✅ Created ${ALL_BRANCHES_NAME} Treasury (ID: 1)`);
    } else {
        if (!allTr.name.includes(ALL_BRANCHES_NAME)) {
            await prisma.treasury.update({ where: { id: 1 }, data: { name: `${ALL_BRANCHES_NAME} Treasury` } });
        }
    }

    // C. Global Branch (ID 1)
    let allBranch = await prisma.branch.findUnique({ where: { id: 1 } });
    if (!allBranch) {
        allBranch = await prisma.branch.create({
            data: {
                id: 1,
                name: ALL_BRANCHES_NAME,
                address: 'Virtual Branch',
                warehouseId: 1,
                treasuryId: 1,
                isAllBranches: true
            }
        });
        console.log(`✅ Created ${ALL_BRANCHES_NAME} (ID: 1)`);
    } else {
        if (!allBranch.isAllBranches) {
            await prisma.branch.update({ where: { id: 1 }, data: { isAllBranches: true, name: ALL_BRANCHES_NAME } });
            console.log(`✅ Forced Branch ID 1 to be ${ALL_BRANCHES_NAME}`);
        }
    }

    // 4. INFRASTRUCTURE: PHYSICAL MAIN BRANCH (Secondary)
    // -------------------------------------------------------------
    const MAIN_BRANCH_NAME = 'Main Branch';
    const MAIN_WAREHOUSE_NAME = 'Main Warehouse';
    const MAIN_TREASURY_NAME = 'Main Treasury';

    // Warehouse
    let warehouse = await prisma.warehouse.findFirst({ where: { name: MAIN_WAREHOUSE_NAME } });
    if (!warehouse) {
        warehouse = await prisma.warehouse.create({ data: { name: MAIN_WAREHOUSE_NAME } });
        console.log(`✅ Created ${MAIN_WAREHOUSE_NAME} (ID: ${warehouse.id})`);
    }

    // Treasury
    let treasury = await prisma.treasury.findFirst({ where: { name: MAIN_TREASURY_NAME } });
    if (!treasury) {
        treasury = await prisma.treasury.create({ data: { name: MAIN_TREASURY_NAME, balance: 0 } });
        console.log(`✅ Created ${MAIN_TREASURY_NAME} (ID: ${treasury.id})`);
    }

    // Branch
    let branch = await prisma.branch.findFirst({ where: { name: MAIN_BRANCH_NAME } });
    if (!branch) {
        branch = await prisma.branch.create({
            data: {
                name: MAIN_BRANCH_NAME,
                address: 'Headquarters',
                warehouseId: warehouse.id,
                treasuryId: treasury.id,
                isAllBranches: false
            }
        });
        console.log(`✅ Created ${MAIN_BRANCH_NAME} (ID: ${branch.id})`);
    }

    // 5. SUPERADMIN USER
    // -------------------------------------------------------------
    const adminUsername = process.env.ADMIN_USERNAME || 'superadmin';
    const adminPassword = process.env.ADMIN_PASSWORD || '246810@Ad'; // Strong default, but recommend changing

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminUser = await prisma.user.upsert({
        where: { username: adminUsername },
        update: {
            // Don't update password on re-seed to avoid locking out. 
            // Only update metadata if needed.
            roleId: superadminRole.id,
        },
        create: {
            name: 'Superadmin',
            username: adminUsername,
            password: hashedPassword,
            roleId: superadminRole.id,
            branchId: branch.id,
            isActive: true,
            hasSensitiveAccess: true,
        },
    });

    console.log(`✅ Superadmin User: ${adminUser.username} (ID: ${adminUser.id})`);
    console.log('✨ Seeding Complete!');
    console.log('✨ Seeding Complete!');

    // Return the promise so it can be awaited
    return adminUser;
}

// Check if run directly (node scripts/seed-production.js) vs imported
if (require.main === module) {
    main()
        .then(() => {
            console.log('✨ Seeding execution finished.');
            // Don't force exit, let connection close naturally
            return prisma.$disconnect();
        })
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}

module.exports = main;
