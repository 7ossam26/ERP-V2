// Surgical, idempotent: ensures the "Call Center" role exists and has the
// CALL_CENTER module permission. Touches no other roles, users, or data.
//
// Run on the production server:
//   cd backend && node scripts/add-call-center-role.js

const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

for (const f of [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(__dirname, "../.env.local"),
]) {
  if (fs.existsSync(f)) require("dotenv").config({ path: f, override: true });
}

const prisma = new PrismaClient();

const ROLE_NAME = "Call Center";
const ROLE_DESCRIPTION =
  "Call-center agent: creates delivery orders and routes them to branches";
const MODULE = "CALL_CENTER";

async function main() {
  const role = await prisma.role.upsert({
    where: { name: ROLE_NAME },
    update: {},
    create: { name: ROLE_NAME, description: ROLE_DESCRIPTION },
  });
  console.log(`role "${ROLE_NAME}" id=${role.id}`);

  const permission = await prisma.permission.upsert({
    where: { roleId_module: { roleId: role.id, module: MODULE } },
    update: { canAccess: true },
    create: { roleId: role.id, module: MODULE, canAccess: true },
  });
  console.log(`permission ${MODULE} id=${permission.id} canAccess=${permission.canAccess}`);

  console.log("done.");
}

main()
  .catch((err) => {
    console.error("failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
