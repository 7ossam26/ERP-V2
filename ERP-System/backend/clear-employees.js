const prisma = require("./config/database");

async function main() {
  try {
    console.log("Deleting all employees...");
    await prisma.employee.deleteMany({});
    console.log("All employees deleted.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
