const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:@127.0.0.1:3306/erp_system"
    }
  }
});

async function main() {
  const result = await prisma.$queryRaw`SHOW COLUMNS FROM users;`;
  console.log(result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
