/**
 * stockWriteOff.service.js — إهلاك
 *
 * Stock that leaves a warehouse without being sold: consumed internally
 * (tissues, bags), damaged, expired, or lost to a physical count variance.
 *
 * WHY THIS EXISTS
 * A consumable is purchased but never sold, so no SaleItem/BulkOrderItem line
 * ever carries its cost — and routes/reports.js deliberately excludes
 * Expense.type = "PURCHASE" from operating expenses, because a purchase's cost
 * is meant to be recognised as COGS when the stock sells. For something that
 * never sells, that moment never arrives: the cost was recognised NOWHERE and
 * net profit was overstated by it forever. Recording an إهلاك is that missing
 * moment, and routes/reports.js adds its value to COGS.
 *
 * TWO INVARIANTS THIS FILE EXISTS TO PROTECT — do not "optimise" either away:
 *
 *   1. It writes NO Expense row. No cash moves when stock is destroyed, and an
 *      Expense row would land in operatingExpenses (routes/reports.js filters
 *      `type !== "PURCHASE"` — a deny-list) while being excluded from the branch
 *      page (routes/branches.js admits only `type === "MANUAL"` — an allow-list),
 *      so the two screens would silently disagree by exactly this amount. It
 *      would also invent a cashier shortage in routes/shifts.js, which sums
 *      every CASH expense on a branch treasury inside the shift window.
 *
 *   2. It NEVER writes Item.costPrice. That column is a single global last-wins
 *      value read by lib/costing.js for every future COGS snapshot; a write-off
 *      is consumption, not a purchase. Touching it would re-price every later
 *      sale and, via routes/sales.js's edit path, retroactively re-price any
 *      invoice that is subsequently edited. This is deliberately UNLIKE
 *      routes/initialInventory.js, which does overwrite it.
 */

const prisma = require("../config/database");
const { resolveSaleLineUnitCost } = require("../lib/costing");
const {
  parseDateStart,
  parseDateEnd,
  cairoTodayISO,
} = require("../utils/dateRange");
const { isValidWriteOffReason } = require("../config/writeOffReasons");
const { writeAudit } = require("../utils/auditLogger");

/** An error carrying an HTTP status + a stable machine code for the client. */
class WriteOffError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const round2 = (n) => parseFloat(Number(n).toFixed(2));
const round6 = (n) => parseFloat(Number(n).toFixed(6));

/**
 * Validates and normalises the create payload. Split out so the rules are
 * testable without a database.
 */
function normalizeCreateInput(body) {
  const itemId = parseInt(body.itemId, 10);
  const warehouseId = parseInt(body.warehouseId, 10);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new WriteOffError(400, "INVALID_ITEM", "الصنف مطلوب");
  }
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    throw new WriteOffError(400, "INVALID_WAREHOUSE", "المخزن مطلوب");
  }

  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new WriteOffError(400, "INVALID_QUANTITY", "الكمية يجب أن تكون أكبر من صفر");
  }
  // Matches Inventory.quantity's DECIMAL(18,6); the upper bound keeps a typo
  // from silently overflowing the column.
  if (quantity > 1e12) {
    throw new WriteOffError(400, "INVALID_QUANTITY", "الكمية كبيرة بشكل غير منطقي");
  }

  const reason = String(body.reason || "").trim();
  if (!isValidWriteOffReason(reason)) {
    throw new WriteOffError(400, "INVALID_REASON", "سبب الإهلاك غير صحيح");
  }

  // The business date. Defaults to today in Cairo, never the server's zone.
  const dateStr = body.date ? String(body.date).slice(0, 10) : cairoTodayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new WriteOffError(400, "INVALID_DATE", "التاريخ غير صحيح");
  }
  // A future write-off would book cost into a period that hasn't happened.
  if (dateStr > cairoTodayISO()) {
    throw new WriteOffError(400, "FUTURE_DATE", "لا يمكن تسجيل إهلاك بتاريخ مستقبلي");
  }

  // Optional. The ONLY way to write off an item whose cost was never stamped;
  // recorded on the row and audit-logged, but still never written to the item.
  let unitCostOverride = null;
  if (body.unitCost !== undefined && body.unitCost !== null && body.unitCost !== "") {
    const n = Number(body.unitCost);
    if (!Number.isFinite(n) || n <= 0) {
      throw new WriteOffError(400, "INVALID_UNIT_COST", "تكلفة الوحدة يجب أن تكون أكبر من صفر");
    }
    unitCostOverride = n;
  }

  const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;

  return {
    itemId,
    warehouseId,
    quantity: round6(quantity),
    reason,
    dateStr,
    unitCostOverride,
    notes,
  };
}

/**
 * Record an إهلاك: decrement stock and snapshot the cost that routes/reports.js
 * will book as COGS.
 */
async function createWriteOff(body, { userId, branchId = null, ipAddress = null }) {
  const input = normalizeCreateInput(body);

  const row = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true, name: true },
    });
    if (!item) throw new WriteOffError(404, "ITEM_NOT_FOUND", "الصنف غير موجود");

    const warehouse = await tx.warehouse.findUnique({
      where: { id: input.warehouseId },
      select: { id: true, isActive: true },
    });
    if (!warehouse) {
      throw new WriteOffError(404, "WAREHOUSE_NOT_FOUND", "المخزن غير موجود");
    }
    if (warehouse.isActive === false) {
      throw new WriteOffError(400, "WAREHOUSE_INACTIVE", "هذا المخزن غير مفعّل");
    }

    // 1. Cost snapshot, resolved INSIDE the transaction — same discipline as
    //    controllers/callCenter.controller.js. A purchase committing in parallel
    //    restamps Item.costPrice, and a snapshot read outside the transaction
    //    could book a cost that never applied to this stock.
    const resolved =
      input.unitCostOverride !== null
        ? input.unitCostOverride
        : await resolveSaleLineUnitCost(tx, { itemId: input.itemId, bomId: null });

    // A zero cost is not a harmless edge case: it would decrement the stock and
    // add exactly nothing to COGS, silently re-creating the very hole this
    // feature exists to close. Refuse, and let the caller supply an explicit
    // unit cost instead. (scripts/diagnose-uncosted-items.js finds these in bulk.)
    if (!Number.isFinite(resolved) || resolved <= 0) {
      throw new WriteOffError(
        400,
        "ZERO_COST",
        "لا توجد تكلفة مسجلة لهذا الصنف — أدخل تكلفة الوحدة يدويًا أو حدّث تكلفة الصنف أولاً",
      );
    }
    const unitCost = round2(resolved);

    // 2. Guarded decrement. The `gte` predicate makes the read-and-write atomic,
    //    so stock can never go negative and two concurrent write-offs cannot
    //    both succeed — the shape used by lib/productionService.js.
    //
    //    updateMany, never upsert: an upsert would CREATE a missing inventory
    //    row and happily take it negative. count === 0 therefore covers both
    //    "not enough stock" and "no inventory row at all".
    //
    //    MUST NOT use productionService.deductStockWithAutoProduceInTx here.
    //    For a short BOM item that helper manufactures the shortfall from raw
    //    materials and restamps Item.costPrice — breaking invariant 2 above. A
    //    write-off destroys stock; it must never create any.
    const dec = await tx.inventory.updateMany({
      where: {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: { gte: input.quantity },
      },
      data: { quantity: { decrement: input.quantity } },
    });
    if (dec.count === 0) {
      throw new WriteOffError(
        409,
        "INSUFFICIENT_STOCK",
        `الكمية المتاحة من "${item.name}" في هذا المخزن غير كافية`,
      );
    }

    // 3. The ledger row. Note there is NO tx.item.update anywhere in this
    //    function — see invariant 2 in the file header.
    return tx.stockWriteOff.create({
      data: {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        unitCost,
        reason: input.reason,
        date: parseDateStart(input.dateStr),
        notes: input.notes,
        userId,
      },
      include: {
        item: { select: { id: true, name: true, unit: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
  });

  await writeAudit({
    action: "CREATE",
    targetEntity: "stock_write_off",
    targetId: String(row.id),
    userId,
    branchId,
    ipAddress,
    newValues: {
      itemId: row.itemId,
      itemName: row.item?.name,
      warehouseId: row.warehouseId,
      quantity: Number(row.quantity),
      unitCost: Number(row.unitCost),
      // The number that actually moves the P&L. Worth having in the audit trail
      // in its own right rather than reconstructing it from the two factors.
      cogsImpact: round2(Number(row.quantity) * Number(row.unitCost)),
      reason: row.reason,
      date: input.dateStr,
      // A back-dated row restates an already-reported period. Flagged so the
      // audit trail shows it without anyone having to diff date vs createdAt.
      backdated: input.dateStr !== cairoTodayISO(),
      unitCostOverridden: input.unitCostOverride !== null,
    },
  });

  return row;
}

/**
 * Reverse an إهلاك by writing a CONTRA row — never by deleting the original.
 *
 * routes/reports.js already states the house rule for wholesale returns: a
 * reversal is booked in the window it happened, "otherwise an August return
 * silently rewrites January's closed total". Deleting a COGS-bearing row does
 * exactly that. A negative-quantity row dated today unwinds the cost in the
 * current period and leaves the original month untouched — the same shape as a
 * REFUND- sale line, which is why routes/reports.js needs no extra code to
 * handle it.
 */
async function reverseWriteOff(id, { userId, branchId = null, ipAddress = null, notes = null }) {
  const writeOffId = parseInt(id, 10);
  if (!Number.isInteger(writeOffId) || writeOffId <= 0) {
    throw new WriteOffError(400, "INVALID_ID", "رقم القيد غير صحيح");
  }

  const contra = await prisma.$transaction(async (tx) => {
    const original = await tx.stockWriteOff.findUnique({
      where: { id: writeOffId },
      include: {
        reversal: { select: { id: true } },
        item: { select: { id: true, name: true } },
      },
    });
    if (!original) {
      throw new WriteOffError(404, "NOT_FOUND", "القيد غير موجود");
    }
    if (Number(original.quantity) < 0) {
      throw new WriteOffError(
        400,
        "CANNOT_REVERSE_REVERSAL",
        "لا يمكن عكس قيد عكسي",
      );
    }
    if (original.reversal) {
      throw new WriteOffError(409, "ALREADY_REVERSED", "تم عكس هذا القيد بالفعل");
    }

    const qty = Number(original.quantity);

    // Restore the stock. upsert+increment (not updateMany) so the reversal still
    // works if the inventory row was removed in the meantime — the CREDIT shape
    // used by services/bulkStock.service.js.
    await tx.inventory.upsert({
      where: {
        itemId_warehouseId: {
          itemId: original.itemId,
          warehouseId: original.warehouseId,
        },
      },
      create: {
        itemId: original.itemId,
        warehouseId: original.warehouseId,
        quantity: qty,
      },
      update: { quantity: { increment: qty } },
    });

    return tx.stockWriteOff.create({
      data: {
        itemId: original.itemId,
        warehouseId: original.warehouseId,
        quantity: -qty,
        // COPIED from the original, never re-resolved. If Item.costPrice moved
        // between the write-off and its reversal, re-resolving would leave the
        // pair not netting to zero — permanent phantom COGS. This is the same
        // trap routes/sales.js's edit path falls into by design for sales.
        unitCost: original.unitCost,
        reason: original.reason,
        // Dated TODAY, not the original's date: see the function comment.
        date: parseDateStart(cairoTodayISO()),
        notes: notes || `عكس إهلاك #${original.id}`,
        userId,
        reversesId: original.id,
      },
      include: {
        item: { select: { id: true, name: true, unit: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
  });

  await writeAudit({
    action: "CANCEL",
    targetEntity: "stock_write_off",
    targetId: String(contra.reversesId),
    userId,
    branchId,
    ipAddress,
    newValues: {
      contraId: contra.id,
      quantity: Number(contra.quantity),
      unitCost: Number(contra.unitCost),
      cogsImpact: round2(Number(contra.quantity) * Number(contra.unitCost)),
    },
  });

  return contra;
}

/**
 * Items available to write off in a warehouse, with on-hand quantity and the
 * cost that would be snapshotted. Includes items hidden from the POS — those
 * (the consumables) are the whole point.
 */
async function listWriteOffItems({ warehouseId }) {
  const [items, inventoryRows] = await Promise.all([
    prisma.item.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        costPrice: true,
        showInPos: true,
        isBom: true,
        categories: { select: { category: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventory.findMany({
      where: warehouseId ? { warehouseId } : {},
      select: { itemId: true, quantity: true },
    }),
  ]);

  const onHand = {};
  for (const row of inventoryRows) {
    onHand[row.itemId] = (onHand[row.itemId] || 0) + Number(row.quantity);
  }

  return items.map((it) => ({
    id: it.id,
    name: it.name,
    unit: it.unit,
    costPrice: Number(it.costPrice),
    showInPos: it.showInPos,
    isBom: it.isBom,
    category: it.categories[0]?.category?.name || null,
    totalQuantity: onHand[it.id] || 0,
  }));
}

/** Write-off history for one item, newest first. */
async function listItemHistory({ itemId, warehouseId }) {
  const where = { itemId };
  if (warehouseId) where.warehouseId = warehouseId;

  const entries = await prisma.stockWriteOff.findMany({
    where,
    include: {
      warehouse: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      reversal: { select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  return entries.map((e) => ({
    id: e.id,
    quantity: Number(e.quantity),
    unitCost: Number(e.unitCost),
    totalCost: round2(Number(e.quantity) * Number(e.unitCost)),
    reason: e.reason,
    date: e.date,
    notes: e.notes,
    warehouse: e.warehouse,
    user: e.user,
    reversesId: e.reversesId,
    isReversal: Number(e.quantity) < 0,
    isReversed: Boolean(e.reversal),
  }));
}

/**
 * Totals for a window, grouped by reason. Contra rows carry negative quantities
 * so they net themselves out, exactly as they do in routes/reports.js.
 */
async function summarize({ startDate, endDate, warehouseIds }) {
  const where = {
    date: { gte: parseDateStart(startDate), lte: parseDateEnd(endDate) },
  };
  if (warehouseIds) where.warehouseId = { in: warehouseIds };

  const rows = await prisma.stockWriteOff.findMany({
    where,
    select: {
      quantity: true,
      unitCost: true,
      reason: true,
      item: { select: { id: true, name: true } },
    },
  });

  const byReason = {};
  let totalCost = 0;
  for (const r of rows) {
    const cost = Number(r.unitCost) * Number(r.quantity);
    totalCost += cost;
    if (!byReason[r.reason]) byReason[r.reason] = { reason: r.reason, cost: 0, quantity: 0 };
    byReason[r.reason].cost += cost;
    byReason[r.reason].quantity += Number(r.quantity);
  }

  return {
    totalCost: round2(totalCost),
    // A contra row is not another إهلاك — the same rule invoiceCount applies to
    // REFUND- sale rows in routes/reports.js.
    count: rows.filter((r) => Number(r.quantity) > 0).length,
    byReason: Object.values(byReason).sort((a, b) => b.cost - a.cost),
  };
}

module.exports = {
  WriteOffError,
  normalizeCreateInput,
  createWriteOff,
  reverseWriteOff,
  listWriteOffItems,
  listItemHistory,
  summarize,
};
