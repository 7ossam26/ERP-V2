/**
 * remove_all_branches_logic.js
 *
 * Removes the legacy "All Branches" virtual branch (plus its paired warehouse
 * and treasury) from a database that predates commit f5def62 "remove allbranch v1".
 *
 * Background: before 2026-02-04 the seeder created a virtual Branch (id 1,
 * name "All Branches", address "Virtual Branch", isAllBranches: true) together
 * with "All Branches Warehouse" and "All Branches Treasury". The column
 * `branches.is_all_branches` was dropped by migration
 * 20260204113521_refactor_branch_access and the seeder was deleted, but the
 * ROWS survive in any database created before that date. The current
 * prisma/seed.js matches infrastructure by name, so it seeds alongside them
 * instead of replacing them.
 *
 * The virtual branch is not just cosmetic: it shows up in every branch
 * dropdown (routes/branches.js returns all isActive branches), users get
 * assigned to it, shifts get opened on it, and purchases get booked against
 * its treasury.
 *
 * This script is idempotent and safe to re-run. It refuses to destroy real
 * business data: if the branch still carries sales, orders, employees or
 * delivery men, it deactivates the rows instead of deleting them.
 *
 * Usage:
 *   node scripts/remove_all_branches_logic.js
 *   node scripts/remove_all_branches_logic.js --dry-run
 */

const path = require("path");
const fs = require("fs");

for (const f of [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../../.env.local"),
]) {
  if (fs.existsSync(f)) require("dotenv").config({ path: f, override: true });
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const LEGACY_BRANCH_MATCH = "All Branch"; // matches "All Branches"
const log = (msg) => console.log(`${DRY_RUN ? "[dry-run] " : ""}${msg}`);

/**
 * Rows that block a branch delete via a RESTRICT foreign key and that this
 * script will NOT touch, because their presence means the branch carries real
 * business data.
 */
async function blockingBranchData(tx, branchId) {
  const [sales, orders, employees, deliveryMen] = await Promise.all([
    tx.sale.count({ where: { branchId } }),
    tx.order.count({ where: { branchId } }),
    tx.employee.count({ where: { branchId } }),
    tx.deliveryMan.count({ where: { branchId } }),
  ]);
  const blockers = [];
  if (sales) blockers.push(`${sales} sale(s)`);
  if (orders) blockers.push(`${orders} order(s)`);
  if (employees) blockers.push(`${employees} employee(s)`);
  if (deliveryMen) blockers.push(`${deliveryMen} delivery man/men`);
  return blockers;
}

/** Detach users whose home branch is the virtual branch. branch_id is nullable
 *  since migration 20260204113521, and the UserManagement UI already offers
 *  "No specific branch (global)" for global roles. */
async function detachUsers(tx, branchId) {
  const users = await tx.user.findMany({
    where: { branchId },
    select: { id: true, username: true },
  });
  if (!users.length) return;
  log(`   • detaching ${users.length} user(s): ${users.map((u) => u.username).join(", ")}`);
  if (!DRY_RUN) {
    await tx.user.updateMany({ where: { branchId }, data: { branchId: null } });
  }
}

/** Delete shifts opened on the virtual branch that carry no sales.
 *  shifts.branch_id is RESTRICT, so a leftover shift blocks the branch delete.
 *  expenses.shift_id is SET NULL, so expenses never block. */
async function removeEmptyShifts(tx, branchId) {
  const shifts = await tx.shift.findMany({
    where: { branchId },
    select: { id: true, status: true, _count: { select: { sales: true } } },
  });
  if (!shifts.length) return;

  const withSales = shifts.filter((s) => s._count.sales > 0);
  if (withSales.length) {
    throw new Error(
      `shift(s) ${withSales.map((s) => s.id).join(", ")} on the virtual branch have sales attached`
    );
  }
  log(
    `   • deleting ${shifts.length} empty shift(s): ${shifts
      .map((s) => `#${s.id} (${s.status})`)
      .join(", ")}`
  );
  if (!DRY_RUN) {
    await tx.shift.deleteMany({ where: { branchId } });
  }
}

/** Re-point purchases booked against the virtual treasury onto the treasury of
 *  the branch that actually owns the purchase's warehouse. purchases.treasury_id
 *  is RESTRICT, so these block the treasury delete. Only safe while nothing has
 *  been paid — a paid purchase has already moved a treasury balance. */
async function repointPurchases(tx, treasuryId) {
  const purchases = await tx.purchase.findMany({
    where: { treasuryId },
    select: { id: true, warehouseId: true, paidAmount: true },
  });
  if (!purchases.length) return;

  for (const purchase of purchases) {
    if (Number(purchase.paidAmount) !== 0) {
      throw new Error(
        `purchase #${purchase.id} on the virtual treasury has paidAmount=${purchase.paidAmount}; ` +
          `re-pointing it would misstate a treasury balance`
      );
    }
    const owningBranch = await tx.branch.findFirst({
      where: { warehouseId: purchase.warehouseId },
      select: { id: true, name: true, treasuryId: true },
    });
    if (!owningBranch) {
      throw new Error(
        `purchase #${purchase.id} uses warehouse #${purchase.warehouseId}, which belongs to no branch`
      );
    }
    log(
      `   • re-pointing purchase #${purchase.id} → treasury #${owningBranch.treasuryId} (${owningBranch.name})`
    );
    if (!DRY_RUN) {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { treasuryId: owningBranch.treasuryId },
      });
    }
  }
}

/** Delete a row, falling back to isActive:false when a foreign key still holds
 *  it. Deactivated rows drop out of every `isActive: true` listing. */
async function deleteOrDeactivate(tx, model, id, label) {
  if (DRY_RUN) {
    log(`   • would delete ${label} #${id}`);
    return;
  }
  try {
    await tx[model].delete({ where: { id } });
    log(`   ✅ deleted ${label} #${id}`);
  } catch (e) {
    log(`   ⚠️  could not delete ${label} #${id} (${e.code || "FK"}) — deactivating instead`);
    await tx[model].update({ where: { id }, data: { isActive: false } });
  }
}

async function main() {
  log("🚀 Removing legacy 'All Branches' rows…\n");

  await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({
      where: { name: { contains: LEGACY_BRANCH_MATCH } },
      select: { id: true, name: true, warehouseId: true, treasuryId: true },
    });

    // Resolve the paired warehouse/treasury from the branch when possible
    // (exact), otherwise by name (the branch may already be gone).
    let warehouse = branch
      ? await tx.warehouse.findUnique({ where: { id: branch.warehouseId } })
      : await tx.warehouse.findFirst({ where: { name: { contains: "All Branches" } } });
    let treasury = branch
      ? await tx.treasury.findUnique({ where: { id: branch.treasuryId } })
      : await tx.treasury.findFirst({ where: { name: { contains: "All Branch" } } });

    if (!branch && !warehouse && !treasury) {
      log("✨ Nothing to do — no legacy 'All Branches' rows in this database.");
      return;
    }

    if (branch) {
      log(`Found branch #${branch.id} "${branch.name}"`);

      const blockers = await blockingBranchData(tx, branch.id);
      if (blockers.length) {
        log(`   ⚠️  carries real data (${blockers.join(", ")}) — deactivating, not deleting`);
        if (!DRY_RUN) {
          await tx.branch.update({
            where: { id: branch.id },
            data: { isActive: false, name: `DELETED - ${branch.name}` },
          });
        }
      } else {
        await detachUsers(tx, branch.id);
        await removeEmptyShifts(tx, branch.id);
        await deleteOrDeactivate(tx, "branch", branch.id, "branch");
      }
    } else {
      log("Branch: already removed.");
    }

    if (treasury) {
      log(`Found treasury #${treasury.id} "${treasury.name}"`);
      await repointPurchases(tx, treasury.id);
      await deleteOrDeactivate(tx, "treasury", treasury.id, "treasury");
    } else {
      log("Treasury: already removed.");
    }

    if (warehouse) {
      log(`Found warehouse #${warehouse.id} "${warehouse.name}"`);
      await deleteOrDeactivate(tx, "warehouse", warehouse.id, "warehouse");
    } else {
      log("Warehouse: already removed.");
    }
  });

  log("\n🏁 Cleanup complete.");
}

main()
  .catch((error) => {
    console.error("\n❌ Cleanup aborted — nothing was changed.");
    console.error(`   ${error.message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
