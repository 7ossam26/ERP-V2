/**
 * fix-server-schema.js
 *
 * Idempotent script that applies schema changes that were baselined
 * (marked as applied) without actually running on the server DB.
 *
 * Safe to run multiple times — each statement checks before acting.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  console.log(">>> [FIX] Checking and applying missing schema changes...");

  // 1. Create purchase_returns table if missing
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`purchase_returns\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`purchase_id\` INTEGER NOT NULL,
      \`return_number\` VARCHAR(191) NOT NULL,
      \`notes\` VARCHAR(500) NULL,
      \`total_amount\` DECIMAL(10, 2) NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`purchase_returns_return_number_key\`(\`return_number\`),
      INDEX \`purchase_returns_purchase_id_fkey\`(\`purchase_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log(">>> [FIX] purchase_returns: OK");

  // 2. Create purchase_return_items table if missing
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`purchase_return_items\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`purchase_return_id\` INTEGER NOT NULL,
      \`item_id\` INTEGER NOT NULL,
      \`quantity\` DECIMAL(10, 4) NOT NULL,
      \`purchase_price\` DECIMAL(10, 2) NOT NULL,
      \`total\` DECIMAL(10, 2) NOT NULL,
      INDEX \`purchase_return_items_purchase_return_id_fkey\`(\`purchase_return_id\`),
      INDEX \`purchase_return_items_item_id_fkey\`(\`item_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log(">>> [FIX] purchase_return_items: OK");

  // 3. Add foreign keys (ignore error if they already exist)
  const fkeys = [
    `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`purchase_returns_purchase_id_fkey\`
      FOREIGN KEY (\`purchase_id\`) REFERENCES \`purchases\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE \`purchase_return_items\` ADD CONSTRAINT \`purchase_return_items_purchase_return_id_fkey\`
      FOREIGN KEY (\`purchase_return_id\`) REFERENCES \`purchase_returns\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE \`purchase_return_items\` ADD CONSTRAINT \`purchase_return_items_item_id_fkey\`
      FOREIGN KEY (\`item_id\`) REFERENCES \`items\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
  ];
  for (const fk of fkeys) {
    try {
      await prisma.$executeRawUnsafe(fk);
    } catch (e) {
      if (!e.message.includes("Duplicate key name") && !e.message.includes("already exists") && e.meta?.code !== "ER_DUP_KEYNAME") {
        // errno 1826 = duplicate FK name, errno 1061 = duplicate key — both are fine
        if (!e.message.includes("1826") && !e.message.includes("1061")) throw e;
      }
    }
  }
  console.log(">>> [FIX] foreign keys: OK");

  // 4. Add RETURNED + CANCELLED to payment_status enum
  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`purchases\`
      MODIFY COLUMN \`payment_status\`
      ENUM('PAID','PARTIALLY_PAID','UNPAID','RETURNED','CANCELLED')
      NOT NULL DEFAULT 'UNPAID'
  `);
  console.log(">>> [FIX] payment_status enum (RETURNED + CANCELLED): OK");

  console.log(">>> [FIX] All schema fixes applied successfully.");
}

run()
  .catch((err) => {
    console.error(">>> [FIX] Schema fix failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
