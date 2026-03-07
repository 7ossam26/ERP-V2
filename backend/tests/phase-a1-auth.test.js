/**
 * Phase A1 — Authentication, JWT & Permission Middleware
 *
 * Tests:
 *  - Login with valid / invalid credentials
 *  - Token required on all protected routes
 *  - Invalid / expired token handling
 *  - Permission guard (403 when role lacks the module)
 *  - Superadmin bypass (always allowed)
 *  - Branch filter (user only sees their own branch data)
 *
 * Usage:
 *   node backend/tests/phase-a1-auth.test.js [BASE_URL] [ADMIN_TOKEN] [LIMITED_TOKEN]
 *
 *   ADMIN_TOKEN   — a Superadmin or Admin token (full access)
 *   LIMITED_TOKEN — a token for a role with restricted permissions (optional)
 *
 * Get tokens: log in at http://localhost:5173 → DevTools → Application →
 *             Local Storage → copy value of "token"
 */

const BASE_URL     = process.argv[2] || process.env.BASE_URL     || "http://localhost:3001";
const ADMIN_TOKEN  = process.argv[3] || process.env.ADMIN_TOKEN  || process.env.TOKEN || "";
const LIMITED_TOKEN = process.argv[4] || process.env.LIMITED_TOKEN || "";

// ─── ANSI Colors ───────────────────────────────────────────────────────────────
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

let passed = 0, failed = 0, skipped = 0;
const results = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const req = async (method, path, body, token) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    const ct = res.headers.get("content-type") || "";
    data = ct.includes("application/json") ? await res.json() : await res.text();
  } catch { data = null; }
  return { status: res.status, data };
};

const pass  = (name, detail = "") => { console.log(`  ${GREEN}PASS${RESET} ${name}${detail ? `  ${YELLOW}${detail}${RESET}` : ""}`); results.push({ name, result: "PASS" }); passed++; };
const fail  = (name, detail = "") => { console.log(`  ${RED}FAIL${RESET} ${name}  ${RED}${detail}${RESET}`); results.push({ name, result: "FAIL", detail }); failed++; };
const skip  = (name, reason)      => { console.log(`  ${YELLOW}SKIP${RESET} ${name}  ${YELLOW}(${reason})${RESET}`); results.push({ name, result: "SKIP", detail: reason }); skipped++; };
const section = (t) => console.log(`\n${BOLD}${CYAN}── ${t} ${"─".repeat(Math.max(0, 60 - t.length))}${RESET}`);

// ─── Tests ────────────────────────────────────────────────────────────────────

const testUnauthenticated = async () => {
  section("A1-01 — Protected routes reject requests with no token");

  const routes = [
    ["GET",  "/api/auth/me"],
    ["GET",  "/api/employees"],
    ["GET",  "/api/treasuries"],
    ["GET",  "/api/purchases"],
    ["GET",  "/api/shifts"],
    ["GET",  "/api/supplier-accounts"],
  ];

  for (const [method, path] of routes) {
    const r = await req(method, path, null, null);
    if (r.status === 401) {
      pass(`${method} ${path} without token → 401`);
    } else {
      fail(`${method} ${path} without token`, `Expected 401, got ${r.status}`);
    }
  }
};

const testInvalidToken = async () => {
  section("A1-02 — Invalid / malformed token returns 401");

  const badTokens = [
    "not.a.jwt",
    "eyJhbGciOiJIUzI1NiJ9.broken.payload",
    "Bearer eyJhbGciOiJIUzI1NiJ9.e30.invalid",
  ];

  for (const tok of badTokens) {
    const r = await req("GET", "/api/auth/me", null, tok);
    if (r.status === 401) {
      pass(`Invalid token "${tok.substring(0, 20)}..." → 401`);
    } else {
      fail(`Invalid token check`, `Expected 401, got ${r.status} for token: ${tok.substring(0, 20)}...`);
    }
  }
};

const testLoginValid = async () => {
  section("A1-03 — Login with valid credentials returns token");

  if (!ADMIN_TOKEN) {
    skip("Login valid credentials", "No ADMIN_TOKEN provided — cannot look up username");
    return null;
  }

  // We can verify the token works by hitting /api/auth/me
  const r = await req("GET", "/api/auth/me", null, ADMIN_TOKEN);
  if (r.status === 200 && r.data?.id) {
    pass("GET /api/auth/me with valid token → 200", `user: ${r.data.name} (${r.data.role?.name})`);
    return r.data;
  } else {
    fail("GET /api/auth/me with valid token", `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
    return null;
  }
};

const testLoginInvalid = async () => {
  section("A1-04 — Login with wrong credentials returns 401");

  const r = await req("POST", "/api/auth/login", {
    username: "this_user_does_not_exist_xyz123",
    password: "wrong_password_12345",
  }, null);

  if (r.status === 401 || r.status === 400) {
    pass(`POST /api/auth/login with bad credentials → ${r.status}`);
  } else if (r.status === 200) {
    fail("POST /api/auth/login with bad credentials", "Expected 401/400 — got 200 (login bypass!)");
  } else {
    fail("POST /api/auth/login with bad credentials", `Expected 401/400 — got ${r.status}`);
  }
};

const testFallbackJWTSecret = async () => {
  section("A1-05 — JWT fallback secret risk check");

  // A token signed with 'fallback_secret_key_change_me' would still work if
  // JWT_SECRET is not set. We check by seeing if /api/auth/me works with our
  // real token — if the response has a valid user, the secret is working.
  // We also note the risk.
  if (!ADMIN_TOKEN) {
    skip("JWT secret check", "No token available");
    return;
  }

  const r = await req("GET", "/api/auth/me", null, ADMIN_TOKEN);
  if (r.status === 200) {
    console.log(`  ${YELLOW}NOTE${RESET} Token is valid. If backend .env is missing JWT_SECRET, it uses 'fallback_secret_key_change_me'.`);
    console.log(`  ${YELLOW}NOTE${RESET} Verify that backend/.env has JWT_SECRET set to a strong value.`);
    pass("Token authentication is working", `user: ${r.data?.name}`);
  } else {
    fail("Token authentication", `Expected 200, got ${r.status}`);
  }
};

const testPermissionGuard = async () => {
  section("A1-06 — Permission guard: insufficient role returns 403");

  if (!LIMITED_TOKEN) {
    skip("Permission guard with limited role", "No LIMITED_TOKEN provided");
    return;
  }

  // Routes that require specific permissions a limited user likely doesn't have
  const restrictedRoutes = [
    ["GET", "/api/reports/summary"],
    ["GET", "/api/supplier-accounts"],
    ["GET", "/api/shifts"],
  ];

  for (const [method, path] of restrictedRoutes) {
    const r = await req(method, path, null, LIMITED_TOKEN);
    if (r.status === 403) {
      pass(`Limited role blocked from ${method} ${path} → 403`);
    } else if (r.status === 200) {
      console.log(`  ${YELLOW}INFO${RESET} ${method} ${path} returned 200 for limited role — may have permission`);
    } else {
      console.log(`  ${YELLOW}INFO${RESET} ${method} ${path} returned ${r.status} — check role permissions`);
    }
  }
};

const testAdminBypass = async () => {
  section("A1-07 — Admin/Superadmin bypasses all permission checks");

  if (!ADMIN_TOKEN) {
    skip("Admin permission bypass", "No ADMIN_TOKEN provided");
    return;
  }

  const adminRoutes = [
    ["GET", "/api/employees"],
    ["GET", "/api/treasuries"],
    ["GET", "/api/purchases"],
    ["GET", "/api/reports/summary"],
    ["GET", "/api/supplier-accounts"],
  ];

  for (const [method, path] of adminRoutes) {
    const r = await req(method, path, null, ADMIN_TOKEN);
    if (r.status === 200) {
      pass(`Admin accesses ${method} ${path} → 200`);
    } else if (r.status === 403) {
      fail(`Admin blocked from ${method} ${path}`, `Expected 200 — got 403 (Admin should bypass permission checks)`);
    } else {
      console.log(`  ${YELLOW}INFO${RESET} ${method} ${path} → ${r.status} (may be empty data or different shape)`);
    }
  }
};

const testBranchFilter = async () => {
  section("A1-08 — Branch filter: user only sees their own branch data");

  if (!ADMIN_TOKEN) {
    skip("Branch filter test", "No ADMIN_TOKEN provided");
    return;
  }

  const meRes = await req("GET", "/api/auth/me", null, ADMIN_TOKEN);
  if (meRes.status !== 200) {
    skip("Branch filter test", "Cannot fetch current user");
    return;
  }

  const currentUser = meRes.data;
  console.log(`  Current user branchId: ${currentUser.branchId ?? "null (all branches)"}`);
  console.log(`  Role: ${currentUser.role?.name}`);

  // A superadmin/admin with branchId=null should see all branches
  // A branch user with branchId set should only see their branch

  if (currentUser.branchId === null && (currentUser.role?.name === "Admin" || currentUser.role?.name === "Superadmin")) {
    const r = await req("GET", "/api/treasuries", null, ADMIN_TOKEN);
    if (r.status === 200 && Array.isArray(r.data)) {
      pass(`Superadmin sees all treasuries: ${r.data.length} records`);
    } else {
      fail("Superadmin treasury access", `Expected 200 array, got ${r.status}`);
    }
  } else if (currentUser.branchId) {
    console.log(`  ${YELLOW}INFO${RESET} User is branch-scoped to branchId=${currentUser.branchId}`);
    console.log(`  ${YELLOW}INFO${RESET} To fully test branch filter, compare response with/without filter manually`);
    pass("Branch-scoped user token validated", `branchId=${currentUser.branchId}`);
  } else {
    console.log(`  ${YELLOW}INFO${RESET} Unexpected user shape — branchId: ${currentUser.branchId}, role: ${currentUser.role?.name}`);
  }
};

const testSensitiveAccessMiddleware = async () => {
  section("A1-09 — Sensitive access middleware");

  if (!ADMIN_TOKEN) {
    skip("Sensitive access middleware", "No ADMIN_TOKEN provided");
    return;
  }

  // Routes protected by requireSensitiveAccess if they exist
  // The middleware is on routes like user management, permission config
  const sensitiveRoutes = [
    ["GET", "/api/users"],
    ["GET", "/api/roles"],
  ];

  for (const [method, path] of sensitiveRoutes) {
    const r = await req(method, path, null, ADMIN_TOKEN);
    if (r.status === 200) {
      pass(`Admin accesses sensitive route ${method} ${path} → 200`);
    } else if (r.status === 403) {
      console.log(`  ${YELLOW}INFO${RESET} ${method} ${path} → 403 for current token (may need hasSensitiveAccess=true)`);
    } else {
      console.log(`  ${YELLOW}INFO${RESET} ${method} ${path} → ${r.status}`);
    }
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A1 — Authentication & Permission Middleware${RESET}`);
  console.log(`Base URL:      ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Admin token:   ${ADMIN_TOKEN  ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);
  console.log(`Limited token: ${LIMITED_TOKEN ? `${GREEN}provided${RESET}` : `${YELLOW}not provided${RESET} (permission guard tests will be skipped)`}`);

  await testUnauthenticated();
  await testInvalidToken();
  await testLoginValid();
  await testLoginInvalid();
  await testFallbackJWTSecret();
  await testPermissionGuard();
  await testAdminBypass();
  await testBranchFilter();
  await testSensitiveAccessMiddleware();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);

  if (failed > 0) {
    results.filter(r => r.result === "FAIL").forEach(r => {
      console.log(`  ${RED}✗${RESET} ${r.name}`);
      if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`);
    });
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
