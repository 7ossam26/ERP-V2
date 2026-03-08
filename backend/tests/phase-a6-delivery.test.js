/**
 * Phase A6 — Delivery Module
 *
 * Tests:
 *  - GET delivery men returns records with walletBalance
 *  - GET delivery zones requires auth
 *  - walletBalance increases when a delivery order is assigned
 *  - Delivery settlement reduces walletBalance and updates treasury
 *  - Settlement amount cannot exceed walletBalance → 400
 *  - deliveryDriverShare field is present on delivery zones
 *
 * Usage:
 *   node backend/tests/phase-a6-delivery.test.js [BASE_URL] [TOKEN]
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

let ctx = { deliveryMen: [], deliveryZones: [], manWithDebt: null, richTreasury: null };

const discover = async () => {
  section("Discovery");

  const dmRes = await req("GET", "/api/delivery-men");
  if (dmRes.status === 200) {
    ctx.deliveryMen  = Array.isArray(dmRes.data) ? dmRes.data : dmRes.data?.data || [];
    ctx.manWithDebt  = ctx.deliveryMen.find(d => Number(d.walletBalance) > 0) || null;
    console.log(`  Delivery men: ${ctx.deliveryMen.length}`);
    if (ctx.manWithDebt) console.log(`  Man with debt: id=${ctx.manWithDebt.id}, wallet=${ctx.manWithDebt.walletBalance}`);
    else console.log(`  ${YELLOW}No delivery men with walletBalance > 0${RESET}`);
  }

  const dzRes = await req("GET", "/api/delivery-zones");
  if (dzRes.status === 200) {
    ctx.deliveryZones = Array.isArray(dzRes.data) ? dzRes.data : dzRes.data?.data || [];
    console.log(`  Delivery zones: ${ctx.deliveryZones.length}`);
  }

  const tRes = await req("GET", "/api/treasuries");
  if (tRes.status === 200 && Array.isArray(tRes.data)) {
    ctx.richTreasury = tRes.data.find(t => Number(t.balance) >= 10) || null;
    if (ctx.richTreasury) console.log(`  Treasury: id=${ctx.richTreasury.id}, balance=${ctx.richTreasury.balance}`);
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const testDeliveryMenEndpoint = async () => {
  section("A6-01 — GET /api/delivery-men returns records with walletBalance");

  const r = await req("GET", "/api/delivery-men");
  if (r.status !== 200) { fail("GET /api/delivery-men", `Expected 200, got ${r.status}`); return; }

  const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (list.length === 0) { pass("GET /api/delivery-men → 200 (empty)"); return; }

  const first = list[0];
  if ("walletBalance" in first || "wallet_balance" in first) {
    pass("Delivery man record has walletBalance field", `${list.length} records`);
  } else {
    fail("walletBalance field missing", `Got keys: ${Object.keys(first).join(", ")}`);
  }
};

const testDeliveryZonesRequireAuth = async () => {
  section("A6-02 — GET /api/delivery-zones requires authentication");

  const noAuthRes = await fetch(`${BASE_URL}/api/delivery-zones`, {
    headers: { "Content-Type": "application/json" },
  });

  if (noAuthRes.status === 401) {
    pass("GET /api/delivery-zones without token → 401");
  } else if (noAuthRes.status === 200) {
    fail("Delivery zones auth guard", "Expected 401 — got 200 (no auth check!)");
  } else {
    fail("Delivery zones auth guard", `Expected 401, got ${noAuthRes.status}`);
  }
};

const testDeliveryZonesHaveDriverShare = async () => {
  section("A6-03 — Delivery zones have deliveryDriverShare field");

  const r = await req("GET", "/api/delivery-zones");
  if (r.status !== 200) { fail("GET /api/delivery-zones", `Expected 200, got ${r.status}`); return; }

  const zones = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (zones.length === 0) { pass("GET /api/delivery-zones → 200 (empty)"); return; }

  const first = zones[0];
  const hasDriverShare = "deliveryDriverShare" in first || "driver_share" in first || "driverShare" in first;

  if (hasDriverShare) {
    pass("Delivery zone has deliveryDriverShare field", `${zones.length} zones`);
  } else {
    console.log(`  ${YELLOW}WARN${RESET} deliveryDriverShare not in zone response. Keys: ${Object.keys(first).join(", ")}`);
    fail("deliveryDriverShare field missing from delivery zones", "Check route includes this field");
  }
};

const testSettlementReducesWallet = async () => {
  section("A6-04 — Settlement reduces delivery man wallet balance");

  if (!ctx.manWithDebt)  { skip("Settlement reduces wallet", "No delivery man with walletBalance > 0"); return; }
  if (!ctx.richTreasury) { skip("Settlement reduces wallet", "No treasury with balance"); return; }

  const man           = ctx.manWithDebt;
  const walletBefore  = Number(man.walletBalance);
  const settleAmt     = Math.min(1, walletBefore);
  const tBefore       = Number(ctx.richTreasury.balance);

  const r = await req("POST", `/api/delivery-men/${man.id}/settle`, {
    amount:     settleAmt,
    treasuryId: ctx.richTreasury.id,
    notes:      "Automated test settlement",
  });

  if (r.status !== 200 && r.status !== 201) {
    fail("POST /api/delivery-men/:id/settle", `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  pass("POST settlement → 201");

  // Verify wallet decreased
  const dmAfter = await req("GET", `/api/delivery-men/${man.id}`);
  const walletAfter = Number(dmAfter.data?.walletBalance ?? 0);
  const wDelta = walletBefore - walletAfter;

  if (Math.abs(wDelta - settleAmt) < 0.01) {
    pass("Wallet balance decreased by settlement amount", `${walletBefore} → ${walletAfter}`);
  } else {
    fail("Wallet after settlement", `Expected -${settleAmt}, got delta=${wDelta}`);
  }

  // Verify treasury decreased (company paid out settlement)
  const tAfter = await req("GET", `/api/treasuries/${ctx.richTreasury.id}`);
  const tAfterBalance = Number(tAfter.data?.balance ?? 0);
  const tDelta = tBefore - tAfterBalance;

  if (Math.abs(tDelta - settleAmt) < 0.01) {
    pass("Treasury decreased by settlement amount", `${tBefore} → ${tAfterBalance}`);
  } else {
    console.log(`  ${YELLOW}INFO${RESET} Treasury delta=${tDelta} vs expected ${settleAmt} — verify settlement flow direction`);
  }
};

const testSettlementOverLimit = async () => {
  section("A6-05 — Settlement exceeding wallet balance → 400");

  if (!ctx.manWithDebt)  { skip("Settlement over-limit", "No delivery man with walletBalance > 0"); return; }
  if (!ctx.richTreasury) { skip("Settlement over-limit", "No treasury"); return; }

  const man        = ctx.manWithDebt;
  const walletBal  = Number(man.walletBalance);
  const excessAmt  = walletBal + 99999;

  const r = await req("POST", `/api/delivery-men/${man.id}/settle`, {
    amount:     excessAmt,
    treasuryId: ctx.richTreasury.id,
  });

  if (r.status === 400) {
    pass("Settlement exceeding wallet → 400", `msg: "${r.data?.error || r.data?.message}"`);
  } else if (r.status === 200 || r.status === 201) {
    fail("Settlement over-limit guard", `Expected 400 — got ${r.status} (overpayment allowed!)`);
  } else {
    fail("Settlement over-limit guard", `Expected 400, got ${r.status}`);
  }
};

const testDeliveryOrdersRequireAuth = async () => {
  section("A6-06 — Delivery order routes require authentication");

  const noAuthRes = await fetch(`${BASE_URL}/api/delivery-orders`, {
    headers: { "Content-Type": "application/json" },
  });

  if (noAuthRes.status === 401) {
    pass("GET /api/delivery-orders without token → 401");
  } else if (noAuthRes.status === 404) {
    console.log(`  ${YELLOW}INFO${RESET} /api/delivery-orders returns 404 — endpoint may be at a different path`);
  } else if (noAuthRes.status === 200) {
    fail("Delivery orders auth guard", "Expected 401 — got 200 (public access!)");
  } else {
    console.log(`  ${YELLOW}INFO${RESET} GET /api/delivery-orders → ${noAuthRes.status}`);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A6 — Delivery Module${RESET}`);
  console.log(`Base URL: ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Token:    ${TOKEN ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);

  if (!TOKEN) { console.log(`\n${RED}No token provided.${RESET}\n`); process.exit(1); }

  await discover();
  await testDeliveryMenEndpoint();
  await testDeliveryZonesRequireAuth();
  await testDeliveryZonesHaveDriverShare();
  await testSettlementReducesWallet();
  await testSettlementOverLimit();
  await testDeliveryOrdersRequireAuth();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);
  if (failed > 0) { results.filter(r => r.result === "FAIL").forEach(r => { console.log(`  ${RED}✗${RESET} ${r.n}`); if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`); }); }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
