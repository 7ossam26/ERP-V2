// Merged idempotent seed script.
// Replaces: prisma/seed.js (treasuries), seedSuperadmin.js, scripts/seed-walkin-client.js,
//           scripts/seed-call-center-role.js, scripts/seed-production.js.
//
// Run via:
//   npx prisma db seed                    (uses backend/package.json "prisma.seed")
//   node backend/prisma/seed.js
//
// Safe to re-run: every block uses upsert / findFirst+create / patch-only-if-missing.

const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

// Load env (.env then .env.local, latter overrides)
for (const f of [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(__dirname, "../.env.local"),
]) {
  if (fs.existsSync(f)) require("dotenv").config({ path: f, override: true });
}

const prisma = new PrismaClient();

// ----- Role definitions -----
const ROLES = [
  { name: "Superadmin", description: "Full system access with developer controls" },
  { name: "Admin", description: "Company/Branch manager with administrative access" },
  { name: "Manager", description: "Department manager" },
  { name: "Employee", description: "Standard employee access" },
  {
    name: "Call Center",
    description: "Call-center agent: creates delivery orders and routes them to branches",
  },
];

// ----- Permission matrix (role → modules) -----
const SUPERADMIN_MODULES = [
  "HR", "INVENTORY", "INVENTORY_COUNT", "STOCK_TRANSFER",
  "POS", "PURCHASES", "SALES", "REPORTS",
  "TREASURIES", "CASH_TRANSFER", "TRANSFER_MANAGEMENT",
  "BRANCHES", "EMPLOYEES", "CLIENTS", "SUPPLIERS", "SUPPLIER_ACCOUNTS",
  "CATEGORIES", "ITEMS", "WAREHOUSES", "SETTINGS", "EXPENSES",
  "SHIFTS", "DELIVERY_SETTLEMENT",
  "CREATES_WAREHOUSES", "CREATES_EMPLOYEES", "CREATES_SUPPLIERS",
  "CREATES_CLIENTS", "CREATES_CATEGORIES", "CREATES_ITEMS",
  "CREATES_TREASURIES", "CREATES_BRANCHES",
  "DEPOSITS", "CREATES_DEPOSITS", "WITHDRAWALS", "CREATES_WITHDRAWALS",
  "DELIVERY_MEN", "CREATES_DELIVERY_MEN",
  "DELIVERY_ZONES", "CREATES_DELIVERY_ZONES",
  "PRODUCTION", "CREATES_PRODUCTION", "INITIAL_INVENTORY",
  "CALL_CENTER",
  "BULK_POS", "BULK_CUSTOMERS", "BULK_PRICING", "BULK_CREDIT", "BULK_REPORTS",
];

const ADMIN_MODULES = [
  "DEPOSITS", "CREATES_DEPOSITS", "WITHDRAWALS", "CREATES_WITHDRAWALS",
];

const EMPLOYEE_MODULES = [
  "POS", "SALES", "CLIENTS", "ITEMS", "CATEGORIES", "INVENTORY", "CREATES_CLIENTS",
];

const CALL_CENTER_MODULES = ["CALL_CENTER"];

const PERMISSIONS_BY_ROLE = {
  Superadmin: SUPERADMIN_MODULES,
  Admin: ADMIN_MODULES,
  Employee: EMPLOYEE_MODULES,
  "Call Center": CALL_CENTER_MODULES,
};

// ----- Constants -----
const MAIN_WAREHOUSE_NAME = "المخزن الرئيسي";
const MAIN_TREASURY_NAME = "الخزنة الرئيسية";
const MAIN_BRANCH_NAME = "الفرع الرئيسي";
const WALKIN_CLIENT_NAME = "عميل نقدي";
const GENERAL_SUPPLIER_NAME = "مورد عام";
const VISA_TREASURY_NAME = "خزينة فيزا";
const INSTAPAY_TREASURY_NAME = "خزينة انستاباي";

// ===== Steps ===============================================================

async function seedRoles() {
  const byName = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    byName[r.name] = role;
  }
  console.log(`✅ Roles: ${Object.keys(byName).length} ensured`);
  return byName;
}

async function seedPermissions(rolesByName) {
  let count = 0;
  for (const [roleName, modules] of Object.entries(PERMISSIONS_BY_ROLE)) {
    const role = rolesByName[roleName];
    if (!role) continue;
    for (const module of modules) {
      await prisma.permission.upsert({
        where: { roleId_module: { roleId: role.id, module } },
        update: { canAccess: true },
        create: { roleId: role.id, module, canAccess: true },
      });
      count++;
    }
  }
  console.log(`✅ Permissions: ${count} ensured`);
}

async function ensureNamed(model, name, createData) {
  const existing = await prisma[model].findFirst({ where: { name } });
  if (existing) return existing;
  return prisma[model].create({ data: { name, ...createData } });
}

async function seedInfrastructure() {
  const warehouse = await ensureNamed("warehouse", MAIN_WAREHOUSE_NAME, {});
  const treasury = await ensureNamed("treasury", MAIN_TREASURY_NAME, { balance: 0 });
  const branch = await ensureNamed("branch", MAIN_BRANCH_NAME, {
    address: "Headquarters",
    warehouseId: warehouse.id,
    treasuryId: treasury.id,
  });
  console.log(
    `✅ Infrastructure: warehouse#${warehouse.id}, treasury#${treasury.id}, branch#${branch.id}`
  );
  return { warehouse, treasury, branch };
}

async function ensureGlobalTreasury(scope, name) {
  const existing = await prisma.treasury.findFirst({
    where: { scope, isActive: true },
  });
  if (existing) return existing;
  return prisma.treasury.create({
    data: { name, scope, balance: 0, isActive: true },
  });
}

async function seedDigitalTreasuriesAndConfig() {
  const visa = await ensureGlobalTreasury("GLOBAL_VISA", VISA_TREASURY_NAME);
  const instapay = await ensureGlobalTreasury("GLOBAL_INSTAPAY", INSTAPAY_TREASURY_NAME);

  const config = await prisma.systemConfiguration.findFirst({ where: { id: 1 } });
  if (!config) {
    await prisma.systemConfiguration.create({
      data: {
        id: 1,
        companyName: "ERP System",
        visaTreasuryId: visa.id,
        instapayTreasuryId: instapay.id,
      },
    });
    console.log(`✅ SystemConfiguration created (visa#${visa.id}, instapay#${instapay.id})`);
  } else {
    const patch = {};
    if (!config.visaTreasuryId) patch.visaTreasuryId = visa.id;
    if (!config.instapayTreasuryId) patch.instapayTreasuryId = instapay.id;
    if (Object.keys(patch).length) {
      await prisma.systemConfiguration.update({ where: { id: 1 }, data: patch });
      console.log(`✅ SystemConfiguration patched: ${Object.keys(patch).join(", ")}`);
    } else {
      console.log("✅ SystemConfiguration already wired");
    }
  }
}

async function seedWalkinClient() {
  // Pin the walk-in client to id=1 so legacy POS code can rely on it.
  const existing = await prisma.client.findUnique({ where: { id: 1 } });
  if (existing) {
    if (existing.name !== WALKIN_CLIENT_NAME) {
      await prisma.client.update({
        where: { id: 1 },
        data: { name: WALKIN_CLIENT_NAME },
      });
      console.log(`✅ Walk-in client (id=1) renamed → ${WALKIN_CLIENT_NAME}`);
    } else {
      console.log("✅ Walk-in client (id=1) present");
    }
    return;
  }
  await prisma.client.create({
    data: {
      id: 1,
      name: WALKIN_CLIENT_NAME,
      phoneNumber: "0000000000",
      address: null,
    },
  });
  console.log(`✅ Walk-in client (id=1) created → ${WALKIN_CLIENT_NAME}`);
}

async function seedGeneralSupplier() {
  const existing = await prisma.supplier.findFirst({
    where: { name: GENERAL_SUPPLIER_NAME },
  });
  if (existing) {
    console.log("✅ General supplier present");
    return;
  }
  await prisma.supplier.create({
    data: { name: GENERAL_SUPPLIER_NAME, phoneNumber: "00000000000" },
  });
  console.log(`✅ General supplier created → ${GENERAL_SUPPLIER_NAME}`);
}

async function seedSuperadminUser(superadminRole) {
  const username = process.env.ADMIN_USERNAME || "superadmin";
  const password = process.env.ADMIN_PASSWORD || "246810@Ad";
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      password: hashed,
      roleId: superadminRole.id,
      hasSensitiveAccess: true,
      isActive: true,
    },
    create: {
      name: "Superadmin",
      username,
      password: hashed,
      roleId: superadminRole.id,
      isActive: true,
      hasSensitiveAccess: true,
    },
  });
  console.log(`✅ Superadmin user → ${user.username} (id#${user.id})`);
}

// ===== Main ================================================================

async function main() {
  console.log("🌱 Seeding…");
  const roles = await seedRoles();
  await seedPermissions(roles);
  await seedInfrastructure();
  await seedDigitalTreasuriesAndConfig();
  await seedWalkinClient();
  await seedGeneralSupplier();
  await seedSuperadminUser(roles.Superadmin);
  console.log("✨ Seed complete.");
}

// Auto-run when invoked directly (`node prisma/seed.js` or `prisma db seed`).
// When require()d as a module, just export `main` so callers can invoke it
// programmatically (e.g. the /api/dangerous-reset-db endpoint).
if (require.main === module) {
  main()
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = main;
