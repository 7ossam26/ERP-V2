#!/usr/bin/env node
// scripts/diagnose-uncosted-items.js
//
// For every item that has no cost (Item.costPrice = 0 and no recipe to derive
// one from), report:
//   - how much revenue is riding on it, wholesale AND retail
//   - therefore how much gross profit is currently overstated
//   - what its cost could be recovered from: purchase history, opening stock
//
// Read-only. Picking a cost basis is a business call, so this proposes and does
// not write. Run: node backend/scripts/diagnose-uncosted-items.js

const prisma = require("../config/database");
const { resolveSaleLineUnitCost } = require("../lib/costing");

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const egp = (n) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function run() {
  // Any item still carrying zero cost on a wholesale or retail line.
  const [bulkLines, saleLines] = await Promise.all([
    prisma.bulkOrderItem.findMany({
      where: { costPrice: 0 },
      select: {
        itemId: true,
        quantity: true,
        lineTotal: true,
        order: { select: { orderNumber: true, status: true, createdAt: true } },
      },
    }),
    prisma.saleItem.findMany({
      where: { costPrice: 0, itemId: { not: null } },
      select: { itemId: true, quantity: true, total: true },
    }),
  ]);

  const itemIds = [
    ...new Set([
      ...bulkLines.map((l) => l.itemId),
      ...saleLines.map((l) => l.itemId),
    ]),
  ].filter((id) => id != null);

  if (itemIds.length === 0) {
    console.log("[diagnose] nothing uncosted — every line carries a cost.");
    return;
  }

  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, unit: true, price: true, costPrice: true },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  let totalBulkExposure = 0;
  let totalRetailExposure = 0;

  for (const itemId of itemIds) {
    const item = itemById.get(itemId);
    if (!item) continue;

    // What the report would resolve today (includes the recipe fallback).
    const resolved = round2(
      await resolveSaleLineUnitCost(prisma, { itemId, bomId: null }),
    );

    const myBulk = bulkLines.filter((l) => l.itemId === itemId);
    const myRetail = saleLines.filter((l) => l.itemId === itemId);
    const bulkRevenue = round2(
      myBulk.reduce((s, l) => s + Number(l.lineTotal), 0),
    );
    const retailRevenue = round2(
      myRetail.reduce((s, l) => s + Number(l.total), 0),
    );
    const bulkQty = round2(myBulk.reduce((s, l) => s + Number(l.quantity), 0));
    const retailQty = round2(
      myRetail.reduce((s, l) => s + Number(l.quantity), 0),
    );

    if (resolved > 0) {
      // Recoverable by re-running the backfill; not the problem case.
      console.log(
        `\n✔ item ${itemId} — ${item.name}: resolves to ${egp(resolved)} ` +
          `(recipe or item cost). Run backfill-bulk-order-item-costs.js --fix.`,
      );
      continue;
    }

    totalBulkExposure += bulkRevenue;
    totalRetailExposure += retailRevenue;

    console.log(`\n${"─".repeat(72)}`);
    console.log(`✖ item ${itemId} — ${item.name}  (${item.unit})`);
    console.log(`  sell price: ${egp(item.price)}   stored cost: ${egp(item.costPrice)}`);
    console.log(
      `  UNCOSTED — these lines report 100% margin, overstating gross profit.`,
    );

    if (myBulk.length) {
      const orders = myBulk.map((l) => l.order?.orderNumber || "?").join(", ");
      console.log(
        `  wholesale: ${myBulk.length} line(s), qty ${bulkQty}, ` +
          `revenue ${egp(bulkRevenue)}  [${orders}]`,
      );
    }
    if (myRetail.length) {
      console.log(
        `  retail:    ${myRetail.length} line(s), qty ${retailQty}, ` +
          `revenue ${egp(retailRevenue)}`,
      );
    }

    // ── where a cost could come from ────────────────────────────────────
    const [purchases, opening, asBomOutput, usedInBoms] = await Promise.all([
      prisma.purchaseItem.findMany({
        where: { itemId },
        select: {
          quantity: true,
          purchasePrice: true,
          purchase: { select: { createdAt: true, supplierInvoiceNo: true } },
        },
      }),
      prisma.initialInventory.findMany({
        where: { itemId, unitCost: { not: null } },
        select: { quantity: true, unitCost: true, date: true },
      }),
      prisma.bOM.findFirst({
        where: { outputItemId: itemId },
        select: { id: true, name: true, isActive: true },
      }),
      prisma.bOMItem.count({ where: { itemId } }),
    ]);

    console.log("  recoverable cost sources:");

    if (purchases.length) {
      const sorted = [...purchases].sort(
        (a, b) => b.purchase.createdAt - a.purchase.createdAt,
      );
      const latest = sorted[0];
      const totalQty = purchases.reduce((s, p) => s + Number(p.quantity), 0);
      const totalVal = purchases.reduce(
        (s, p) => s + Number(p.quantity) * Number(p.purchasePrice),
        0,
      );
      const wavg = totalQty > 0 ? round2(totalVal / totalQty) : 0;
      console.log(
        `    • purchases: ${purchases.length} — latest ${egp(latest.purchasePrice)} ` +
          `on ${latest.purchase.createdAt.toISOString().slice(0, 10)}, ` +
          `weighted avg ${egp(wavg)}`,
      );
    } else {
      console.log("    • purchases: none — never bought through the system");
    }

    if (opening.length) {
      const totalQty = opening.reduce((s, o) => s + Number(o.quantity), 0);
      const totalVal = opening.reduce(
        (s, o) => s + Number(o.quantity) * Number(o.unitCost),
        0,
      );
      console.log(
        `    • opening stock: unit cost ${egp(totalQty > 0 ? totalVal / totalQty : 0)}`,
      );
    } else {
      console.log("    • opening stock: no costed entry");
    }

    if (asBomOutput) {
      console.log(
        `    • recipe: BOM #${asBomOutput.id} "${asBomOutput.name}" ` +
          `(active=${asBomOutput.isActive}) — but it resolves to 0, so its ` +
          `components are uncosted too. Fix those first.`,
      );
    } else {
      console.log(
        `    • recipe: none. ${
          usedInBoms > 0
            ? `NOTE: this item is a COMPONENT in ${usedInBoms} recipe(s) — ` +
              `leaving it at 0 also understates the cost of everything made from it.`
            : "If it is manufactured, it needs a BOM; if bought, it needs a cost."
        }`,
      );
    }
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log("EXPOSURE — gross profit currently overstated by:");
  console.log(`  wholesale: ${egp(totalBulkExposure)} ج.م`);
  console.log(`  retail:    ${egp(totalRetailExposure)} ج.م`);
  console.log(`  total:     ${egp(totalBulkExposure + totalRetailExposure)} ج.م`);
  console.log(
    "\nThis is revenue booked with zero cost against it. Set the item cost " +
      "(or its recipe), then re-run backfill-bulk-order-item-costs.js --fix.",
  );
  console.log(
    "NOTE: retail lines are NOT repaired by that script — SaleItem.costPrice " +
      "is a historical snapshot and rewriting it changes past shift reports.",
  );
}

run()
  .catch((err) => {
    console.error("[diagnose] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
