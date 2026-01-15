const prisma = require("./config/database");

async function testFetchUsers() {
    try {
        console.log("Attempting to fetch users...");
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                username: true,
                isActive: true,
                hasSensitiveAccess: true,
                role: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                branch: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });
        console.log("Successfully fetched users:", users.length);
    } catch (error) {
        console.error("Error fetching users:");
        console.log(error.message); // Print message property specifically
    } finally {
        await prisma.$disconnect();
    }
}

testFetchUsers();
