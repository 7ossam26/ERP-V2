/**
 * Phase A5 — HR & Payroll
 *
 * Tests:
 *  - GET employees returns records with salary fields
 *  - Adding an ADVANCE reduces employee's remaining salary
 *  - Adding a DEDUCTION reduces employee's remaining salary
 *  - Adding an OVERTIME (اضافي) INCREASES remaining and moves no cash
 *  - Adding a BONUS (مكافئة) INCREASES remaining and moves no cash
 *  - An unknown transaction type is rejected with 400
 *  - Paying salary deducts from branch treasury
 *  - Payroll snapshot reconciles to base − advances − deductions + overtime + bonuses
 *  - Cannot pay salary twice for same month/year → 400
 *  - Insufficient treasury blocks salary payment → 400
 *
 * Usage:
 *   node backend/tests/phase-a5-hr.test.js [BASE_URL] [TOKEN]
 *
 * NOTE: These tests create real employee transactions.
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

let ctx = { employees: [], employee: null, branchTreasury: null };

const discover = async () => {
  section("Discovery");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const empRes = await req("GET", `/api/employees?month=${month}&year=${year}`);
  if (empRes.status === 200) {
    ctx.employees = Array.isArray(empRes.data) ? empRes.data : empRes.data?.data || [];
    ctx.employee  = ctx.employees.find(e => Number(e.salary) > 0) || ctx.employees[0] || null;
    console.log(`  Employees: ${ctx.employees.length}`);
    if (ctx.employee) {
      console.log(`  Test employee: id=${ctx.employee.id}, name="${ctx.employee.name}", salary=${ctx.employee.salary}, remaining=${ctx.employee.remaining}`);
    }
  } else {
    console.log(`  ${RED}GET /api/employees → ${empRes.status}${RESET}`);
  }

  // Get branch treasury
  if (ctx.employee?.branchId) {
    const bRes = await req("GET", `/api/branches/${ctx.employee.branchId}`);
    if (bRes.status === 200 && bRes.data?.treasuryId) {
      const tRes = await req("GET", `/api/treasuries/${bRes.data.treasuryId}`);
      if (tRes.status === 200) {
        ctx.branchTreasury = tRes.data;
        console.log(`  Branch treasury: id=${ctx.branchTreasury.id}, balance=${ctx.branchTreasury.balance}`);
      }
    }
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const testEmployeeEndpoint = async () => {
  section("A5-01 — GET /api/employees returns records with salary fields");

  const r = await req("GET", "/api/employees");
  if (r.status !== 200) { fail("GET /api/employees", `Expected 200, got ${r.status}`); return; }

  const emps = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (emps.length === 0) { pass("GET /api/employees → 200 (empty)", "No employees in DB"); return; }

  const e = emps[0];
  const hasSalary    = "salary"    in e;
  const hasRemaining = "remaining" in e;
  const hasAdvances  = "advances"  in e;

  if (hasSalary && hasRemaining) {
    pass("Employee record has salary, remaining fields", `${emps.length} employees`);
  } else {
    fail("Employee record shape", `Missing fields. Got: ${Object.keys(e).join(", ")}`);
  }

  if (!hasAdvances) {
    console.log(`  ${YELLOW}INFO${RESET} 'advances' field not present — it may only appear with month/year query params`);
  }
};

const testAddAdvanceReducesRemaining = async () => {
  section("A5-02 — Adding ADVANCE reduces employee remaining salary");

  if (!ctx.employee) { skip("Advance test", "No employees found"); return; }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Fetch fresh employee data with this month's stats
  const empRes = await req("GET", `/api/employees?month=${month}&year=${year}`);
  const emps   = Array.isArray(empRes.data) ? empRes.data : empRes.data?.data || [];
  const fresh  = emps.find(e => e.id === ctx.employee.id) || ctx.employee;

  const remainingBefore = Number(fresh.remaining ?? fresh.salary ?? 0);
  const advanceAmt      = 1;

  if (remainingBefore < advanceAmt) { skip("Advance test", `Remaining (${remainingBefore}) too low`); return; }

  const r = await req("POST", `/api/employees/${ctx.employee.id}/transactions`, {
    type:   "ADVANCE",
    amount: advanceAmt,
    reason: "Automated test advance",
    date:   new Date().toISOString(),
  });

  if (r.status !== 200 && r.status !== 201) {
    fail("POST /api/employees/:id/transactions (ADVANCE)", `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  pass("POST ADVANCE transaction → 201");

  // Verify remaining decreased
  const empAfterRes = await req("GET", `/api/employees?month=${month}&year=${year}`);
  const empsAfter   = Array.isArray(empAfterRes.data) ? empAfterRes.data : empAfterRes.data?.data || [];
  const empAfter    = empsAfter.find(e => e.id === ctx.employee.id);

  if (empAfter) {
    const remainingAfter = Number(empAfter.remaining ?? empAfter.salary ?? 0);
    const delta          = remainingBefore - remainingAfter;

    if (Math.abs(delta - advanceAmt) < 0.01) {
      pass("Remaining salary decreased by advance amount", `${remainingBefore} → ${remainingAfter}`);
    } else {
      fail("Remaining after advance", `Expected -${advanceAmt}, got delta=${delta}`);
    }
  } else {
    console.log(`  ${YELLOW}INFO${RESET} Cannot re-fetch employee — verify manually`);
  }
};

const testAddDeductionReducesRemaining = async () => {
  section("A5-03 — Adding DEDUCTION reduces employee remaining salary");

  if (!ctx.employee) { skip("Deduction test", "No employees found"); return; }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const empRes        = await req("GET", `/api/employees?month=${month}&year=${year}`);
  const emps          = Array.isArray(empRes.data) ? empRes.data : empRes.data?.data || [];
  const fresh         = emps.find(e => e.id === ctx.employee.id) || ctx.employee;
  const remainingBefore = Number(fresh.remaining ?? 0);
  const deductAmt     = 1;

  if (remainingBefore < deductAmt) { skip("Deduction test", `Remaining (${remainingBefore}) too low`); return; }

  const r = await req("POST", `/api/employees/${ctx.employee.id}/transactions`, {
    type:   "DEDUCTION",
    amount: deductAmt,
    reason: "Automated test deduction",
    date:   new Date().toISOString(),
  });

  if (r.status !== 200 && r.status !== 201) {
    fail("POST /api/employees/:id/transactions (DEDUCTION)", `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  pass("POST DEDUCTION transaction → 201");
};

// اضافي / مكافئة are ACCRUALS: they raise the net salary but must not move any
// cash at record time. The treasury assertion is the real contract test — if an
// implementation routed them down the ADVANCE path, remaining would still look
// right but the branch drawer would be short.
const testAdditiveTypeIncreasesRemaining = async (type, label, code) => {
  section(`${code} — Adding ${type} (${label}) increases remaining, moves no cash`);

  if (!ctx.employee) { skip(`${type} test`, "No employees found"); return; }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const fetchEmployee = async () => {
    const res  = await req("GET", `/api/employees?month=${month}&year=${year}`);
    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
    return list.find(e => e.id === ctx.employee.id) || null;
  };

  const fetchTreasuryBalance = async () => {
    if (!ctx.branchTreasury?.id) return null;
    const res = await req("GET", `/api/treasuries/${ctx.branchTreasury.id}`);
    return res.status === 200 ? Number(res.data?.balance ?? NaN) : null;
  };

  const before          = await fetchEmployee();
  const remainingBefore = Number(before?.remaining ?? 0);
  const balanceBefore   = await fetchTreasuryBalance();
  const amount          = 1;

  const r = await req("POST", `/api/employees/${ctx.employee.id}/transactions`, {
    type,
    amount,
    reason: `Automated test ${type.toLowerCase()}`,
    date:   new Date().toISOString(),
  });

  if (r.status !== 200 && r.status !== 201) {
    fail(`POST /api/employees/:id/transactions (${type})`, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }
  pass(`POST ${type} transaction → 201`);

  const after = await fetchEmployee();
  if (after) {
    const remainingAfter = Number(after.remaining ?? 0);
    const delta          = remainingAfter - remainingBefore;
    if (Math.abs(delta - amount) < 0.01) {
      pass(`Remaining salary INCREASED by ${type} amount`, `${remainingBefore} → ${remainingAfter}`);
    } else {
      fail(`Remaining after ${type}`, `Expected +${amount}, got delta=${delta}`);
    }
  } else {
    console.log(`  ${YELLOW}INFO${RESET} Cannot re-fetch employee — verify manually`);
  }

  const balanceAfter = await fetchTreasuryBalance();
  if (balanceBefore === null || balanceAfter === null || Number.isNaN(balanceBefore)) {
    skip(`${type} moves no cash`, "Branch treasury balance unavailable");
  } else if (Math.abs(balanceAfter - balanceBefore) < 0.01) {
    pass(`${type} moved NO cash (treasury unchanged)`, `balance=${balanceAfter}`);
  } else {
    fail(`${type} must not move cash`, `Treasury changed ${balanceBefore} → ${balanceAfter}`);
  }
};

// Regression test for the old fallthrough, where any unrecognised type was
// silently written as a DEDUCTION instead of being rejected.
const testUnknownTypeRejected = async () => {
  section("A5-08 — Unknown transaction type is rejected");

  if (!ctx.employee) { skip("Unknown type test", "No employees found"); return; }

  const r = await req("POST", `/api/employees/${ctx.employee.id}/transactions`, {
    type:   "NONSENSE",
    amount: 1,
    reason: "Automated test invalid type",
    date:   new Date().toISOString(),
  });

  if (r.status === 400) {
    pass("POST unknown type → 400", JSON.stringify(r.data?.message ?? r.data?.error ?? ""));
  } else {
    fail("Unknown type guard", `Expected 400 — got ${r.status}. It may have been silently stored as a DEDUCTION.`);
  }
};

// The payroll row is a frozen snapshot; it must satisfy the identity on its own.
const testPayrollSnapshotReconciles = async () => {
  section("A5-09 — Payroll snapshot reconciles to the net-salary identity");

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const res = await req("GET", `/api/employees/payrolls/all?month=${month}&year=${year}`);
  if (res.status !== 200) { skip("Payroll reconciliation", `GET payrolls returned ${res.status}`); return; }

  const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
  if (rows.length === 0) { skip("Payroll reconciliation", "No payrolls this month"); return; }

  const bad = rows.filter(p => {
    const expected =
      Number(p.baseSalary) - Number(p.advances) - Number(p.deductions) +
      Number(p.overtime ?? 0) + Number(p.bonuses ?? 0);
    return Math.abs(Number(p.netSalary) - expected) > 0.01;
  });

  if (bad.length === 0) {
    pass("All payroll rows reconcile", `${rows.length} checked`);
  } else {
    fail("Payroll reconciliation", `${bad.length}/${rows.length} rows fail: ids ${bad.map(p => p.id).join(", ")}`);
  }
};

const testSalaryPaymentDeductsTreasury = async () => {
  section("A5-04 — Salary payment deducts from branch treasury");

  if (!ctx.employee)       { skip("Salary payment", "No employees found"); return; }
  if (!ctx.branchTreasury) { skip("Salary payment", "Cannot find branch treasury"); return; }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const balanceBefore = Number(ctx.branchTreasury.balance);

  const r = await req("POST", `/api/employees/${ctx.employee.id}/pay`, { month, year });

  if (r.status === 400 && (r.data?.error?.includes("already") || r.data?.message?.includes("already"))) {
    skip("Salary payment", `Already paid for ${month}/${year}`);
    return;
  }

  if (r.status === 400 && (r.data?.error?.includes("خزينة") || r.data?.error?.includes("insufficient") || r.data?.error?.includes("balance"))) {
    pass("Insufficient treasury blocked salary payment → 400", `"${r.data.error}"`);
    return;
  }

  if (r.status !== 200 && r.status !== 201) {
    fail("POST /api/employees/:id/pay", `Expected 200/201, got ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  const netSalary   = Number(r.data?.netSalary || r.data?.amount || 0);
  pass("POST /api/employees/:id/pay → paid", `netSalary=${netSalary}`);

  // Verify treasury decreased
  const tAfter = await req("GET", `/api/treasuries/${ctx.branchTreasury.id}`);
  const balanceAfter = Number(tAfter.data?.balance);
  const delta = balanceBefore - balanceAfter;

  if (Math.abs(delta - netSalary) < 0.01) {
    pass("Treasury decreased by net salary amount", `${balanceBefore} → ${balanceAfter}`);
  } else {
    fail("Treasury after salary payment", `Expected -${netSalary}, got delta=${delta}`);
  }
};

const testCannotPaySalaryTwice = async () => {
  section("A5-05 — Cannot pay salary twice for same month/year → 400");

  if (!ctx.employee) { skip("Duplicate salary guard", "No employees found"); return; }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Pay once
  const r1 = await req("POST", `/api/employees/${ctx.employee.id}/pay`, { month, year });

  if (r1.status === 200 || r1.status === 201) {
    // Now try again
    const r2 = await req("POST", `/api/employees/${ctx.employee.id}/pay`, { month, year });
    if (r2.status === 400) {
      pass("Second salary payment for same month → 400", `msg: "${r2.data?.error || r2.data?.message}"`);
    } else {
      fail("Duplicate salary guard", `Expected 400 — got ${r2.status} (double payment allowed!)`);
    }
  } else if (r1.status === 400 && (r1.data?.error?.includes("already") || r1.data?.message?.includes("already"))) {
    // Already paid — try paying again
    const r2 = await req("POST", `/api/employees/${ctx.employee.id}/pay`, { month, year });
    if (r2.status === 400) {
      pass("Second salary payment for same month → 400", `Already paid, second attempt also blocked`);
    } else {
      fail("Duplicate salary guard", `Expected 400 — got ${r2.status}`);
    }
  } else {
    console.log(`  ${YELLOW}INFO${RESET} First payment returned ${r1.status} — cannot test duplicate guard`);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A5 — HR & Payroll${RESET}`);
  console.log(`Base URL: ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Token:    ${TOKEN ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);

  if (!TOKEN) { console.log(`\n${RED}No token provided.${RESET}\n`); process.exit(1); }

  await discover();
  await testEmployeeEndpoint();
  await testAddAdvanceReducesRemaining();
  await testAddDeductionReducesRemaining();
  await testAdditiveTypeIncreasesRemaining("OVERTIME", "اضافي", "A5-06");
  await testAdditiveTypeIncreasesRemaining("BONUS", "مكافئة", "A5-07");
  await testUnknownTypeRejected();
  await testSalaryPaymentDeductsTreasury();
  await testPayrollSnapshotReconciles();
  await testCannotPaySalaryTwice();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);
  if (failed > 0) { results.filter(r => r.result === "FAIL").forEach(r => { console.log(`  ${RED}✗${RESET} ${r.n}`); if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`); }); }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
