const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function main() {
  try {
    const treasuries = await prisma.treasury.findMany({
      include: { branch: true },
      orderBy: { createdAt: "asc" },
    });
    fs.writeFileSync(
      "treasuries_dump_utf8.json",
      JSON.stringify(treasuries, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
