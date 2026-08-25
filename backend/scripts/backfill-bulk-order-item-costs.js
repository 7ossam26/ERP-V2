#!/usr/bin/env node
// scripts/backfill-bulk-order-item-costs.js
//
// Fills BulkOrderItem.costPrice for lines written before the column existed.
//
// The migration (20260826000000_add_bulk_order_item_cost_price) already does a
// flat `SET cost_price = items.cost_price`. This script exists for the lines
// that leaves at zero: a manufactured item whose Item.costPrice has never been
// stamped by a production run still costs something, and its recipe says how
// much. SQL can't express that fallback, so it runs here through the same
// resolveSaleLineUnitCost used by retail sales and by order creation.
//
// Run: node backend/scripts/backfill-bulk-order-item-costs.js [--fix]
//
// --fix   : write the resolved costs (default: audit-only, prints what it would do)

const prisma = require("../config/database");
const { resolveSaleLineUnitCost } = require("../lib/costing");

const FIX_MODE = process.argv.includes("--fix");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function run() {
  console.log(
    `[backfill-bulk-costs] starting — mode: ${FIX_MODE ? "FIX" : "AUDIT-ONLY"}`,
  );

  const lines = await prisma.bulkOrderItem.findMany({
    where: { costPrice: 0 },
    select: {
      id: true,
      itemId: true,
      quantity: true,
      order: { select: { id: true, orderNumber: true, status: true } },
    },
  });

  if (lines.length === 0) {
    console.log("[backfill-bulk-costs] nothing to do — every line already costed.");
    return;
  }

  console.log(`[backfill-bulk-costs] ${lines.length} uncosted line(s) found.`);

  // Item costs repeat heavily across orders; resolve each item once.
  const costByItem = new Map();
  let resolved = 0;
  let stillZero = 0;

  for (const line of lines) {
    if (!costByItem.has(line.itemId)) {
      costByItem.set(
        line.itemId,
        round2(await resolveSaleLineUnitCost(prisma, { itemId: line.itemId, bomId: null })),
      );
    }
    const cost = costByItem.get(line.itemId);

    if (cost <= 0) {
      stillZero++;
      console.warn(
        `[backfill-bulk-costs] item ${line.itemId} (order ${line.order?.orderNumber || line.order?.id}) ` +
          `has no cost and no recipe — leaving at 0, its wholesale margin will read as 100%.`,
      );
      continue;
    }

    resolved++;
    if (FIX_MODE) {
      await prisma.bulkOrderItem.update({
        where: { id: line.id },
        data: { costPrice: cost },
      });
    } else {
      console.log(
        `[backfill-bulk-costs] would set line ${line.id} (item ${line.itemId}) -> ${cost}`,
      );
    }
  }

  console.log(
    `[backfill-bulk-costs] done — ${resolved} line(s) ${FIX_MODE ? "updated" : "would be updated"}, ` +
      `${stillZero} left uncosted.`,
  );
  if (!FIX_MODE && resolved > 0) {
    console.log("[backfill-bulk-costs] re-run with --fix to write these.");
  }
}

run()
  .catch((err) => {
    console.error("[backfill-bulk-costs] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
