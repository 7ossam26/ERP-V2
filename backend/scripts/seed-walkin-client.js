const prisma = require("../config/database");

async function main() {
  console.log("🌱 [DEBUG] Starting walk-in client seeding...");

  try {
    // We want to ENSURE ID 1 is "عميل نقدي"
    // Prisma doesn't easily allow setting the ID in upsert if it's autoincrement in some DBs,
    // but typically it works if it doesn't exist yet.

    const walkinClient = await prisma.client.findUnique({
      where: { id: 1 },
    });

    if (walkinClient) {
      console.log(
        `ℹ️ [DEBUG] Client with ID 1 already exists: ${walkinClient.name}`,
      );
      if (walkinClient.name !== "عميل نقدي") {
        console.log(
          `⚠️ [DEBUG] Updating name of client ID 1 to "عميل نقدي"...`,
        );
        await prisma.client.update({
          where: { id: 1 },
          data: { name: "عميل نقدي" },
        });
        console.log("✅ [DEBUG] Updated successfully.");
      }
    } else {
      console.log(`🆕 [DEBUG] Creating "عميل نقدي" with ID 1...`);
      // Warning: Manual ID insertion might fail depending on DB settings,
      // but Prisma usually handles it for MySQL if it's the first record or ID is explicitly provided.
      await prisma.client.create({
        data: {
          id: 1,
          name: "عميل نقدي",
          phoneNumber: "0000000000",
          address: null,
        },
      });
      console.log("✅ [DEBUG] Created successfully.");
    }
  } catch (error) {
    console.error("❌ [DEBUG] Error in walk-in client seed:", error);
    process.exit(1);
  }

  console.log("✨ Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ [DEBUG] Top-level error catch:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
