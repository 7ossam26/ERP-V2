const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const config = await prisma.systemConfiguration.findFirst({
      include: {
        bankTreasury: true,
      },
    });
    console.log("System Configuration:", JSON.stringify(config, null, 2));

    if (config && config.bankTreasury) {
      console.log(
        `Money currently goes to Treasury: ${config.bankTreasury.name} (ID: ${config.bankTreasury.id})`
      );
    } else {
      console.log("No Bank Treasury configured! Money disappears.");
    }

    const treasuries = await prisma.treasury.findMany();
    // console.log("Available Treasuries:", JSON.stringify(treasuries, null, 2));
    console.log("Available Treasuries List:");
    treasuries.forEach((t) =>
      console.log(`ID: ${t.id}, Name: ${t.name}, Balance: ${t.balance}`)
    );
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
