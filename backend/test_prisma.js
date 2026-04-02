require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const config = await prisma.systemConfiguration.findFirst();
  console.log("Config from DB:", config);
}
main().catch(console.error).finally(() => prisma.$disconnect());
