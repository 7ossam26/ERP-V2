// scripts/seed-call-center-role.js
// Idempotent seeder: ensures a "Call Center" Role exists and has the CALL_CENTER permission enabled.
// Run: node scripts/seed-call-center-role.js

const path = require("path");
const fs = require("fs");

// Load env (same priority as backend/index.js: .env then .env.local)
const envBase = path.resolve(__dirname, "../.env");
const envLocal = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envBase)) require("dotenv").config({ path: envBase });
if (fs.existsSync(envLocal)) require("dotenv").config({ path: envLocal, override: true });

const prisma = require("../config/database");

async function main() {
  const roleName = "Call Center";

  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: {
      name: roleName,
      description: "Call-center agent: creates delivery orders and routes them to branches",
    },
  });

  await prisma.permission.upsert({
    where: { roleId_module: { roleId: role.id, module: "CALL_CENTER" } },
    update: { canAccess: true },
    create: { roleId: role.id, module: "CALL_CENTER", canAccess: true },
  });

  console.log(`Seeded role "${roleName}" (id=${role.id}) with CALL_CENTER permission.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
