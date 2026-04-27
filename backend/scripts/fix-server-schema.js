/**
 * fix-server-schema.js
 *
 * Idempotent script that applies schema changes that were baselined
 * (marked as applied) without actually running on the server DB.
 *
 * Safe to run multiple times — each statement checks before acting.
 */

const { PrismaClient } = require("@prisma/client");
const {
  createNotificationsTableSql,
  foreignKeyFixes,
  requiredColumnFixes,
} = require("./schema-fix-definitions");

const prisma = new PrismaClient();

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    table,
    column
  );
  return Number(rows[0]?.count || 0) > 0;
}

function isIgnorableDdlError(error) {
  const message = error?.message || "";
  const metaCode = error?.meta?.code || "";

  return [
    "already exists",
    "Duplicate key name",
    "Duplicate column name",
    "Can't DROP",
    "check that column/key exists",
    "1826",
    "1060",
    "1061",
    "1091",
    "ER_DUP_KEYNAME",
    "ER_DUP_FIELDNAME",
    "ER_CANT_DROP_FIELD_OR_KEY",
  ].some((needle) => message.includes(needle) || metaCode === needle);
}

async function executeIgnoringDuplicate(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    if (!isIgnorableDdlError(error)) throw error;
  }
}

async function applyColumnFix(fix) {
  if (await columnExists(fix.table, fix.column)) return;

  if (fix.renameFrom && (await columnExists(fix.table, fix.renameFrom))) {
    for (const sql of fix.beforeRenameSqls || []) {
      await executeIgnoringDuplicate(sql);
    }
    await prisma.$executeRawUnsafe(fix.renameSql);
    return;
  }

  await prisma.$executeRawUnsafe(fix.addSql);
}

async function backfillTreasuryScope() {
  if (!(await columnExists("treasuries", "scope"))) return;

  if (await columnExists("system_configuration", "main_treasury_id")) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`treasuries\` t
        INNER JOIN \`system_configuration\` sc ON sc.\`main_treasury_id\` = t.\`id\`
      SET t.\`scope\` = 'MAIN'
    `);
  }

  if (await columnExists("system_configuration", "visa_treasury_id")) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`treasuries\` t
        INNER JOIN \`system_configuration\` sc ON sc.\`visa_treasury_id\` = t.\`id\`
      SET t.\`scope\` = 'GLOBAL_VISA'
    `);
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO \`treasuries\` (\`name\`, \`balance\`, \`scope\`, \`is_active\`, \`created_at\`, \`updated_at\`)
    SELECT 'Instapay Treasury', 0, 'GLOBAL_INSTAPAY', 1, NOW(3), NOW(3)
    WHERE NOT EXISTS (
      SELECT 1 FROM \`treasuries\`
      WHERE \`scope\` = 'GLOBAL_INSTAPAY' AND \`is_active\` = 1
    )
  `);

  if (await columnExists("system_configuration", "instapay_treasury_id")) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`system_configuration\` sc
        INNER JOIN \`treasuries\` t ON t.\`scope\` = 'GLOBAL_INSTAPAY' AND t.\`is_active\` = 1
      SET sc.\`instapay_treasury_id\` = t.\`id\`
      WHERE sc.\`instapay_treasury_id\` IS NULL
    `);
  }
}

async function backfillPaidAt() {
  if (!(await columnExists("sales", "paid_at"))) return;

  const hasDeliveryStatus = await columnExists("sales", "delivery_status");
  if (hasDeliveryStatus) {
    await prisma.$executeRawUnsafe(`
      UPDATE \`sales\`
      SET \`paid_at\` = \`created_at\`
      WHERE \`paid_at\` IS NULL
        AND (\`delivery_status\` IS NULL OR \`delivery_status\` = 'DELIVERED')
    `);
    return;
  }

  await prisma.$executeRawUnsafe(`
    UPDATE \`sales\`
    SET \`paid_at\` = \`created_at\`
    WHERE \`paid_at\` IS NULL
  `);
}

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

  // 5. Repair baselined call-center notification migration drift.
  await prisma.$executeRawUnsafe(createNotificationsTableSql);
  console.log(">>> [FIX] notifications table: OK");

  // 6. Repair baselined treasury scope / digital treasury migration drift.
  for (const fix of requiredColumnFixes) {
    await applyColumnFix(fix);
  }
  await backfillTreasuryScope();
  await backfillPaidAt();
  console.log(">>> [FIX] treasury scope + digital treasury columns: OK");

  // 7. Add foreign keys that may be absent if tables/columns were repaired here.
  for (const fk of foreignKeyFixes) {
    await executeIgnoringDuplicate(fk);
  }
  console.log(">>> [FIX] notification/treasury foreign keys: OK");

  console.log(">>> [FIX] All schema fixes applied successfully.");
}

run()
  .catch((err) => {
    console.error(">>> [FIX] Schema fix failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
