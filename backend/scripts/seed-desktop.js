/**
 * ERP-V2 Desktop — First-Run Seed Script
 *
 * Creates initial data when the database is empty:
 * - 4 Roles (Superadmin, Admin, Manager, Employee)
 * - Permissions for Superadmin (all), Admin, Employee
 * - Main Warehouse, Treasury, Branch
 * - General Client & Supplier placeholders
 * - Superadmin user account
 *
 * Uses Prisma ORM (not raw SQL).
 * Called from main.js on app startup.
 */

const bcrypt = require("bcryptjs");

async function runSeedIfNeeded() {
  // Import prisma lazily (database must be initialized first)
  const prisma = require("../config/database");

  try {
    // Check if database is already seeded
    const roleCount = await prisma.role.count();
    if (roleCount > 0) {
      console.log("[SEED] Database already seeded. Skipping.");
      return;
    }

    console.log("[SEED] 🌱 Starting first-run seeding...");

    // ─── 1. Roles ──────────────────────────────────────────────────────
    const roles = [
      { name: "Superadmin", description: "Full system access with developer controls" },
      { name: "Admin", description: "Company/Branch manager with administrative access" },
      { name: "Manager", description: "Department manager" },
      { name: "Employee", description: "Standard employee access" },
    ];

    for (const roleData of roles) {
      await prisma.role.create({ data: roleData });
    }
    console.log("[SEED] ✅ Roles created");

    // ─── 2. Permissions ────────────────────────────────────────────────
    const superadminRole = await prisma.role.findUnique({ where: { name: "Superadmin" } });
    const employeeRole = await prisma.role.findUnique({ where: { name: "Employee" } });
    const adminRole = await prisma.role.findUnique({ where: { name: "Admin" } });

    // Superadmin gets ALL modules
    const allModules = [
      "HR", "INVENTORY", "INVENTORY_COUNT", "STOCK_TRANSFER", "POS",
      "PURCHASES", "SALES", "REPORTS", "TREASURIES", "CASH_TRANSFER",
      "TRANSFER_MANAGEMENT", "BRANCHES", "EMPLOYEES", "CLIENTS",
      "SUPPLIERS", "SUPPLIER_ACCOUNTS", "CATEGORIES", "ITEMS",
      "WAREHOUSES", "SETTINGS", "EXPENSES", "SHIFTS", "DELIVERY_SETTLEMENT",
      "CREATES_WAREHOUSES", "CREATES_EMPLOYEES", "CREATES_SUPPLIERS",
      "CREATES_CLIENTS", "CREATES_CATEGORIES", "CREATES_ITEMS",
      "CREATES_TREASURIES", "CREATES_BRANCHES",
      "DEPOSITS", "CREATES_DEPOSITS",
      "WITHDRAWALS", "CREATES_WITHDRAWALS",
      "DELIVERY_MEN", "CREATES_DELIVERY_MEN",
      "DELIVERY_ZONES", "CREATES_DELIVERY_ZONES",
      "CREATES_PRODUCTION", "PRODUCTION",
    ];

    for (const module of allModules) {
      await prisma.permission.create({
        data: { roleId: superadminRole.id, module, canAccess: true },
      });
    }
    console.log("[SEED] ✅ Superadmin permissions created");

    // Employee gets limited modules
    const employeeModules = [
      "POS", "SALES", "CLIENTS", "ITEMS", "CATEGORIES",
      "INVENTORY", "CREATES_CLIENTS",
    ];
    for (const module of employeeModules) {
      await prisma.permission.create({
        data: { roleId: employeeRole.id, module, canAccess: true },
      });
    }
    console.log("[SEED] ✅ Employee permissions created");

    // Admin gets deposit/withdrawal modules
    const adminModules = [
      "DEPOSITS", "CREATES_DEPOSITS",
      "WITHDRAWALS", "CREATES_WITHDRAWALS",
    ];
    for (const module of adminModules) {
      await prisma.permission.create({
        data: { roleId: adminRole.id, module, canAccess: true },
      });
    }
    console.log("[SEED] ✅ Admin permissions created");

    // ─── 3. Infrastructure ─────────────────────────────────────────────
    const warehouse = await prisma.warehouse.create({
      data: { name: "المخزن الرئيسي" },
    });
    console.log(`[SEED] ✅ Main Warehouse created (ID: ${warehouse.id})`);

    const treasury = await prisma.treasury.create({
      data: { name: "الخزنة الرئيسية", balance: 0 },
    });
    console.log(`[SEED] ✅ Main Treasury created (ID: ${treasury.id})`);

    const branch = await prisma.branch.create({
      data: {
        name: "الفرع الرئيسي",
        address: "Headquarters",
        warehouseId: warehouse.id,
        treasuryId: treasury.id,
      },
    });
    console.log(`[SEED] ✅ Main Branch created (ID: ${branch.id})`);

    // ─── 4. Placeholders ───────────────────────────────────────────────
    await prisma.client.create({
      data: { name: "عميل نقدي", phoneNumber: "00000000000" },
    });
    console.log("[SEED] ✅ General Client created");

    await prisma.supplier.create({
      data: { name: "مورد عام", phoneNumber: "00000000000" },
    });
    console.log("[SEED] ✅ General Supplier created");

    // ─── 5. Superadmin User ────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash("246810@Ad", 10);
    const superadmin = await prisma.user.create({
      data: {
        name: "Superadmin",
        username: "superadmin",
        password: hashedPassword,
        roleId: superadminRole.id,
        branchId: null,
        isActive: true,
        hasSensitiveAccess: true,
      },
    });
    console.log(`[SEED] ✅ Superadmin user created (ID: ${superadmin.id})`);

    console.log("[SEED] ✨ First-run seeding completed successfully!");
  } catch (error) {
    console.error("[SEED] ❌ Seeding failed:", error);
    throw error;
  }
}

module.exports = { runSeedIfNeeded };
