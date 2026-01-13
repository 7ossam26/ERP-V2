const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function check() {
  try {
    const role = await prisma.role.findFirst({
      where: { name: "Manager" },
      include: { permissions: true },
    });

    if (!role) {
      console.log("Role not found");
      return;
    }

    const output = {
      role: role.name,
      roleId: role.id,
      expensesPerm: role.permissions.find((p) => p.module === "EXPENSES"),
      allPerms: role.permissions,
    };

    fs.writeFileSync("perms_ds_result.json", JSON.stringify(output, null, 2));
    console.log("Successfully wrote to perms_ds_result.json");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
