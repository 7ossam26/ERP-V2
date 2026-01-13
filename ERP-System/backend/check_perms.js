const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  try {
    const role = await prisma.role.findFirst({
      where: { name: "Manager" },
      include: { permissions: true },
    });
    console.log("Role:", role ? role.name : "Not Found");
    if (role) {
      const expensesPerm = role.permissions.find(
        (p) => p.module === "EXPENSES"
      );
      console.log("EXPENSES Permission:", expensesPerm);
      console.log(
        "All Permissions:",
        role.permissions.map((p) => `${p.module}: ${p.canAccess}`)
      );
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
