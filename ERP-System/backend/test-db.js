const prisma = require('./config/database');

async function main() {
    console.log("Prisma loaded");
    try {
        const users = await prisma.user.findMany();
        console.log("Users count:", users.length);
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
