/**
 * baseline-migrations.js
 *
 * One-time script to fix Prisma migration history when the database was
 * previously managed with `prisma db push` instead of `prisma migrate deploy`.
 *
 * What it does:
 *  1. Reads all migration folders from prisma/migrations/
 *  2. For each migration, marks it as "applied" in _prisma_migrations
 *     (skips any that are already correctly recorded)
 *  3. Clears any failed/broken migration records first
 *
 * After running this once, `prisma migrate deploy` will work correctly
 * and only apply genuinely new migrations going forward.
 *
 * Usage:
 *   node scripts/baseline-migrations.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MIGRATIONS_DIR = path.join(__dirname, "../prisma/migrations");

async function main() {
  console.log("=== Prisma Migration Baseline ===\n");

  // 1. Get all migration folder names (sorted, excluding lock file)
  const allMigrations = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (name) =>
        name !== "migration_lock.toml" &&
        fs.statSync(path.join(MIGRATIONS_DIR, name)).isDirectory()
    )
    .sort();

  console.log(`Found ${allMigrations.length} migrations in prisma/migrations/\n`);

  // 2. Get current state of _prisma_migrations table
  let existing = [];
  try {
    existing = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY started_at
    `;
  } catch (err) {
    console.log("Could not read _prisma_migrations — may not exist yet. Continuing...\n");
  }

  const appliedNames = new Set(
    existing
      .filter((r) => r.finished_at !== null && r.applied_steps_count > 0)
      .map((r) => r.migration_name)
  );

  const failedNames = existing
    .filter((r) => r.finished_at === null || r.applied_steps_count === 0)
    .map((r) => r.migration_name);

  console.log(`Already correctly applied: ${appliedNames.size}`);
  console.log(`Broken/failed records:     ${failedNames.length}`);
  console.log(`Will be baselined:         ${allMigrations.filter((m) => !appliedNames.has(m)).length}`);
  console.log();

  // 3. Remove broken records so prisma can re-process them
  if (failedNames.length > 0) {
    console.log("Removing broken migration records:");
    for (const name of failedNames) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM _prisma_migrations WHERE migration_name = ?`,
        name
      );
      console.log(`  ✗ removed: ${name}`);
    }
    console.log();
  }

  // 4. Mark each migration as applied using prisma migrate resolve
  const toBaseline = allMigrations.filter((m) => !appliedNames.has(m));

  if (toBaseline.length === 0) {
    console.log("✅ All migrations are already correctly recorded. Nothing to do.\n");
    return;
  }

  console.log("Baselining migrations:");
  for (const migration of toBaseline) {
    try {
      execSync(`npx prisma migrate resolve --applied "${migration}"`, {
        cwd: path.join(__dirname, ".."),
        stdio: "pipe",
      });
      console.log(`  ✔ applied: ${migration}`);
    } catch (err) {
      const stderr = err.stderr?.toString() || err.message;
      // P3008 = already recorded as applied — that's the desired state
      if (stderr.includes("already recorded as applied") || stderr.includes("P3008")) {
        console.log(`  ~ already ok: ${migration}`);
      } else {
        console.error(`  ✗ FAILED:  ${migration}`);
        console.error(`    ${stderr.trim()}`);
      }
    }
  }

  console.log("\n✅ Baseline complete.");
  console.log('   You can now safely run: npx prisma migrate deploy\n');
}

main()
  .catch((err) => {
    console.error("Baseline failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
