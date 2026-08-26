/**
 * baseline-migrations.js
 *
 * Reconciles the `_prisma_migrations` table with the actual DB schema.
 *
 * For each migration with a defined "probe" — a query that checks whether the
 * migration's key DDL exists in the DB — this script:
 *   - Marks the migration applied if the probe passes and the row is missing.
 *   - Removes the migration row if the probe fails, so `prisma migrate deploy`
 *     re-runs it on the next pass.
 *
 * Migrations without a probe are left untouched: existing rows stay as-is, and
 * any new migration without a probe falls through to `prisma migrate deploy`
 * normally. This is the opposite of the previous behavior, which blindly
 * stamped every migration folder as applied — silently masking schema drift.
 *
 * Add a probe entry whenever a new migration is at risk of being recorded
 * applied without its SQL having actually run (e.g. when the DB was previously
 * synced via `prisma db push`).
 *
 * Usage:
 *   node scripts/baseline-migrations.js
 *   node scripts/baseline-migrations.js --dry-run
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load env before instantiating the client. In production DATABASE_URL comes
// from the host, but locally it lives in .env — and `npm start` runs this
// script before index.js, so without this the whole chain dies here.
//
// Deliberately NOT `override: true`, mirroring start.js: this script runs in
// the boot chain, so a stray .env must never be able to repoint it away from
// the database the platform handed us.
for (const f of [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(__dirname, "../.env.local"),
]) {
  if (fs.existsSync(f)) require("dotenv").config({ path: f });
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MIGRATIONS_DIR = path.join(__dirname, "../prisma/migrations");
const DRY_RUN = process.argv.includes("--dry-run");

// --- Schema introspection helpers ---------------------------------

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    name
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  );
  return Number(rows[0]?.c || 0) > 0;
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

async function enumHasValue(table, column, value) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  );
  const t = rows[0]?.COLUMN_TYPE || "";
  return t.includes(`'${value}'`);
}

async function rowExists(table, whereSql, ...params) {
  if (!(await tableExists(table))) return false;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM \`${table}\` WHERE ${whereSql}`,
    ...params
  );
  return Number(rows[0]?.c || 0) > 0;
}

// --- Probe map ----------------------------------------------------
// Each entry returns true iff the migration's key DDL/data is present in the DB.
// Only define probes for migrations at risk of being baselined-but-not-run.
// Older, definitely-applied migrations don't need entries.

const probes = {
  // Do NOT probe for sales.payment_method = 'CARD' here: the later migration
  // 20260421000000 deliberately migrates CARD rows to VISA and drops CARD from
  // the enum again. Probing for it made this entry unpassable on any
  // fully-migrated DB, so every run deleted the row and `migrate deploy`
  // re-ran a migration whose first statement drops an already-dropped FK.
  // Probe instead on what this migration added and nothing later undid:
  // the refresh_tokens drop and purchases.payment_status = 'CANCELLED'.
  "20260418071621_add_card_to_sale_payment_method": async () =>
    !(await tableExists("refresh_tokens")) &&
    (await enumHasValue("purchases", "payment_status", "CANCELLED")),

  "20260419171241_add_call_center_orders_notifications": async () =>
    (await tableExists("orders")) &&
    (await tableExists("notifications")) &&
    (await columnExists("sales", "paid_at")),

  "20260420075643_add_order_cancellation_fields": async () =>
    columnExists("orders", "cancellation_reason"),

  "20260420081752_add_sale_discount_fields": async () =>
    columnExists("sales", "discount_amount"),

  "20260420090000_add_sale_discount_reason_and_applied_by": async () =>
    (await columnExists("sales", "discount_reason")) &&
    (await columnExists("sales", "discount_applied_by_user_id")),

  "20260420120000_add_bulk_pos_phase1": async () =>
    (await tableExists("bulk_customers")) &&
    (await tableExists("bulk_orders")) &&
    (await tableExists("bulk_number_sequences")),

  "20260420183631_add_bulk_payments_refunds": async () =>
    (await tableExists("bulk_payments")) && (await tableExists("bulk_refunds")),

  "20260421000000_treasury_scope_visa_instapay_split": async () =>
    (await columnExists("treasuries", "scope")) &&
    (await columnExists("system_configuration", "instapay_treasury_id")),

  "20260421100000_shift_expected_digital_totals": async () =>
    (await columnExists("shifts", "expected_visa")) &&
    (await columnExists("shifts", "expected_instapay")),

  "20260422000000_add_proforma_sequence": async () =>
    rowExists("bulk_number_sequences", "`key` = ?", "PROFORMA"),

  "20260424000000_discount_reasons_lookup": async () =>
    (await tableExists("discount_reasons")) &&
    (await columnExists("sales", "is_voided")),

  "20260424170714_make_bulk_payment_order_optional": async () =>
    (await tableExists("bulk_payments")) &&
    (await columnIsNullable("bulk_payments", "order_id")),

  "20260626030300_add_expense_categories": async () =>
    (await tableExists("expense_categories")) &&
    (await columnExists("expenses", "category_id")),

  "20260717000000_add_opening_cost_and_cogs": async () =>
    (await columnExists("initial_inventory", "unit_cost")) &&
    (await columnExists("sale_items", "cost_price")),

  "20260724000000_add_hr_branch_treasury_shift": async () =>
    (await columnExists("employee_transactions", "branch_id")) &&
    (await columnExists("employee_transactions", "shift_id")) &&
    (await columnExists("payrolls", "treasury_id")) &&
    (await columnExists("payrolls", "shift_id")),

  // Widened to DECIMAL(18,6) by fix-server-schema.js step 10. Probe passes once
  // all three quantity columns have >= 18 digits of precision, so deploy won't
  // redundantly rewrite the tables.
  "20260729000000_widen_quantity_decimal_precision": async () => {
    for (const [table, column] of [
      ["inventory", "quantity"],
      ["initial_inventory", "quantity"],
      ["production_order_items", "quantity_used"],
    ]) {
      const precision = await columnNumericPrecision(table, column);
      if (precision === null || precision < 18) return false;
    }
    return true;
  },

  "20260731000000_shift_treasury_postings": async () =>
    (await columnExists("deposits", "source")) &&
    (await columnExists("deposits", "shift_id")) &&
    (await columnExists("withdrawals", "source")) &&
    (await columnExists("withdrawals", "shift_id")) &&
    (await columnExists("shifts", "treasury_variance")) &&
    (await columnExists("shifts", "closing_treasury_balance")),

  "20260801000000_shift_reopen_cycles": async () =>
    (await columnExists("shifts", "reopen_count")) &&
    (await columnExists("deposits", "cycle")) &&
    (await columnExists("withdrawals", "cycle")),

  // All four conditions are ANDed on purpose: a partially applied state must
  // FAIL the probe so the whole migration re-runs, rather than passing on the
  // enum alone and leaving payrolls without its snapshot columns.
  "20260827000000_add_overtime_bonus_transaction_types": async () =>
    (await enumHasValue("employee_transactions", "type", "OVERTIME")) &&
    (await enumHasValue("employee_transactions", "type", "BONUS")) &&
    (await columnExists("payrolls", "overtime")) &&
    (await columnExists("payrolls", "bonuses")),
};

// --- Main ---------------------------------------------------------

function listMigrationFolders() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (n) =>
        n !== "migration_lock.toml" &&
        fs.statSync(path.join(MIGRATIONS_DIR, n)).isDirectory()
    )
    .sort();
}

async function readPrismaMigrationsTable() {
  try {
    return await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY started_at
    `;
  } catch {
    return [];
  }
}

async function deleteRow(name) {
  if (DRY_RUN) return;
  await prisma.$executeRawUnsafe(
    `DELETE FROM _prisma_migrations WHERE migration_name = ?`,
    name
  );
}

function resolveAsApplied(name) {
  if (DRY_RUN) return;
  try {
    execSync(`npx prisma migrate resolve --applied "${name}"`, {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
    });
  } catch (e) {
    const stderr = e.stderr?.toString() || e.message;
    if (
      stderr.includes("already recorded as applied") ||
      stderr.includes("P3008")
    ) {
      return;
    }
    throw new Error(`Failed to resolve ${name} as applied: ${stderr.trim()}`);
  }
}

async function main() {
  console.log(
    `=== Prisma Baseline (probe-based${DRY_RUN ? ", DRY RUN" : ""}) ===\n`
  );

  const folders = listMigrationFolders();
  const rows = await readPrismaMigrationsTable();

  // A row counts as "applied" iff finished_at is set. applied_steps_count can
  // be 0 / NULL when the row was inserted via `migrate resolve --applied`, so
  // we don't filter on it — that's what hid 56 rows from view last run.
  const recordedApplied = new Set(
    rows.filter((r) => r.finished_at !== null).map((r) => r.migration_name)
  );
  const recordedBroken = rows
    .filter((r) => r.finished_at === null)
    .map((r) => r.migration_name);

  console.log(`Migrations on disk:        ${folders.length}`);
  console.log(`Rows in _prisma_migrations:${rows.length}`);
  console.log(`  applied (finished_at set): ${recordedApplied.size}`);
  console.log(`  broken (finished_at NULL): ${recordedBroken.length}`);
  console.log(`Probes defined:            ${Object.keys(probes).length}\n`);

  // 1. Clear broken records so prisma can retry them.
  for (const name of recordedBroken) {
    console.log(`  ✗ removing broken record: ${name}`);
    await deleteRow(name);
  }
  if (recordedBroken.length) console.log();

  // 2. Run probes and reconcile.
  const toMarkApplied = [];
  const toRemove = [];
  const noProbeMissing = [];
  const probePassedRecorded = [];

  for (const m of folders) {
    const probe = probes[m];
    if (probe) {
      const present = await probe();
      const recorded = recordedApplied.has(m);
      if (present && !recorded) toMarkApplied.push(m);
      else if (!present) toRemove.push(m); // unconditional: row may exist even if filter missed it
      else probePassedRecorded.push(m);
    } else if (!recordedApplied.has(m)) {
      noProbeMissing.push(m);
    }
  }

  if (toRemove.length) {
    console.log(
      "Probe FAILED — deleting any _prisma_migrations row so `migrate deploy` re-runs:"
    );
    for (const m of toRemove) {
      console.log(`  ✗ ${m}`);
      await deleteRow(m);
    }
    console.log();
  }

  if (toMarkApplied.length) {
    console.log("Probe PASSED — marking applied (was not recorded):");
    for (const m of toMarkApplied) {
      console.log(`  ✓ ${m}`);
      resolveAsApplied(m);
    }
    console.log();
  }

  if (probePassedRecorded.length) {
    console.log(
      `Probe PASSED + already recorded (no-op): ${probePassedRecorded.length} migration(s)`
    );
  }

  if (noProbeMissing.length) {
    console.log(
      "\nMigrations without a probe and not recorded as applied —"
    );
    console.log("  these will be applied by `prisma migrate deploy`:");
    for (const m of noProbeMissing) console.log(`  · ${m}`);
  }

  console.log("\n✅ Baseline complete.");
  console.log("   Next: `npx prisma migrate deploy`\n");
}

main()
  .catch((e) => {
    console.error("Baseline failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
