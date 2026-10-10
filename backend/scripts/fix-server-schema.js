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
const { buildModuleEnumSql } = require("../config/modules");
const {
  buildTransactionTypeEnumSql,
} = require("../config/employeeTransactionTypes");
const { buildWriteOffReasonEnumSql } = require("../config/writeOffReasons");

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

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    table
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnIsNullable(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  );
  return rows[0]?.IS_NULLABLE === "YES";
}

async function columnNumericPrecision(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT NUMERIC_PRECISION FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  );
  const precision = rows[0]?.NUMERIC_PRECISION;
  return precision == null ? null : Number(precision);
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
    "doesn't exist",
    "Unknown table",
    "1826",
    "1060",
    "1061",
    "1091",
    "1146",
    "121",
    "Duplicate key",
    "ER_DUP_KEYNAME",
    "ER_DUP_FIELDNAME",
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_NO_SUCH_TABLE",
    "ER_BAD_TABLE_ERROR",
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

// Patches for migrations 20260418071621 → 20260424170714 that were baselined
// (marked applied) without their SQL having actually run. Each block is
// idempotent so it's safe to re-run on every boot. Once these all complete,
// the probes in baseline-migrations.js will pass and the migrations will be
// recorded applied without `migrate deploy` ever needing to run their
// non-idempotent SQL.
async function applyLegacyMigrationFixes() {
  // --- 20260418071621_add_card_to_sale_payment_method ---
  await executeIgnoringDuplicate(
    "ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `refresh_tokens_user_id_fkey`"
  );
  await executeIgnoringDuplicate("DROP TABLE IF EXISTS `refresh_tokens`");
  await executeIgnoringDuplicate(
    "ALTER TABLE `audit_logs` DROP INDEX `audit_logs_target_entity_target_id_idx`"
  );
  await executeIgnoringDuplicate(
    "ALTER TABLE `bom` MODIFY `output_quantity` DECIMAL(10, 4) NOT NULL DEFAULT 1"
  );
  await executeIgnoringDuplicate(`
    ALTER TABLE \`sales\` MODIFY \`payment_method\`
    ENUM('CASH','INSTAPAY','VISA','CARD') NOT NULL DEFAULT 'CASH'
  `);
  await executeIgnoringDuplicate(
    "CREATE INDEX `audit_logs_target_entity_target_id_idx` ON `audit_logs`(`target_entity`, `target_id`)"
  );
  await executeIgnoringDuplicate(`
    ALTER TABLE \`production_orders\` ADD CONSTRAINT \`production_orders_dest_warehouse_id_fkey\`
      FOREIGN KEY (\`dest_warehouse_id\`) REFERENCES \`warehouses\`(\`id\`)
      ON DELETE RESTRICT ON UPDATE CASCADE
  `);

  // --- 20260419171241_add_call_center_orders_notifications ---
  // Idempotent, NON-DESTRUCTIVE enum repair. Enlarge `permissions.module` to the
  // canonical superset from config/modules.js (the single source of truth).
  // Enlarging a MySQL ENUM to a superset preserves every existing row, so this
  // is safe to run on every boot against the live DB.
  //
  // We intentionally do NOT delete rows here anymore. The old code ran
  // `DELETE FROM permissions WHERE module NOT IN (<hardcoded list>)` against a
  // STALE list that omitted WAREHOUSE_TRANSFER_MANAGEMENT — that stripped the
  // value out of the enum on every boot and caused the production 500 on
  // `PUT /superadmin/roles/:id/permissions`. Sourcing the enum from the registry
  // keeps it from ever drifting again.
  await executeIgnoringDuplicate(
    `ALTER TABLE \`permissions\` MODIFY \`module\` ${buildModuleEnumSql()} NOT NULL`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`orders\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`sale_id\` INTEGER NOT NULL,
      \`channel\` ENUM('POS','CALL_CENTER','WHATSAPP','WEB','AGGREGATOR') NOT NULL DEFAULT 'POS',
      \`status\` ENUM('NEW','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED') NOT NULL DEFAULT 'NEW',
      \`branch_id\` INTEGER NOT NULL,
      \`created_by_id\` INTEGER NOT NULL,
      \`claimed_by_id\` INTEGER NULL,
      \`claimed_at\` DATETIME(3) NULL,
      \`ready_at\` DATETIME(3) NULL,
      \`dispatched_at\` DATETIME(3) NULL,
      \`delivered_at\` DATETIME(3) NULL,
      \`cancelled_at\` DATETIME(3) NULL,
      \`cancel_reason\` TEXT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL,
      UNIQUE INDEX \`orders_sale_id_key\`(\`sale_id\`),
      INDEX \`orders_channel_status_branch_id_idx\`(\`channel\`, \`status\`, \`branch_id\`),
      INDEX \`orders_created_by_id_created_at_idx\`(\`created_by_id\`, \`created_at\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  for (const fk of [
    "ALTER TABLE `orders` ADD CONSTRAINT `orders_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
    "ALTER TABLE `orders` ADD CONSTRAINT `orders_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `orders` ADD CONSTRAINT `orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `orders` ADD CONSTRAINT `orders_claimed_by_id_fkey` FOREIGN KEY (`claimed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
  ]) {
    await executeIgnoringDuplicate(fk);
  }
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`orders\` (\`sale_id\`, \`channel\`, \`status\`, \`branch_id\`, \`created_by_id\`, \`delivered_at\`, \`created_at\`, \`updated_at\`)
    SELECT s.\`id\`, 'POS', 'DELIVERED', s.\`branch_id\`, COALESCE(s.\`user_id\`, 1), s.\`created_at\`, s.\`created_at\`, s.\`created_at\`
    FROM \`sales\` s
    WHERE NOT EXISTS (SELECT 1 FROM \`orders\` o WHERE o.\`sale_id\` = s.\`id\`)
  `);

  // --- 20260420075643_add_order_cancellation_fields ---
  if (!(await columnExists("orders", "cancellation_note"))) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`orders\`
        ADD COLUMN \`cancellation_note\` TEXT NULL,
        ADD COLUMN \`cancellation_reason\` ENUM('CUSTOMER_REQUEST','OUT_OF_STOCK','WRONG_ADDRESS','NO_ANSWER','DUPLICATE','OTHER') NULL,
        ADD COLUMN \`cancelled_by_id\` INTEGER NULL
    `);
  }
  await executeIgnoringDuplicate(
    "ALTER TABLE `orders` ADD CONSTRAINT `orders_cancelled_by_id_fkey` FOREIGN KEY (`cancelled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE"
  );

  // --- 20260420081752_add_sale_discount_fields ---
  if (!(await columnExists("sales", "discount_amount"))) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`sales\`
        ADD COLUMN \`discount_amount\` DECIMAL(10,2) NULL,
        ADD COLUMN \`discount_type\` ENUM('PERCENTAGE','VALUE') NULL,
        ADD COLUMN \`discount_value\` DECIMAL(10,2) NULL
    `);
  }

  // --- 20260420090000_add_sale_discount_reason_and_applied_by ---
  if (!(await columnExists("sales", "discount_reason"))) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`sales\`
        ADD COLUMN \`discount_reason\` VARCHAR(32) NULL,
        ADD COLUMN \`discount_applied_by_user_id\` INT NULL
    `);
  }
  await executeIgnoringDuplicate(
    "ALTER TABLE `sales` ADD CONSTRAINT `sales_discount_applied_by_user_id_fkey` FOREIGN KEY (`discount_applied_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE"
  );
  await executeIgnoringDuplicate(
    "CREATE INDEX `sales_discount_applied_by_user_id_idx` ON `sales`(`discount_applied_by_user_id`)"
  );

  // --- 20260420120000_add_bulk_pos_phase1 ---
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_customers\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`company_name\` VARCHAR(200) NOT NULL,
      \`trade_name\` VARCHAR(200) NULL,
      \`tax_number\` VARCHAR(50) NULL,
      \`primary_contact_name\` VARCHAR(120) NOT NULL,
      \`primary_contact_phone\` VARCHAR(40) NOT NULL,
      \`primary_contact_email\` VARCHAR(120) NULL,
      \`shipping_address\` TEXT NOT NULL,
      \`credit_limit\` DECIMAL(12, 2) NULL,
      \`notes\` TEXT NULL,
      \`is_active\` BOOLEAN NOT NULL DEFAULT true,
      \`created_by_user_id\` INTEGER NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL,
      UNIQUE INDEX \`bulk_customers_tax_number_key\`(\`tax_number\`),
      INDEX \`bulk_customers_company_name_idx\`(\`company_name\`),
      INDEX \`bulk_customers_primary_contact_phone_idx\`(\`primary_contact_phone\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_customer_contacts\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`customer_id\` INTEGER NOT NULL,
      \`name\` VARCHAR(120) NOT NULL,
      \`phone\` VARCHAR(40) NOT NULL,
      \`email\` VARCHAR(120) NULL,
      \`role\` VARCHAR(60) NULL,
      INDEX \`bulk_customer_contacts_customer_id_idx\`(\`customer_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_contract_prices\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`customer_id\` INTEGER NOT NULL,
      \`item_id\` INTEGER NOT NULL,
      \`price\` DECIMAL(10, 2) NOT NULL,
      \`created_by_user_id\` INTEGER NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL,
      UNIQUE INDEX \`bulk_contract_prices_customer_id_item_id_key\`(\`customer_id\`, \`item_id\`),
      INDEX \`bulk_contract_prices_item_id_idx\`(\`item_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_orders\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`order_number\` VARCHAR(191) NULL,
      \`customer_id\` INTEGER NOT NULL,
      \`warehouse_id\` INTEGER NOT NULL,
      \`created_by_user_id\` INTEGER NOT NULL,
      \`status\` ENUM('DRAFT','QUOTED','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED','RETURNED') NOT NULL DEFAULT 'DRAFT',
      \`subtotal_inclusive\` DECIMAL(12, 2) NOT NULL,
      \`tax_rate\` DECIMAL(5, 4) NOT NULL DEFAULT 0.14,
      \`net_amount\` DECIMAL(12, 2) NOT NULL,
      \`tax_amount\` DECIMAL(12, 2) NOT NULL,
      \`total\` DECIMAL(12, 2) NOT NULL,
      \`paid_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0,
      \`balance_due\` DECIMAL(12, 2) NOT NULL,
      \`scheduled_pickup_date\` DATETIME(3) NULL,
      \`confirmed_at\` DATETIME(3) NULL,
      \`paid_at\` DATETIME(3) NULL,
      \`cancelled_at\` DATETIME(3) NULL,
      \`cancelled_by_user_id\` INTEGER NULL,
      \`cancel_reason\` TEXT NULL,
      \`returned_at\` DATETIME(3) NULL,
      \`notes\` TEXT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL,
      UNIQUE INDEX \`bulk_orders_order_number_key\`(\`order_number\`),
      INDEX \`bulk_orders_customer_id_status_idx\`(\`customer_id\`, \`status\`),
      INDEX \`bulk_orders_status_created_at_idx\`(\`status\`, \`created_at\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_order_items\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`order_id\` INTEGER NOT NULL,
      \`item_id\` INTEGER NOT NULL,
      \`quantity\` DECIMAL(12, 4) NOT NULL,
      \`unit_price\` DECIMAL(10, 2) NOT NULL,
      \`line_total\` DECIMAL(12, 2) NOT NULL,
      INDEX \`bulk_order_items_order_id_idx\`(\`order_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_documents\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`order_id\` INTEGER NOT NULL,
      \`type\` ENUM('PROFORMA','TAX_INVOICE','SALES_RECEIPT','CREDIT_NOTE') NOT NULL,
      \`document_number\` VARCHAR(191) NOT NULL,
      \`issued_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`issued_by_user_id\` INTEGER NOT NULL,
      \`snapshot\` JSON NULL,
      UNIQUE INDEX \`bulk_documents_document_number_key\`(\`document_number\`),
      INDEX \`bulk_documents_order_id_type_idx\`(\`order_id\`, \`type\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_number_sequences\` (
      \`key\` VARCHAR(191) NOT NULL,
      \`next_value\` INTEGER NOT NULL DEFAULT 1,
      \`prefix\` VARCHAR(20) NOT NULL,
      \`updated_at\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`key\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  for (const fk of [
    "ALTER TABLE `bulk_customers` ADD CONSTRAINT `bulk_customers_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    "ALTER TABLE `bulk_customer_contacts` ADD CONSTRAINT `bulk_customer_contacts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
    "ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
    "ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
    "ALTER TABLE `bulk_contract_prices` ADD CONSTRAINT `bulk_contract_prices_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    "ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_orders` ADD CONSTRAINT `bulk_orders_cancelled_by_user_id_fkey` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    "ALTER TABLE `bulk_order_items` ADD CONSTRAINT `bulk_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
    "ALTER TABLE `bulk_order_items` ADD CONSTRAINT `bulk_order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_documents` ADD CONSTRAINT `bulk_documents_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
  ]) {
    await executeIgnoringDuplicate(fk);
  }
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`bulk_number_sequences\` (\`key\`, \`next_value\`, \`prefix\`, \`updated_at\`) VALUES
      ('ORDER', 1, 'BULK-', NOW(3)),
      ('SALES_RECEIPT', 1, 'BULK-RCP-', NOW(3)),
      ('TAX_INVOICE', 1, 'BULK-TAX-', NOW(3)),
      ('CREDIT_NOTE', 1, 'BULK-CN-', NOW(3))
    ON DUPLICATE KEY UPDATE \`prefix\` = VALUES(\`prefix\`)
  `);

  // --- 20260420183631_add_bulk_payments_refunds ---
  await executeIgnoringDuplicate(
    "ALTER TABLE `sales` DROP INDEX `sales_discount_reason_idx`"
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_payments\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`order_id\` INTEGER NULL,
      \`customer_id\` INTEGER NOT NULL,
      \`treasury_id\` INTEGER NULL,
      \`method\` ENUM('CASH','BANK_TRANSFER','CHEQUE','CREDIT') NOT NULL,
      \`amount\` DECIMAL(12, 2) NOT NULL,
      \`received_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`created_by_user_id\` INTEGER NOT NULL,
      \`bank_reference\` VARCHAR(120) NULL,
      \`cheque_number\` VARCHAR(60) NULL,
      \`cheque_due_date\` DATETIME(3) NULL,
      \`voided_at\` DATETIME(3) NULL,
      \`voided_by_user_id\` INTEGER NULL,
      \`void_reason\` TEXT NULL,
      \`notes\` TEXT NULL,
      INDEX \`bulk_payments_order_id_idx\`(\`order_id\`),
      INDEX \`bulk_payments_customer_id_received_at_idx\`(\`customer_id\`, \`received_at\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`bulk_refunds\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`order_id\` INTEGER NOT NULL,
      \`method\` ENUM('CASH_REFUND','CREDIT_NOTE') NOT NULL,
      \`amount\` DECIMAL(12, 2) NOT NULL,
      \`reason\` TEXT NULL,
      \`treasury_id\` INTEGER NULL,
      \`credit_note_number\` VARCHAR(191) NULL,
      \`created_by_user_id\` INTEGER NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`bulk_refunds_credit_note_number_key\`(\`credit_note_number\`),
      INDEX \`bulk_refunds_order_id_idx\`(\`order_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  for (const fk of [
    "ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `bulk_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_payments` ADD CONSTRAINT `bulk_payments_voided_by_user_id_fkey` FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    "ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `bulk_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_treasury_id_fkey` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    "ALTER TABLE `bulk_refunds` ADD CONSTRAINT `bulk_refunds_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
  ]) {
    await executeIgnoringDuplicate(fk);
  }

  // --- 20260421100000_shift_expected_digital_totals ---
  if (!(await columnExists("shifts", "expected_visa"))) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`shifts\`
        ADD COLUMN \`expected_visa\` DECIMAL(10,2) NULL,
        ADD COLUMN \`expected_instapay\` DECIMAL(10,2) NULL
    `);
  }

  // --- 20260422000000_add_proforma_sequence ---
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`bulk_number_sequences\` (\`key\`, \`prefix\`, \`next_value\`, \`updated_at\`)
    VALUES ('PROFORMA', 'BULK-PRO-', 1, NOW(3))
    ON DUPLICATE KEY UPDATE \`key\` = \`key\`
  `);

  // --- 20260424000000_discount_reasons_lookup ---
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`discount_reasons\` (
      \`code\` VARCHAR(32) NOT NULL,
      \`label_ar\` VARCHAR(128) NOT NULL,
      \`customer_label_ar\` VARCHAR(128) NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`discount_reasons\` (\`code\`, \`label_ar\`, \`customer_label_ar\`) VALUES
      ('STAFF_DISCOUNT','خصم موظف','خصم موظف'),
      ('LOYAL_CUSTOMER','عميل مميز','خصم عميل مميز'),
      ('DAMAGED_ITEM','منتج تالف','خصم منتج تالف'),
      ('MANAGER_COMP','مجاملة إدارة','خصم إداري'),
      ('PROMO','عرض ترويجي','عرض ترويجي'),
      ('OTHER','أخرى','خصم')
    ON DUPLICATE KEY UPDATE \`code\` = \`code\`
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE \`sales\` SET \`discount_reason\` = 'OTHER'
    WHERE \`discount_reason\` IS NOT NULL
      AND \`discount_reason\` NOT IN ('STAFF_DISCOUNT','LOYAL_CUSTOMER','DAMAGED_ITEM','MANAGER_COMP','PROMO','OTHER')
  `);
  if (!(await columnExists("sales", "is_voided"))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `sales` ADD COLUMN `is_voided` TINYINT(1) NOT NULL DEFAULT 0 AFTER `discount_reason`"
    );
  }
  await executeIgnoringDuplicate(
    "CREATE INDEX `idx_sales_shift_voided` ON `sales`(`shift_id`, `status`, `is_voided`)"
  );

  // --- 20260424170714_make_bulk_payment_order_optional ---
  if (
    (await tableExists("bulk_payments")) &&
    !(await columnIsNullable("bulk_payments", "order_id"))
  ) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `bulk_payments` MODIFY `order_id` INTEGER NULL"
    );
  }
  // FK rename: drop legacy name + ensure final name. Both safe.
  await executeIgnoringDuplicate(
    "ALTER TABLE `sales` DROP FOREIGN KEY `fk_sales_discount_reason`"
  );
  await executeIgnoringDuplicate(
    "ALTER TABLE `sales` ADD CONSTRAINT `sales_discount_reason_fkey` FOREIGN KEY (`discount_reason`) REFERENCES `discount_reasons`(`code`) ON DELETE SET NULL ON UPDATE CASCADE"
  );
}

async function run() {
  console.log(">>> [FIX] Checking and applying missing schema changes...");

  // These repairs patch databases that already HAVE the base schema. On a
  // fresh (or not-yet-migrated) database there is nothing to repair: the
  // unguarded ALTER TABLE `purchases` below would throw and abort startup
  // before `prisma migrate deploy` ever got the chance to create the schema,
  // and the CREATE TABLEs above it would leave stray tables that later
  // migrations then collide with. Defer to the migrations instead.
  if (!(await tableExists("purchases"))) {
    console.log(
      ">>> [FIX] `purchases` table not found — database is not migrated yet. Skipping schema repair; `prisma migrate deploy` will create the schema."
    );
    return { skipped: true };
  }

  // 1. Create purchase_returns table if missing
  if (!(await tableExists("purchase_returns"))) {
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
  } else {
    console.log(">>> [FIX] purchase_returns already exists: skipping creation");
  }

  // 2. Create purchase_return_items table if missing
  if (!(await tableExists("purchase_return_items"))) {
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
  } else {
    console.log(">>> [FIX] purchase_return_items already exists: skipping creation");
  }

  // 3. Add foreign keys (ignore error if they already exist)
  if (!(await tableExists("purchase_returns")) || !(await tableExists("purchase_return_items"))) {
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
          if (!e.message.includes("1826") && !e.message.includes("1061") && !e.message.includes("121")) throw e;
        }
      }
    }
    console.log(">>> [FIX] foreign keys: OK");
  } else {
    console.log(">>> [FIX] purchase_returns/items foreign keys already exist: skipping");
  }

  // 4. Add RETURNED + CANCELLED to payment_status enum
  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`purchases\`
      MODIFY COLUMN \`payment_status\`
      ENUM('PAID','PARTIALLY_PAID','UNPAID','RETURNED','CANCELLED')
      NOT NULL DEFAULT 'UNPAID'
  `);
  console.log(">>> [FIX] payment_status enum (RETURNED + CANCELLED): OK");

  // 5. Repair baselined call-center notification migration drift.
  if (!(await tableExists("notifications"))) {
    await prisma.$executeRawUnsafe(createNotificationsTableSql);
    console.log(">>> [FIX] notifications table: OK");
  } else {
    console.log(">>> [FIX] notifications table already exists: skipping creation");
  }

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

  // 8. Apply idempotent fixes for the 11 baselined-but-not-run migrations
  //    (20260418071621 → 20260424170714). After this, baseline-migrations.js
  //    probes pass and `migrate deploy` sees nothing pending.
  await applyLegacyMigrationFixes();
  console.log(">>> [FIX] legacy migration fixes (20260418→20260424): OK");

  // 9. Opening-inventory purchase cost + sale-line COGS snapshot columns.
  //    Additive only — guarded so it's safe to re-run on every boot.
  //    Pairs with migration 20260717000000_add_opening_cost_and_cogs and its
  //    probe in baseline-migrations.js.
  if (!(await tableExists("initial_inventory"))) {
    // Table was never created on this server — create it with all columns
    // (including unit_cost) and foreign keys in one shot.
    await prisma.$executeRawUnsafe(
      `CREATE TABLE \`initial_inventory\` (
        \`id\`           INTEGER        NOT NULL AUTO_INCREMENT,
        \`item_id\`      INTEGER        NOT NULL,
        \`warehouse_id\` INTEGER        NOT NULL,
        \`quantity\`     DECIMAL(18,6)  NOT NULL,
        \`date\`         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`notes\`        TEXT           NULL,
        \`user_id\`      INTEGER        NOT NULL,
        \`unit_cost\`    DECIMAL(10,2)  NULL,
        \`created_at\`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    // Add foreign keys (ignore if already present due to a race)
    for (const fkSql of [
      "ALTER TABLE `initial_inventory` ADD CONSTRAINT `initial_inventory_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
      "ALTER TABLE `initial_inventory` ADD CONSTRAINT `initial_inventory_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
      "ALTER TABLE `initial_inventory` ADD CONSTRAINT `initial_inventory_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE",
    ]) {
      await executeIgnoringDuplicate(fkSql);
    }
  } else if (!(await columnExists("initial_inventory", "unit_cost"))) {
    // Table exists but was created before the unit_cost column was added.
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `initial_inventory` ADD COLUMN `unit_cost` DECIMAL(10,2) NULL"
    );
  }
  if (!(await columnExists("sale_items", "cost_price"))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `sale_items` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0"
    );
  }
  console.log(">>> [FIX] opening cost + sale COGS columns: OK");

  // 10. Widen quantity columns from DECIMAL(10,6) (max 9,999.999999 — only 4
  //     integer digits) to DECIMAL(18,6). The old precision made any quantity
  //     >= 10,000 overflow, which MySQL rejected as a 500 on initial-inventory
  //     and production. Pairs with migration
  //     20260729000000_widen_quantity_decimal_precision. Guarded on the current
  //     precision so we only rewrite the table when it actually needs it.
  const quantityWidenTargets = [
    { table: "inventory", column: "quantity", type: "DECIMAL(18,6) NOT NULL DEFAULT 0" },
    { table: "initial_inventory", column: "quantity", type: "DECIMAL(18,6) NOT NULL" },
    { table: "production_order_items", column: "quantity_used", type: "DECIMAL(18,6) NOT NULL" },
  ];
  for (const { table, column, type } of quantityWidenTargets) {
    if (!(await tableExists(table))) continue;
    const precision = await columnNumericPrecision(table, column);
    if (precision !== null && precision < 18) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` MODIFY \`${column}\` ${type}`
      );
    }
  }
  console.log(">>> [FIX] widened quantity columns to DECIMAL(18,6): OK");

  // 11. Idempotent, NON-DESTRUCTIVE enum widen for employee transaction types,
  //     sourced from config/employeeTransactionTypes.js (the single source of
  //     truth). Enlarging a MySQL ENUM to a superset preserves every existing
  //     row. Pairs with migration
  //     20260827000000_add_overtime_bonus_transaction_types; the payrolls
  //     overtime/bonuses columns are handled by requiredColumnFixes above.
  await executeIgnoringDuplicate(
    `ALTER TABLE \`employee_transactions\` MODIFY \`type\` ${buildTransactionTypeEnumSql()} NOT NULL`
  );
  console.log(">>> [FIX] employee transaction type enum (اضافي/مكافئة): OK");

  // 12. Idempotent, NON-DESTRUCTIVE enum widen for stock write-off (إهلاك)
  //     reasons, sourced from config/writeOffReasons.js (the single source of
  //     truth). Enlarging a MySQL ENUM to a superset preserves every row, so
  //     adding a sixth reason later costs one append there plus this line.
  //
  //     Guarded on tableExists because this script runs BEFORE `migrate deploy`
  //     creates the table on a fresh server. Note there is deliberately no
  //     CREATE TABLE here: the table is created solely by migration
  //     20260828000100, whose baseline-migrations probe already covers both
  //     directions. A second creation path is exactly how a re-run turns into a
  //     MySQL 1050 that stops the server from booting.
  if (await tableExists("stock_writeoffs")) {
    await executeIgnoringDuplicate(
      `ALTER TABLE \`stock_writeoffs\` MODIFY \`reason\` ${buildWriteOffReasonEnumSql()} NOT NULL DEFAULT 'OTHER'`
    );
    console.log(">>> [FIX] stock write-off reason enum (إهلاك): OK");
  }

  console.log(">>> [FIX] All schema fixes applied successfully.");
  return { skipped: false };
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error(">>> [FIX] Schema fix failed:", err.message);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run, prisma };
