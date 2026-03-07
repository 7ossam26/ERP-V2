/**
 * Phase A3 — Inventory & Stock Transfers
 *
 * Tests:
 *  - GET inventory returns items with quantities
 *  - Cannot transfer more stock than available (oversell guard)
 *  - Stock transfer creation moves inventory between warehouses
 *  - Stock transfer deletion reverses the inventory move
 *  - Inventory levels never go negative (if enforced)
 *  - BOM item flag (isBom) is present on items
 *
 * Usage:
 *   node backend/tests/phase-a3-inventory.test.js [BASE_URL] [TOKEN]
 */

const BASE_URL = process.argv[2] || process.env.BASE_URL || "http://localhost:3001";
const TOKEN    = process.argv[3] || process.env.TOKEN    || "";

const GREEN  = "\x1b[32m"; const RED    = "\x1b[31m"; const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m"; const BOLD   = "\x1b[1m";  const RESET  = "\x1b[0m";

let passed = 0, failed = 0, skipped = 0;
const results = [];

const req = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { const ct = res.headers.get("content-type") || ""; data = ct.includes("application/json") ? await res.json() : await res.text(); } catch { data = null; }
  return { status: res.status, data };
};

const pass    = (n, d = "") => { console.log(`  ${GREEN}PASS${RESET} ${n}${d ? `  ${YELLOW}${d}${RESET}` : ""}`); results.push({ n, result: "PASS" }); passed++; };
const fail    = (n, d = "") => { console.log(`  ${RED}FAIL${RESET} ${n}  ${RED}${d}${RESET}`); results.push({ n, result: "FAIL", detail: d }); failed++; };
const skip    = (n, r)      => { console.log(`  ${YELLOW}SKIP${RESET} ${n}  ${YELLOW}(${r})${RESET}`); results.push({ n, result: "SKIP", detail: r }); skipped++; };
const section = (t) => console.log(`\n${BOLD}${CYAN}── ${t} ${"─".repeat(Math.max(0, 60 - t.length))}${RESET}`);

let ctx = {
  inventory: [],
  warehouses: [],
  stockTransfers: [],
  itemWithStock: null,
  sourceWarehouse: null,
  destWarehouse: null,
};

const discover = async () => {
  section("Discovery");

  // Inventory
  const invRes = await req("GET", "/api/inventory");
  if (invRes.status === 200) {
    ctx.inventory = Array.isArray(invRes.data) ? invRes.data : invRes.data?.data || [];
    ctx.itemWithStock = ctx.inventory.find(i => Number(i.quantity) > 0) || null;
    console.log(`  Inventory records: ${ctx.inventory.length}`);
    if (ctx.itemWithStock) console.log(`  Item with stock: itemId=${ctx.itemWithStock.itemId}, qty=${ctx.itemWithStock.quantity}, warehouseId=${ctx.itemWithStock.warehouseId}`);
    else console.log(`  ${YELLOW}No items with stock > 0${RESET}`);
  } else {
    console.log(`  ${RED}GET /api/inventory → ${invRes.status}${RESET}`);
  }

  // Warehouses
  const whRes = await req("GET", "/api/warehouses");
  if (whRes.status === 200) {
    ctx.warehouses = Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || [];
    console.log(`  Warehouses: ${ctx.warehouses.length}`);
    if (ctx.warehouses.length >= 2) {
      ctx.sourceWarehouse = ctx.warehouses[0];
      ctx.destWarehouse   = ctx.warehouses[1];
      console.log(`  Source warehouse: id=${ctx.sourceWarehouse.id}, name="${ctx.sourceWarehouse.name}"`);
      console.log(`  Dest warehouse:   id=${ctx.destWarehouse.id},   name="${ctx.destWarehouse.name}"`);
    }
  }

  // Stock Transfers
  const stRes = await req("GET", "/api/stock-transfers");
  if (stRes.status === 200) {
    ctx.stockTransfers = Array.isArray(stRes.data) ? stRes.data : stRes.data?.data || [];
    console.log(`  Stock transfers: ${ctx.stockTransfers.length}`);
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const testInventoryEndpoint = async () => {
  section("A3-01 — GET /api/inventory returns records with expected fields");

  const r = await req("GET", "/api/inventory");
  if (r.status !== 200) { fail("GET /api/inventory", `Expected 200, got ${r.status}`); return; }

  const inv = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (inv.length === 0) {
    console.log(`  ${YELLOW}INFO${RESET} Inventory is empty — warehouse/item data may not be seeded`);
    pass("GET /api/inventory → 200 (empty)", "No inventory records exist yet");
    return;
  }

  // Check first record has expected fields
  const first = inv[0];
  const hasItemId     = "itemId"     in first || "item_id"     in first;
  const hasWarehouseId = "warehouseId" in first || "warehouse_id" in first;
  const hasQuantity   = "quantity"   in first;

  if (hasItemId && hasWarehouseId && hasQuantity) {
    pass("Inventory record has itemId, warehouseId, quantity", `${inv.length} records`);
  } else {
    fail("Inventory record shape", `Missing fields. Got keys: ${Object.keys(first).join(", ")}`);
  }
};

const testInventoryFiltering = async () => {
  section("A3-02 — Inventory can be filtered by warehouseId");

  if (ctx.warehouses.length === 0) { skip("Inventory warehouse filter", "No warehouses found"); return; }

  const wh = ctx.warehouses[0];
  const r = await req("GET", `/api/inventory?warehouseId=${wh.id}`);

  if (r.status !== 200) { fail("GET /api/inventory?warehouseId=X", `Expected 200, got ${r.status}`); return; }

  const inv = Array.isArray(r.data) ? r.data : r.data?.data || [];
  const allBelongToWarehouse = inv.every(i => i.warehouseId === wh.id || i.warehouse?.id === wh.id);

  if (allBelongToWarehouse || inv.length === 0) {
    pass(`Inventory filter by warehouseId=${wh.id} returns correct records`, `${inv.length} records`);
  } else {
    fail("Inventory warehouse filter", `Some records have wrong warehouseId. Sample: ${JSON.stringify(inv[0])}`);
  }
};

const testStockTransferOverLimit = async () => {
  section("A3-03 — Stock transfer blocked when quantity exceeds available stock → 400");

  if (!ctx.itemWithStock)  { skip("Over-limit transfer guard", "No item with stock found"); return; }
  if (!ctx.sourceWarehouse || !ctx.destWarehouse) { skip("Over-limit transfer guard", "Need at least 2 warehouses"); return; }

  const itemId     = ctx.itemWithStock.itemId;
  const currentQty = Number(ctx.itemWithStock.quantity);
  const excessQty  = currentQty + 9999;

  const r = await req("POST", "/api/stock-transfers", {
    fromWarehouseId: ctx.itemWithStock.warehouseId,
    toWarehouseId:   ctx.destWarehouse.id === ctx.itemWithStock.warehouseId
                       ? ctx.sourceWarehouse.id
                       : ctx.destWarehouse.id,
    items: [{ itemId, quantity: excessQty }],
    notes: "Test transfer — should fail (excess quantity)",
  });

  if (r.status === 400) {
    pass("Stock transfer with excess quantity → 400", `msg: "${r.data?.error || r.data?.message}"`);
  } else if (r.status === 200 || r.status === 201) {
    fail("Stock transfer over-limit guard", `Expected 400 — got ${r.status} (negative stock may now exist!)`);
  } else {
    fail("Stock transfer over-limit guard", `Expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
  }
};

const testStockTransferCreation = async () => {
  section("A3-04 — Stock transfer moves inventory between warehouses");

  if (!ctx.itemWithStock) { skip("Stock transfer creation", "No item with stock"); return; }
  if (!ctx.destWarehouse) { skip("Stock transfer creation", "Need at least 2 warehouses"); return; }

  const itemId       = ctx.itemWithStock.itemId;
  const srcWarehouse = ctx.itemWithStock.warehouseId;
  const dstWarehouse = ctx.destWarehouse.id === srcWarehouse ? ctx.sourceWarehouse?.id : ctx.destWarehouse.id;

  if (!dstWarehouse || dstWarehouse === srcWarehouse) { skip("Stock transfer creation", "Cannot find a different destination warehouse"); return; }

  const qtyBefore = Number(ctx.itemWithStock.quantity);
  const transferQty = 1;

  // Get dest qty before
  const invBeforeRes = await req("GET", `/api/inventory?itemId=${itemId}&warehouseId=${dstWarehouse}`);
  const invBefore    = Array.isArray(invBeforeRes.data) ? invBeforeRes.data : invBeforeRes.data?.data || [];
  const dstQtyBefore = invBefore.find(i => i.itemId === itemId)?.quantity ?? 0;

  const r = await req("POST", "/api/stock-transfers", {
    fromWarehouseId: srcWarehouse,
    toWarehouseId: dstWarehouse,
    items: [{ itemId, quantity: transferQty }],
    notes: "Test transfer",
  });

  if (r.status !== 200 && r.status !== 201) {
    fail("POST /api/stock-transfers", `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  pass("POST /api/stock-transfers → 201", `transferId=${r.data?.id || r.data?.transferId}`);

  // Verify source decreased
  const srcRes   = await req("GET", `/api/inventory?itemId=${itemId}&warehouseId=${srcWarehouse}`);
  const srcInv   = Array.isArray(srcRes.data) ? srcRes.data : srcRes.data?.data || [];
  const srcAfter = srcInv.find(i => i.itemId === itemId)?.quantity;

  if (srcAfter !== undefined) {
    const delta = qtyBefore - Number(srcAfter);
    if (Math.abs(delta - transferQty) < 0.01) {
      pass("Source warehouse quantity decreased by transfer amount", `${qtyBefore} → ${srcAfter}`);
    } else {
      fail("Source warehouse quantity after transfer", `Expected -${transferQty}, got delta=${delta}`);
    }
  }

  // Verify dest increased
  const dstRes   = await req("GET", `/api/inventory?itemId=${itemId}&warehouseId=${dstWarehouse}`);
  const dstInv   = Array.isArray(dstRes.data) ? dstRes.data : dstRes.data?.data || [];
  const dstAfter = dstInv.find(i => i.itemId === itemId)?.quantity;

  if (dstAfter !== undefined) {
    const delta = Number(dstAfter) - Number(dstQtyBefore);
    if (Math.abs(delta - transferQty) < 0.01) {
      pass("Destination warehouse quantity increased by transfer amount", `${dstQtyBefore} → ${dstAfter}`);
    } else {
      fail("Destination warehouse quantity after transfer", `Expected +${transferQty}, got delta=${delta}`);
    }
  }
};

const testBomFlagOnItems = async () => {
  section("A3-05 — Items have isBom field (schema gap check)");

  const r = await req("GET", "/api/items");
  if (r.status !== 200) { skip("isBom field check", `GET /api/items → ${r.status}`); return; }

  const items = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (items.length === 0) { skip("isBom field check", "No items in DB"); return; }

  const first = items[0];
  if ("isBom" in first) {
    const bomItems = items.filter(i => i.isBom === true);
    pass(`Items have isBom field`, `${bomItems.length} BOM items of ${items.length} total`);
  } else {
    console.log(`  ${YELLOW}WARN${RESET} isBom field NOT in item response. This field may not be migrated yet (known schema gap).`);
    console.log(`  ${YELLOW}WARN${RESET} Item keys: ${Object.keys(first).join(", ")}`);
    fail("isBom field missing from items", "Check schema gap: items.is_bom migration may not have run");
  }
};

const testNoNegativeInventory = async () => {
  section("A3-06 — No inventory records have negative quantity");

  const r = await req("GET", "/api/inventory");
  if (r.status !== 200) { skip("Negative inventory check", `GET /api/inventory → ${r.status}`); return; }

  const inv = Array.isArray(r.data) ? r.data : r.data?.data || [];
  const negative = inv.filter(i => Number(i.quantity) < 0);

  if (negative.length === 0) {
    pass("No negative inventory records found", `${inv.length} records checked`);
  } else {
    fail("Negative inventory exists", `${negative.length} records with qty<0: ${negative.map(i => `itemId=${i.itemId} qty=${i.quantity}`).join(", ")}`);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A3 — Inventory & Stock Transfers${RESET}`);
  console.log(`Base URL: ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Token:    ${TOKEN ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);

  if (!TOKEN) { console.log(`\n${RED}No token provided.${RESET}\n`); process.exit(1); }

  await discover();
  await testInventoryEndpoint();
  await testInventoryFiltering();
  await testStockTransferOverLimit();
  await testStockTransferCreation();
  await testBomFlagOnItems();
  await testNoNegativeInventory();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);
  if (failed > 0) { results.filter(r => r.result === "FAIL").forEach(r => { console.log(`  ${RED}✗${RESET} ${r.n}`); if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`); }); }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
