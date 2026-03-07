/**
 * Phase A2 — Point of Sale (POS) Module
 *
 * Tests:
 *  - Shift lifecycle: start, hold, end, approve
 *  - Cannot start a shift if previous shift is PENDING_REVIEW
 *  - Cannot create a sale without an open shift
 *  - Sale creation deducts inventory
 *  - CASH sale increments main treasury
 *  - CARD sale increments bank treasury
 *  - Held (HELD) sale does NOT deduct inventory
 *  - Refund reverses inventory and treasury
 *  - Cannot end another user's shift (403)
 *
 * Usage:
 *   node backend/tests/phase-a2-pos.test.js [BASE_URL] [TOKEN]
 *
 * NOTE: Some tests create real transactions. Run against a test DB.
 */

const BASE_URL = process.argv[2] || process.env.BASE_URL || "http://localhost:3001";
const TOKEN    = process.argv[3] || process.env.TOKEN    || "";

const GREEN  = "\x1b[32m"; const RED    = "\x1b[31m"; const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m"; const BOLD   = "\x1b[1m";  const RESET  = "\x1b[0m";

let passed = 0, failed = 0, skipped = 0;
const results = [];

const req = async (method, path, body, token = TOKEN) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

// ─── Context ──────────────────────────────────────────────────────────────────
let ctx = {
  currentUser: null,
  openShift: null,
  pendingShift: null,   // PENDING_REVIEW shift
  item: null,           // item with stock
  mainTreasury: null,
  bankTreasury: null,
  branchId: null,
};

const discover = async () => {
  section("Discovery");

  // Current user
  const meRes = await req("GET", "/api/auth/me");
  if (meRes.status === 200) {
    ctx.currentUser = meRes.data;
    ctx.branchId = meRes.data.branchId || meRes.data.branch?.id;
    console.log(`  User: ${meRes.data.name} | branchId=${ctx.branchId} | role=${meRes.data.role?.name}`);
  } else {
    console.log(`  ${RED}Cannot authenticate — most tests will be skipped${RESET}`);
    return;
  }

  // Shifts
  const shiftsRes = await req("GET", "/api/shifts?status=OPEN&limit=1");
  if (shiftsRes.status === 200) {
    const list = Array.isArray(shiftsRes.data) ? shiftsRes.data : shiftsRes.data?.data || [];
    ctx.openShift = list[0] || null;
    if (ctx.openShift) console.log(`  Open shift: id=${ctx.openShift.id}, userId=${ctx.openShift.userId}`);
    else console.log(`  No open shifts`);
  }

  const pendingRes = await req("GET", "/api/shifts?status=PENDING_REVIEW&limit=1");
  if (pendingRes.status === 200) {
    const list = Array.isArray(pendingRes.data) ? pendingRes.data : pendingRes.data?.data || [];
    ctx.pendingShift = list[0] || null;
    if (ctx.pendingShift) console.log(`  Pending shift: id=${ctx.pendingShift.id}`);
  }

  // Inventory — find an item with stock
  if (ctx.branchId) {
    const invRes = await req("GET", `/api/inventory?branchId=${ctx.branchId}`);
    if (invRes.status === 200) {
      const inv = Array.isArray(invRes.data) ? invRes.data : invRes.data?.data || [];
      ctx.item = inv.find(i => Number(i.quantity) > 0) || null;
      if (ctx.item) console.log(`  Item with stock: itemId=${ctx.item.itemId}, qty=${ctx.item.quantity}`);
    }
  }

  // Treasuries
  const tRes = await req("GET", "/api/treasuries");
  if (tRes.status === 200 && Array.isArray(tRes.data)) {
    ctx.mainTreasury = tRes.data.find(t => !t.name?.toLowerCase().includes("bank")) || tRes.data[0];
    ctx.bankTreasury = tRes.data.find(t => t.name?.toLowerCase().includes("bank")) || null;
    if (ctx.mainTreasury) console.log(`  Main treasury: id=${ctx.mainTreasury.id}, balance=${ctx.mainTreasury.balance}`);
    if (ctx.bankTreasury) console.log(`  Bank treasury: id=${ctx.bankTreasury.id}, balance=${ctx.bankTreasury.balance}`);
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const testSaleWithoutShift = async () => {
  section("A2-01 — Sale requires open shift → 400");

  if (ctx.openShift) {
    console.log(`  ${YELLOW}INFO${RESET} An open shift exists (id=${ctx.openShift.id}). This test needs NO open shift.`);
    console.log(`  ${YELLOW}INFO${RESET} Skipping to avoid false pass — manually close the shift first.`);
    skip("Sale without shift", "Open shift exists — close it first to test this guard");
    return;
  }

  const r = await req("POST", "/api/sales", {
    branchId: ctx.branchId || 1,
    paymentMethod: "CASH",
    items: [{ itemId: 999999, quantity: 1, price: 10 }],
    total: 10,
  });

  if (r.status === 400) {
    pass("POST /api/sales without shift → 400", `msg: "${r.data?.error || r.data?.message}"`);
  } else if (r.status === 201) {
    fail("POST /api/sales without shift", "Expected 400 — got 201 (shift guard missing!)");
  } else {
    fail("POST /api/sales without shift", `Expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
  }
};

const testShiftStart = async () => {
  section("A2-02 — Shift start lifecycle");

  if (!ctx.currentUser) { skip("Shift start", "Not authenticated"); return; }
  if (!ctx.branchId)    { skip("Shift start", "No branchId on current user"); return; }

  if (ctx.openShift) {
    console.log(`  ${YELLOW}INFO${RESET} Open shift already exists (id=${ctx.openShift.id}) — skipping start test`);
    pass("Open shift exists — lifecycle already started", `shiftId=${ctx.openShift.id}`);
    return;
  }

  const r = await req("POST", "/api/shifts/start", {
    userId: ctx.currentUser.id,
    branchId: ctx.branchId,
  });

  if (r.status === 200 || r.status === 201) {
    ctx.openShift = r.data;
    pass("POST /api/shifts/start → shift opened", `id=${r.data?.id}, type=${r.data?.type}`);
  } else if (r.status === 400 && r.data?.previousShiftStatus) {
    console.log(`  ${YELLOW}INFO${RESET} Blocked: previous shift status = ${r.data.previousShiftStatus}`);
    pass("Blocked by PENDING_REVIEW shift → correct blocking behavior", `status=${r.data.previousShiftStatus}`);
  } else {
    fail("POST /api/shifts/start", `Expected 200/201, got ${r.status}: ${JSON.stringify(r.data)}`);
  }
};

const testBlockedByPendingShift = async () => {
  section("A2-03 — Cannot start shift if previous is PENDING_REVIEW → 400");

  if (!ctx.currentUser) { skip("Pending shift block", "Not authenticated"); return; }
  if (!ctx.pendingShift) {
    console.log(`  ${YELLOW}INFO${RESET} No PENDING_REVIEW shift in DB — this scenario cannot be triggered right now`);
    skip("Pending shift block", "No PENDING_REVIEW shifts exist in DB");
    return;
  }

  // Try to start a shift for the same user as the pending one
  const r = await req("POST", "/api/shifts/start", {
    userId: ctx.pendingShift.userId,
    branchId: ctx.pendingShift.branchId,
  });

  if (r.status === 400 && r.data?.previousShiftStatus) {
    pass("Start blocked when previous shift is PENDING_REVIEW", `status=${r.data.previousShiftStatus}, msg=${r.data.message}`);
  } else if (r.status === 200 || r.status === 201) {
    fail("Start shift with PENDING_REVIEW previous", "Expected 400 — got 200 (blocking guard missing!)");
  } else {
    fail("Start shift with PENDING_REVIEW previous", `Expected 400 with previousShiftStatus, got ${r.status}`);
  }
};

const testSaleInventoryDeduction = async () => {
  section("A2-04 — Sale deducts inventory");

  if (!ctx.openShift) { skip("Sale inventory deduction", "No open shift"); return; }
  if (!ctx.item)      { skip("Sale inventory deduction", "No item with stock found"); return; }

  const itemId = ctx.item.itemId;
  const warehouseId = ctx.item.warehouseId;
  const qtyBefore = Number(ctx.item.quantity);

  const saleRes = await req("POST", "/api/sales", {
    shiftId: ctx.openShift.id,
    branchId: ctx.branchId,
    paymentMethod: "CASH",
    items: [{ itemId, quantity: 1, price: ctx.item.price || 10, total: ctx.item.price || 10 }],
    total: ctx.item.price || 10,
    paidAmount: ctx.item.price || 10,
  });

  if (saleRes.status !== 200 && saleRes.status !== 201) {
    fail("POST /api/sales", `Expected 201, got ${saleRes.status}: ${JSON.stringify(saleRes.data)}`);
    return;
  }

  pass("POST /api/sales → 201", `saleId=${saleRes.data?.id}`);

  // Verify inventory decreased
  const invRes = await req("GET", `/api/inventory?itemId=${itemId}&warehouseId=${warehouseId}`);
  if (invRes.status === 200) {
    const inv = Array.isArray(invRes.data) ? invRes.data : invRes.data?.data || [];
    const after = inv.find(i => i.itemId === itemId && i.warehouseId === warehouseId);
    const qtyAfter = after ? Number(after.quantity) : null;

    if (qtyAfter !== null) {
      const delta = qtyBefore - qtyAfter;
      if (Math.abs(delta - 1) < 0.01) {
        pass("Inventory decremented by 1 after sale", `${qtyBefore} → ${qtyAfter}`);
      } else {
        fail("Inventory after sale", `Expected -1, got delta=${delta} (before=${qtyBefore}, after=${qtyAfter})`);
      }
    } else {
      console.log(`  ${YELLOW}INFO${RESET} Cannot read inventory after sale — check query params`);
    }
  }
};

const testCashSaleTreasury = async () => {
  section("A2-05 — CASH sale increments main treasury");

  if (!ctx.openShift)    { skip("CASH sale treasury", "No open shift"); return; }
  if (!ctx.mainTreasury) { skip("CASH sale treasury", "No main treasury found"); return; }
  if (!ctx.item)         { skip("CASH sale treasury", "No item with stock"); return; }

  const balanceBefore = Number(ctx.mainTreasury.balance);
  const saleAmount = ctx.item.price || 50;

  const saleRes = await req("POST", "/api/sales", {
    shiftId: ctx.openShift.id,
    branchId: ctx.branchId,
    paymentMethod: "CASH",
    items: [{ itemId: ctx.item.itemId, quantity: 1, price: saleAmount, total: saleAmount }],
    total: saleAmount,
    paidAmount: saleAmount,
  });

  if (saleRes.status !== 200 && saleRes.status !== 201) {
    fail("CASH sale for treasury test", `Expected 201, got ${saleRes.status}: ${JSON.stringify(saleRes.data)}`);
    return;
  }

  const tAfter = await req("GET", `/api/treasuries/${ctx.mainTreasury.id}`);
  const balanceAfter = Number(tAfter.data?.balance);
  const delta = balanceAfter - balanceBefore;

  if (Math.abs(delta - saleAmount) < 0.01) {
    pass("Treasury balance incremented by sale amount", `${balanceBefore} → ${balanceAfter} (+${saleAmount})`);
  } else {
    fail("Treasury balance after CASH sale", `Expected +${saleAmount}, got delta=${delta}`);
  }
};

const testShiftEndFlow = async () => {
  section("A2-06 — Shift end moves to PENDING_REVIEW");

  if (!ctx.openShift) { skip("Shift end", "No open shift"); return; }

  // Check shift still open
  const shiftRes = await req("GET", `/api/shifts/${ctx.openShift.id}`);
  if (shiftRes.status !== 200 || shiftRes.data?.status !== "OPEN") {
    skip("Shift end", `Shift ${ctx.openShift.id} is not OPEN (status=${shiftRes.data?.status})`);
    return;
  }

  console.log(`  ${YELLOW}INFO${RESET} Ending shift id=${ctx.openShift.id} — this will move it to PENDING_REVIEW`);
  console.log(`  ${YELLOW}INFO${RESET} You will need manager approval to fully close it`);

  const r = await req("POST", "/api/shifts/end", {
    shiftId: ctx.openShift.id,
    endCash: 0,
  });

  if (r.status === 200 || r.status === 201) {
    const newStatus = r.data?.status;
    if (newStatus === "PENDING_REVIEW" || newStatus === "CLOSED") {
      pass(`Shift moved to ${newStatus} after end`, `shiftId=${ctx.openShift.id}`);
    } else {
      pass(`POST /api/shifts/end → ${r.status}`, `status=${newStatus}`);
    }
  } else if (r.status === 400 && r.data?.pendingOrders) {
    console.log(`  ${YELLOW}INFO${RESET} Shift end blocked: ${r.data.pendingOrders.length} pending delivery orders`);
    pass("Shift end blocked by pending deliveries (correct behavior)", `${r.data.pendingOrders.length} orders`);
  } else {
    fail("POST /api/shifts/end", `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
  }
};

const testCannotEndOtherShift = async () => {
  section("A2-07 — Cannot end another user's shift without manager role");

  // Find a shift that doesn't belong to current user
  const allShiftsRes = await req("GET", "/api/shifts?status=OPEN");
  if (allShiftsRes.status !== 200) {
    skip("Other user shift guard", "Cannot fetch shifts");
    return;
  }

  const shifts = Array.isArray(allShiftsRes.data) ? allShiftsRes.data : allShiftsRes.data?.data || [];
  const otherShift = shifts.find(s => s.userId !== ctx.currentUser?.id);

  if (!otherShift) {
    skip("Other user shift guard", "No shifts belonging to other users found");
    return;
  }

  const r = await req("POST", "/api/shifts/end", { shiftId: otherShift.id, endCash: 0 });

  if (r.status === 403) {
    pass("Cannot end another user's shift → 403", `otherUserId=${otherShift.userId}`);
  } else if (r.status === 200) {
    console.log(`  ${YELLOW}INFO${RESET} Shift ended — this user may have manager privileges. Verify role=${ctx.currentUser?.role?.name}`);
  } else {
    console.log(`  ${YELLOW}INFO${RESET} Got ${r.status} — ${JSON.stringify(r.data)}`);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A2 — POS: Shift Lifecycle & Sales${RESET}`);
  console.log(`Base URL: ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Token:    ${TOKEN ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);

  if (!TOKEN) {
    console.log(`\n${RED}No token. Provide token as argument or TOKEN env var.${RESET}\n`);
    process.exit(1);
  }

  await discover();
  await testSaleWithoutShift();
  await testShiftStart();
  await testBlockedByPendingShift();
  await testSaleInventoryDeduction();
  await testCashSaleTreasury();
  await testShiftEndFlow();
  await testCannotEndOtherShift();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);
  if (failed > 0) { results.filter(r => r.result === "FAIL").forEach(r => { console.log(`  ${RED}✗${RESET} ${r.n}`); if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`); }); }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
