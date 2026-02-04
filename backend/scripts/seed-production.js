// scripts/seed-production.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

// Load root .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const prismaGlobal = new PrismaClient();

async function main(prismaInstance = null) {
    // Use the passed instance or fall back to the local one
    const prisma = prismaInstance || prismaGlobal;
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
        "CREATES_TREASURIES", "CREATES_BRANCHES", "CREATES_DEPOSITS",
        "DELIVERY_MEN", "CREATES_DELIVERY_MEN", "DELIVERY_ZONES", "CREATES_DELIVERY_ZONES"
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

    // 3. INFRASTRUCTURE: MAIN BRANCH
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
            }
        });
        console.log(`✅ Created ${MAIN_BRANCH_NAME} (ID: ${branch.id})`);
    }

    // 4. PLACEHOLDERS (General Client & Supplier)
    // -------------------------------------------------------------
    // General Client (ID 1) target
    let generalClient = await prisma.client.findFirst({ where: { name: "عميل عام" } });
    if (!generalClient) {
        // Since DB is reset, this should get ID 1 effectively, or we just create it.
        // We can't force ID 1 easily in Prisma create for MySQL without raw SQL if strictly enforced.
        // Let's just create it.
        generalClient = await prisma.client.create({
            data: {
                name: "عميل عام",
                phoneNumber: "00000000000",
                // type removed as it is not in schema
            }
        });
        console.log(`✅ Created General Client (ID: ${generalClient.id})`);
    }

    // General Supplier (ID 1) target
    let generalSupplier = await prisma.supplier.findFirst({ where: { name: "مورد عام" } });
    if (!generalSupplier) {
        generalSupplier = await prisma.supplier.create({
            data: {
                name: "مورد عام",
                phoneNumber: "00000000000",
                // contactPerson removed as it is not in schema
            }
        });
        console.log(`✅ Created General Supplier (ID: ${generalSupplier.id})`);
    }

    // 5. SUPERADMIN USER
    // -------------------------------------------------------------
    const adminUsername = process.env.ADMIN_USERNAME || 'superadmin';
    const adminPassword = process.env.ADMIN_PASSWORD || '246810@Ad'; // Strong default

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminUser = await prisma.user.upsert({
        where: { username: adminUsername },
        update: {
            roleId: superadminRole.id,
            // Ensure superadmin has global access (branchId = null)
            branchId: null,
        },
        create: {
            name: 'Superadmin',
            username: adminUsername,
            password: hashedPassword,
            roleId: superadminRole.id,
            branchId: null, // Global access
            isActive: true,
            hasSensitiveAccess: true,
        },
    });

    console.log(`✅ Superadmin User: ${adminUser.username} (ID: ${adminUser.id})`);
    console.log('✨ Seeding Complete!');

    return adminUser;
}

// Check if run directly (node scripts/seed-production.js) vs imported
if (require.main === module) {
    main()
        .then(() => {
            console.log('✨ Seeding execution finished.');
            return prismaGlobal.$disconnect();
        })
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}

module.exports = main;
