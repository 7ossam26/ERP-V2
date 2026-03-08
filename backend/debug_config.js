const prisma = require('./config/database');

async function checkSystemConfig() {
    try {
        const config = await prisma.systemConfiguration.findUnique({
            where: { id: 1 },
            include: { mainWarehouse: true }
        });
        console.log("System Configuration:", JSON.stringify(config, null, 2));

        const warehouses = await prisma.warehouse.findMany();
        console.log("Warehouses:", JSON.stringify(warehouses, null, 2));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSystemConfig();
