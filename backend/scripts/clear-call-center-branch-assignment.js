// Clears branchId and accessibleBranches for every user whose role is
// "Call Center". Run once after deploying the fix that makes Call Center a
// branch-less (company-wide) role. Idempotent. Safe to re-run.
//
// Run on the production server:
//   cd backend && node scripts/clear-call-center-branch-assignment.js

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

async function main() {
  const role = await prisma.role.findUnique({ where: { name: ROLE_NAME } });
  if (!role) {
    console.log(`role "${ROLE_NAME}" not found; nothing to do`);
    return;
  }

  const users = await prisma.user.findMany({
    where: { roleId: role.id },
    select: { id: true, username: true, branchId: true },
  });

  let cleared = 0;
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: { branchId: null, accessibleBranches: { set: [] } },
    });
    cleared += 1;
    console.log(`cleared user id=${u.id} username=${u.username}`);
  }

  console.log(`done. cleared branch assignment for ${cleared} Call Center user(s)`);
}

main()
  .catch((err) => {
    console.error("failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
