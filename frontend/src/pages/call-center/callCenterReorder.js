// How many units of an item can actually be sold: what's on the shelf plus what
// its BOM can still produce from raw materials. The backend sends `available`
// pre-computed; the fallback keeps this working against an older response shape.
export const availableOf = (it) =>
  Number(it?.available ?? ((it?.stock || 0) + (it?.autoProducible || 0)));

const isKgUnit = (unit) => unit === "kg";

export const formatQty = (qty, unit) => {
  const n = Number(qty) || 0;
  if (isKgUnit(unit)) {
    return n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
  return String(n);
};

// Piece items are sold in whole units; kg items keep gram precision.
const roundQty = (qty, unit) =>
  isKgUnit(unit) ? Math.round(qty * 1000) / 1000 : Math.floor(qty);

/**
 * Check every line of a previous order against the catalog of the branch the
 * agent has selected now. Lines for the same item are folded into one, since
 * the cart holds one line per item.
 *
 * status:
 *   "ok"          — fully available
 *   "partial"     — some stock, less than the old quantity
 *   "unavailable" — in the catalog but nothing sellable right now
 *   "missing"     — deleted item, or not offered at this branch
 *   "unknown"     — no branch catalog loaded yet
 */
export const resolveReorderLines = (lines = [], catalogItems = []) => {
  const catalogLoaded = catalogItems.length > 0;
  const catalogById = new Map(catalogItems.map((it) => [it.id, it]));

  const folded = [];
  const byItemId = new Map();
  for (const line of lines || []) {
    if (line.itemId != null && byItemId.has(line.itemId)) {
      const prev = byItemId.get(line.itemId);
      prev.quantity += Number(line.quantity) || 0;
      prev.total += Number(line.total) || 0;
      continue;
    }
    const copy = {
      ...line,
      quantity: Number(line.quantity) || 0,
      total: Number(line.total) || 0,
    };
    folded.push(copy);
    if (line.itemId != null) byItemId.set(line.itemId, copy);
  }

  return folded.map((line) => {
    const catalogItem = line.itemId != null ? catalogById.get(line.itemId) : null;

    if (!catalogLoaded) {
      return { ...line, status: line.itemId == null ? "missing" : "unknown", available: null, currentPrice: null, priceChanged: false };
    }
    if (!catalogItem) {
      return { ...line, status: "missing", available: 0, currentPrice: null, priceChanged: false };
    }

    const unit = catalogItem.unit || line.unit;
    const available = roundQty(availableOf(catalogItem), unit);
    const currentPrice = Number(catalogItem.price);
    const priceChanged = Math.abs(currentPrice - Number(line.unitPrice)) > 0.005;
    const status =
      available <= 0 ? "unavailable" : available < line.quantity ? "partial" : "ok";

    return { ...line, name: catalogItem.name, unit, status, available, currentPrice, priceChanged };
  });
};

/**
 * Add the orderable lines of a previous order to the cart. Non-destructive:
 * lines already in the cart get the old quantity on top, capped at what the
 * branch can sell. Cart lines keep the exact shape addToCart builds.
 *
 * @returns {{ cart: Array, added: string[], clamped: string[], skipped: string[] }}
 */
export const mergeReorderIntoCart = (cart = [], resolvedLines = []) => {
  const next = cart.map((c) => ({ ...c }));
  const added = [];
  const clamped = [];
  const skipped = [];

  for (const line of resolvedLines) {
    if (line.status !== "ok" && line.status !== "partial") {
      skipped.push(line.name);
      continue;
    }

    const existing = next.find((c) => c.itemId === line.itemId);
    const currentQty = existing ? Number(existing.quantity) || 0 : 0;
    const wanted = currentQty + line.quantity;
    const qty = roundQty(Math.min(wanted, line.available), line.unit);

    if (qty <= currentQty) {
      // Nothing left to add — the cart already holds everything sellable.
      clamped.push(line.name);
      continue;
    }
    if (qty < wanted) clamped.push(line.name);

    if (existing) {
      existing.quantity = qty;
      existing.stock = line.available;
      existing.price = line.currentPrice;
    } else {
      next.push({
        itemId: line.itemId,
        name: line.name,
        price: line.currentPrice,
        quantity: qty,
        stock: line.available,
        unit: line.unit,
      });
    }
    added.push(line.name);
  }

  return { cart: next, added, clamped, skipped };
};
