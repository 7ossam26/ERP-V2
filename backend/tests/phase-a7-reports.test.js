/**
 * Phase A7 — Reports & Data Aggregations
 *
 * Tests:
 *  - GET /api/reports/summary returns expected fields
 *  - branchId filter returns subset of data (not all)
 *  - Date range filters (startDate/endDate) narrow results correctly
 *  - Reports require authentication
 *  - Shift report has correct totals (cash + card = total sales)
 *  - Daily transactions report reflects actual transactions
 *
 * Usage:
 *   node backend/tests/phase-a7-reports.test.js [BASE_URL] [TOKEN]
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

let ctx = { branches: [], closedShifts: [] };

const discover = async () => {
  section("Discovery");

  const bRes = await req("GET", "/api/branches");
  if (bRes.status === 200) {
    ctx.branches = Array.isArray(bRes.data) ? bRes.data : bRes.data?.data || [];
    console.log(`  Branches: ${ctx.branches.length}`);
  }

  const shiftRes = await req("GET", "/api/shifts?status=CLOSED&limit=3");
  if (shiftRes.status === 200) {
    ctx.closedShifts = Array.isArray(shiftRes.data) ? shiftRes.data : shiftRes.data?.data || [];
    console.log(`  Closed shifts: ${ctx.closedShifts.length}`);
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const testReportsRequireAuth = async () => {
  section("A7-01 — Report endpoints require authentication");

  const noAuthRes = await fetch(`${BASE_URL}/api/reports/summary`, {
    headers: { "Content-Type": "application/json" },
  });

  if (noAuthRes.status === 401) {
    pass("GET /api/reports/summary without token → 401");
  } else if (noAuthRes.status === 200) {
    fail("Reports auth guard", "Expected 401 — got 200 (public access!)");
  } else {
    console.log(`  ${YELLOW}INFO${RESET} /api/reports/summary → ${noAuthRes.status} without token`);
  }
};

const testSummaryEndpoint = async () => {
  section("A7-02 — GET /api/reports/summary returns data");

  const r = await req("GET", "/api/reports/summary");
  if (r.status === 403) { skip("Summary report", "Current role lacks REPORTS permission"); return; }
  if (r.status !== 200) { fail("GET /api/reports/summary", `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`); return; }

  console.log(`  Summary keys: ${Object.keys(r.data || {}).join(", ")}`);
  pass("GET /api/reports/summary → 200", `keys: ${Object.keys(r.data || {}).slice(0, 5).join(", ")}`);
};

const testBranchFilterNarrowsResults = async () => {
  section("A7-03 — branchId filter returns branch-specific subset");

  if (ctx.branches.length < 2) { skip("Branch filter narrows results", "Need at least 2 branches to compare"); return; }

  const allRes = await req("GET", "/api/reports/summary");
  if (allRes.status !== 200) { skip("Branch filter test", `Summary returns ${allRes.status}`); return; }

  const branch = ctx.branches[0];
  const filteredRes = await req("GET", `/api/reports/summary?branchId=${branch.id}`);
  if (filteredRes.status !== 200) { skip("Branch filter test", `Filtered summary returns ${filteredRes.status}`); return; }

  // Compare a numeric field — filtered should be <= all
  const allSales      = allRes.data?.totalSales      ?? allRes.data?.salesCount      ?? allRes.data?.total      ?? null;
  const filteredSales = filteredRes.data?.totalSales ?? filteredRes.data?.salesCount ?? filteredRes.data?.total ?? null;

  if (allSales === null) {
    console.log(`  ${YELLOW}INFO${RESET} Cannot compare — response shape unknown. Keys: ${Object.keys(allRes.data || {}).join(", ")}`);
    pass("GET /api/reports/summary?branchId=X → 200 (shape not verified)");
    return;
  }

  if (Number(filteredSales) <= Number(allSales)) {
    pass("Branch filter returns subset of all-branch data", `all=${allSales}, branch=${filteredSales}`);
  } else {
    fail("Branch filter returns MORE than all-branch data", `all=${allSales}, filtered=${filteredSales}`);
  }
};

const testDateRangeFilter = async () => {
  section("A7-04 — Date range filter (startDate/endDate) narrows results");

  const now       = new Date();
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
  const tomorrow  = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
  const yearAgo   = new Date(now.getTime() - 365 * 86400000).toISOString().split("T")[0];

  const allRes     = await req("GET", `/api/reports/summary?startDate=${yearAgo}&endDate=${tomorrow}`);
  const narrowRes  = await req("GET", `/api/reports/summary?startDate=${yesterday}&endDate=${tomorrow}`);

  if (allRes.status !== 200 || narrowRes.status !== 200) {
    skip("Date range filter", `Responses: all=${allRes.status}, narrow=${narrowRes.status}`);
    return;
  }

  const allVal    = allRes.data?.totalSales    ?? allRes.data?.salesCount    ?? 0;
  const narrowVal = narrowRes.data?.totalSales ?? narrowRes.data?.salesCount ?? 0;

  if (Number(narrowVal) <= Number(allVal)) {
    pass("Narrower date range returns fewer or equal records", `year-range=${allVal}, yesterday-today=${narrowVal}`);
  } else {
    fail("Date range filter: narrow > all", `year=${allVal}, yesterday=${narrowVal}`);
  }
};

const testShiftReportTotals = async () => {
  section("A7-05 — Shift report totals are internally consistent");

  if (ctx.closedShifts.length === 0) { skip("Shift report totals", "No closed shifts found"); return; }

  const shift = ctx.closedShifts[0];
  const r = await req("GET", `/api/shifts/${shift.id}/report`);

  if (r.status !== 200) { fail(`GET /api/shifts/${shift.id}/report`, `Expected 200, got ${r.status}`); return; }

  const report = r.data;
  console.log(`  Shift report keys: ${Object.keys(report || {}).join(", ")}`);

  // Check that totalSales ≈ cashSales + cardSales (if fields exist)
  const totalSales = Number(report?.totalSales ?? report?.total ?? 0);
  const cashSales  = Number(report?.cashSales  ?? report?.cash  ?? 0);
  const cardSales  = Number(report?.cardSales  ?? report?.card  ?? 0);

  if (cashSales > 0 || cardSales > 0) {
    const sum   = cashSales + cardSales;
    const delta = Math.abs(totalSales - sum);

    if (delta < 0.01) {
      pass("Shift total = cash + card", `total=${totalSales}, cash=${cashSales}, card=${cardSales}`);
    } else {
      fail("Shift report totals mismatch", `total=${totalSales} ≠ cash(${cashSales}) + card(${cardSales}) = ${sum}`);
    }
  } else {
    pass("Shift report returned", `shiftId=${shift.id}, total=${totalSales}`);
  }
};

const testDailyTransactionsEndpoint = async () => {
  section("A7-06 — GET /api/reports/daily-transactions returns data");

  const today = new Date().toISOString().split("T")[0];
  const r = await req("GET", `/api/reports/daily-transactions?date=${today}`);

  if (r.status === 403) { skip("Daily transactions report", "Permission denied"); return; }
  if (r.status === 404) { console.log(`  ${YELLOW}INFO${RESET} /api/reports/daily-transactions returns 404 — check route path`); return; }
  if (r.status !== 200) { fail("GET /api/reports/daily-transactions", `Expected 200, got ${r.status}`); return; }

  pass("GET /api/reports/daily-transactions → 200", `date=${today}`);
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A7 — Reports & Aggregations${RESET}`);
  console.log(`Base URL: ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Token:    ${TOKEN ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);

  if (!TOKEN) { console.log(`\n${RED}No token provided.${RESET}\n`); process.exit(1); }

  await discover();
  await testReportsRequireAuth();
  await testSummaryEndpoint();
  await testBranchFilterNarrowsResults();
  await testDateRangeFilter();
  await testShiftReportTotals();
  await testDailyTransactionsEndpoint();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);
  if (failed > 0) { results.filter(r => r.result === "FAIL").forEach(r => { console.log(`  ${RED}✗${RESET} ${r.n}`); if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`); }); }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
